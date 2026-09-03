import cron from "node-cron";
import { In } from "typeorm";

import AppDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { TvWipConta } from "../entities/TvWipConta";
import { ClientesEntities } from "../entities/ClientesEntities";

/**
 * TV WIP grátis — sincroniza a lista de contas com o cadastro do MKAuth.
 *
 * Nada aqui toca o streaming pago da Watch Brasil: são produtos diferentes.
 *
 * Regra: tem conta quem é cliente ATIVO (`cli_ativado = 's'`). A varredura
 * diária inclui os clientes novos e desativa quem deixou de ser ativo — que é
 * o passo que hoje ninguém lembra de fazer à mão.
 */

/** Motivo gravado quando a desativação é automática. */
export const MOTIVO_INATIVO = "Cliente inativo no MKAuth";

export interface ResultadoSincronizacao {
  /** Clientes ativos encontrados no MKAuth. */
  clientesAtivos: number;
  /** Contas criadas nesta passada. */
  criadas: number;
  /** Contas reativadas (cliente voltou a ser ativo). */
  reativadas: number;
  /** Contas desativadas por o cliente não ser mais ativo. */
  desativadas: number;
  /** Contas cuja senha/nome mudou no cadastro e foi atualizada aqui. */
  atualizadas: number;
  /** Contas avulsas ignoradas por não terem cadastro no MKAuth. */
  avulsasIgnoradas: number;
  duracaoMs: number;
}

/** Por que o acesso foi liberado ou recusado. */
export type MotivoAutenticacao =
  | "OK"
  | "DADOS_INCOMPLETOS"
  | "NAO_ENCONTRADO"
  | "SENHA_INCORRETA"
  | "DESATIVADA";

export interface ResultadoAutenticacao {
  /** Pode entrar no aplicativo? */
  permitido: boolean;
  motivo: MotivoAutenticacao;
  /** O login existe na lista? */
  existe: boolean;
  /** A conta está ativa? (independente da senha estar certa) */
  ativo: boolean;
  /** Texto pronto para o aplicativo exibir. */
  mensagem: string;
  conta?: { login: string; nome: string | null; avulso: boolean };
}

class TvWipService {
  // O tipo exportado varia entre versoes do node-cron; guardamos so o que
  // usamos (stop), evitando depender do nome do tipo.
  private tarefa: { stop: () => void } | null = null;
  private rodando = false;

  /**
   * Espera os dois bancos ficarem prontos.
   *
   * `start()` roda dentro do callback do `listen`, que dispara antes de o
   * TypeORM terminar de conectar — e aí a consulta estoura um "No metadata for
   * ClientesEntities", que não diz nada sobre a causa real.
   */
  private async aguardarBancos(timeoutMs = 60_000): Promise<boolean> {
    const limite = Date.now() + timeoutMs;
    while (Date.now() < limite) {
      if (AppDataSource.isInitialized && MkauthSource.isInitialized) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  }

  /**
   * Agenda a varredura diária (03:10) e roda uma vez no boot, para a lista já
   * subir coerente depois de um restart demorado.
   */
  start(): void {
    if (this.tarefa) return;

    this.tarefa = cron.schedule(
      "10 3 * * *",
      () => {
        this.sincronizar().catch((e) =>
          console.error("[TvWip] Falha na varredura diária:", e?.message || e),
        );
      },
      { timezone: "America/Sao_Paulo" },
    );

    console.log("[TvWip] Varredura diária agendada para 03:10.");

    this.aguardarBancos()
      .then((pronto) => {
        if (!pronto) {
          console.warn(
            "[TvWip] Bancos não ficaram prontos a tempo; a varredura inicial " +
              "foi pulada. A próxima roda no horário agendado.",
          );
          return;
        }
        return this.sincronizar();
      })
      .catch((e) =>
        console.error("[TvWip] Falha na varredura inicial:", e?.message || e),
      );
  }

  stop(): void {
    this.tarefa?.stop();
    this.tarefa = null;
  }

  /**
   * Compara a lista com o cadastro e ajusta os dois lados.
   *
   * Faz tudo em memória depois de duas leituras: são poucos milhares de
   * clientes, e uma consulta por cliente deixaria a varredura em minutos.
   */
  async sincronizar(): Promise<ResultadoSincronizacao> {
    if (this.rodando) {
      throw new Error("Uma sincronização já está em andamento.");
    }
    this.rodando = true;
    const inicio = Date.now();

    try {
      // Vale também para a execução agendada: se o processo tiver acabado de
      // reiniciar, as conexões podem ainda estar subindo.
      if (!(await this.aguardarBancos())) {
        throw new Error("Bancos de dados indisponíveis no momento.");
      }

      const repo = AppDataSource.getRepository(TvWipConta);

      const ativos = await MkauthSource.getRepository(ClientesEntities).find({
        select: { login: true, senha: true, nome: true },
        where: { cli_ativado: "s" },
      });

      const porLogin = new Map(
        ativos
          .filter((c) => !!c.login)
          .map((c) => [c.login.trim().toUpperCase(), c]),
      );

      const contas = await repo.find();
      const agora = new Date();

      let criadas = 0;
      let reativadas = 0;
      let desativadas = 0;
      let atualizadas = 0;
      let avulsasIgnoradas = 0;

      const paraSalvar: TvWipConta[] = [];

      for (const conta of contas) {
        // Conta avulsa não tem cadastro para comparar: sai da varredura inteira,
        // inclusive da atualização de senha e da desativação automática.
        if (conta.avulso) {
          avulsasIgnoradas += 1;
          continue;
        }

        const cliente = porLogin.get(conta.login.trim().toUpperCase());
        conta.verificado_em = agora;

        if (!cliente) {
          // Deixou de ser cliente ativo: a conta sai do ar.
          if (conta.ativo) {
            conta.ativo = false;
            conta.desativado_em = agora;
            conta.motivo_desativacao = MOTIVO_INATIVO;
            conta.desativado_por = null;
            desativadas += 1;
          }
          paraSalvar.push(conta);
          continue;
        }

        // Cliente ativo de novo: só reativa o que a própria varredura tinha
        // desativado. Corte manual é decisão de alguém e não pode ser desfeito
        // sozinho na madrugada seguinte.
        if (!conta.ativo && conta.motivo_desativacao === MOTIVO_INATIVO) {
          conta.ativo = true;
          conta.desativado_em = null;
          conta.motivo_desativacao = null;
          reativadas += 1;
        }

        const senha = cliente.senha ?? null;
        const nome = cliente.nome ?? null;
        if (conta.senha !== senha || conta.nome !== nome) {
          conta.senha = senha;
          conta.nome = nome;
          atualizadas += 1;
        }

        paraSalvar.push(conta);
        porLogin.delete(conta.login.trim().toUpperCase());
      }

      // O que sobrou no mapa é cliente ativo que ainda não tinha conta.
      for (const cliente of porLogin.values()) {
        paraSalvar.push(
          repo.create({
            login: cliente.login.trim(),
            senha: cliente.senha ?? null,
            nome: cliente.nome ?? null,
            ativo: true,
            verificado_em: agora,
          }),
        );
        criadas += 1;
      }

      // Em lotes: um save único com milhares de linhas estoura o pacote MySQL.
      const TAMANHO_LOTE = 200;
      for (let i = 0; i < paraSalvar.length; i += TAMANHO_LOTE) {
        await repo.save(paraSalvar.slice(i, i + TAMANHO_LOTE));
      }

      const resultado: ResultadoSincronizacao = {
        clientesAtivos: ativos.length,
        criadas,
        reativadas,
        desativadas,
        atualizadas,
        avulsasIgnoradas,
        duracaoMs: Date.now() - inicio,
      };

      console.log(
        `[TvWip] Sincronizado: ${resultado.clientesAtivos} cliente(s) ativo(s) | ` +
          `+${criadas} nova(s) | ${reativadas} reativada(s) | ` +
          `${desativadas} desativada(s) | ${atualizadas} atualizada(s) | ` +
          `${avulsasIgnoradas} avulsa(s) ignorada(s) | ${resultado.duracaoMs}ms`,
      );

      return resultado;
    } finally {
      this.rodando = false;
    }
  }

  /**
   * Valida o acesso de um usuário no aplicativo da TV.
   *
   * Distingue os casos de propósito (não existe / senha errada / desativada),
   * porque a tela do aplicativo precisa dizer ao cliente o que houve. Como isso
   * revela se um login existe, a rota que chama este método é protegida por
   * chave de API.
   */
  async autenticar(
    login: string,
    senha: string,
  ): Promise<ResultadoAutenticacao> {
    const usuario = String(login || "").trim();
    const chave = String(senha ?? "");

    if (!usuario || !chave) {
      return {
        permitido: false,
        motivo: "DADOS_INCOMPLETOS",
        existe: false,
        ativo: false,
        mensagem: "Informe usuário e senha.",
      };
    }

    const conta = await AppDataSource.getRepository(TvWipConta)
      .createQueryBuilder("c")
      .where("UPPER(TRIM(c.login)) = UPPER(TRIM(:l))", { l: usuario })
      .getOne();

    if (!conta) {
      return {
        permitido: false,
        motivo: "NAO_ENCONTRADO",
        existe: false,
        ativo: false,
        mensagem: "Usuário não encontrado.",
      };
    }

    // Comparação direta: a senha vem do cadastro do MKAuth, que a guarda em
    // texto puro — não há hash para conferir.
    if ((conta.senha ?? "") !== chave) {
      return {
        permitido: false,
        motivo: "SENHA_INCORRETA",
        existe: true,
        ativo: conta.ativo,
        mensagem: "Senha incorreta.",
      };
    }

    if (!conta.ativo) {
      return {
        permitido: false,
        motivo: "DESATIVADA",
        existe: true,
        ativo: false,
        mensagem: conta.motivo_desativacao
          ? `Acesso desativado: ${conta.motivo_desativacao}.`
          : "Acesso desativado.",
        conta: { login: conta.login, nome: conta.nome, avulso: conta.avulso },
      };
    }

    return {
      permitido: true,
      motivo: "OK",
      existe: true,
      ativo: true,
      mensagem: "Acesso liberado.",
      conta: { login: conta.login, nome: conta.nome, avulso: conta.avulso },
    };
  }

  /**
   * Cria uma conta avulsa — acesso à TV para quem não é cliente cadastrado.
   *
   * Recusa um login que exista no MKAuth: nesse caso a conta tem que ser a
   * normal, sincronizada, e não uma paralela que a varredura nunca tocaria.
   */
  async criarAvulso(dados: {
    login: string;
    senha: string;
    nome?: string;
    observacao?: string;
    criadoPor?: string;
  }): Promise<TvWipConta> {
    const login = String(dados.login || "").trim();
    const senha = String(dados.senha || "").trim();

    if (!login) throw new Error("Informe o login.");
    if (!senha) throw new Error("Informe a senha.");
    if (/\s/.test(login)) throw new Error("O login não pode conter espaços.");

    const repo = AppDataSource.getRepository(TvWipConta);

    const jaExiste = await repo
      .createQueryBuilder("c")
      .where("UPPER(TRIM(c.login)) = UPPER(TRIM(:l))", { l: login })
      .getOne();
    if (jaExiste) {
      throw new Error(
        jaExiste.avulso
          ? `Já existe uma conta avulsa com o login ${jaExiste.login}.`
          : `O login ${jaExiste.login} já está na lista como cliente do MKAuth.`,
      );
    }

    const cliente = await MkauthSource.getRepository(ClientesEntities)
      .createQueryBuilder("c")
      .where("UPPER(TRIM(c.login)) = UPPER(TRIM(:l))", { l: login })
      .getOne();
    if (cliente) {
      throw new Error(
        `${cliente.login} tem cadastro no MKAuth. Use "Sincronizar agora" ` +
          "para trazer a conta normal em vez de criar uma avulsa.",
      );
    }

    return repo.save(
      repo.create({
        login,
        senha,
        nome: String(dados.nome || "").trim() || null,
        observacao: String(dados.observacao || "").trim() || null,
        avulso: true,
        ativo: true,
        desativado_por: dados.criadoPor || null,
      }),
    );
  }

  /**
   * Remove uma conta avulsa. As sincronizadas não são apagadas: elas voltariam
   * na varredura seguinte, então para essas o certo é desativar.
   */
  async removerAvulso(login: string): Promise<void> {
    const repo = AppDataSource.getRepository(TvWipConta);
    const conta = await repo
      .createQueryBuilder("c")
      .where("UPPER(TRIM(c.login)) = UPPER(TRIM(:l))", { l: login })
      .getOne();

    if (!conta) throw new Error("Conta não encontrada.");
    if (!conta.avulso) {
      throw new Error(
        "Essa conta vem do MKAuth e voltaria na próxima sincronização. " +
          "Use Desativar.",
      );
    }
    await repo.remove(conta);
  }

  /**
   * Situação resumida de uma conta, sem conferir senha.
   *
   * Usada pela API do aplicativo a cada requisição: o token diz quem é, mas
   * quem decide se pode assistir é a conta agora, não quando o token foi
   * emitido.
   */
  async situacaoDaConta(login: string): Promise<{
    existe: boolean;
    ativo: boolean;
    nome: string | null;
    avulso: boolean;
    motivo: string | null;
  }> {
    const conta = await AppDataSource.getRepository(TvWipConta)
      .createQueryBuilder("c")
      .where("UPPER(TRIM(c.login)) = UPPER(TRIM(:l))", { l: String(login || "") })
      .getOne();

    if (!conta) {
      return { existe: false, ativo: false, nome: null, avulso: false, motivo: null };
    }
    return {
      existe: true,
      ativo: conta.ativo,
      nome: conta.nome,
      avulso: conta.avulso,
      motivo: conta.motivo_desativacao,
    };
  }

  /**
   * Resolve "todas as contas do filtro atual" em uma lista de logins.
   *
   * A tela mostra 50 por vez; sem isso, "selecionar todos" mandaria só a
   * página visível — ou milhares de logins no corpo da requisição.
   */
  async loginsDoFiltro(filtro: {
    situacao?: string;
    busca?: string;
  }): Promise<string[]> {
    const qb = AppDataSource.getRepository(TvWipConta)
      .createQueryBuilder("c")
      .select("c.login", "login");

    if (filtro.situacao === "ativas") qb.andWhere("c.ativo = true");
    if (filtro.situacao === "desativadas") qb.andWhere("c.ativo = false");

    const busca = String(filtro.busca || "").trim();
    if (busca) {
      qb.andWhere("(c.login LIKE :b OR c.nome LIKE :b)", { b: `%${busca}%` });
    }

    const linhas = await qb.getRawMany();
    return linhas.map((l) => l.login);
  }

  /** Desativa contas escolhidas na tela. */
  async desativar(
    logins: string[],
    motivo: string,
    usuario: string,
  ): Promise<number> {
    const repo = AppDataSource.getRepository(TvWipConta);
    const contas = await repo.find({ where: { login: In(logins) } });
    if (contas.length === 0) return 0;

    const agora = new Date();
    for (const conta of contas) {
      conta.ativo = false;
      conta.desativado_em = agora;
      conta.motivo_desativacao = motivo || "Desativada manualmente";
      conta.desativado_por = usuario || null;
    }
    await repo.save(contas);
    return contas.length;
  }

  /**
   * Reativa contas manualmente. Só vale para quem ainda é cliente ativo: sem
   * essa checagem a tela conseguiria liberar a TV para quem não é mais cliente.
   */
  async reativar(logins: string[]): Promise<{ reativadas: number; recusadas: string[] }> {
    const repo = AppDataSource.getRepository(TvWipConta);
    const contas = await repo.find({ where: { login: In(logins) } });
    if (contas.length === 0) return { reativadas: 0, recusadas: [] };

    const clientes = await MkauthSource.getRepository(ClientesEntities).find({
      select: { login: true, cli_ativado: true },
      where: { login: In(contas.map((c) => c.login)) },
    });
    const ativos = new Set(
      clientes
        .filter((c) => c.cli_ativado === "s")
        .map((c) => c.login.trim().toUpperCase()),
    );

    const recusadas: string[] = [];
    const paraSalvar: TvWipConta[] = [];

    for (const conta of contas) {
      // Avulsa não tem cadastro para conferir: a liberação é sempre manual.
      if (!conta.avulso && !ativos.has(conta.login.trim().toUpperCase())) {
        recusadas.push(conta.login);
        continue;
      }
      conta.ativo = true;
      conta.desativado_em = null;
      conta.motivo_desativacao = null;
      conta.desativado_por = null;
      paraSalvar.push(conta);
    }

    if (paraSalvar.length) await repo.save(paraSalvar);
    return { reativadas: paraSalvar.length, recusadas };
  }
}

export default new TvWipService();
