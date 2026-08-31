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
  duracaoMs: number;
}

class TvWipService {
  // O tipo exportado varia entre versoes do node-cron; guardamos so o que
  // usamos (stop), evitando depender do nome do tipo.
  private tarefa: { stop: () => void } | null = null;
  private rodando = false;

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

    this.sincronizar().catch((e) =>
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

      const paraSalvar: TvWipConta[] = [];

      for (const conta of contas) {
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
        duracaoMs: Date.now() - inicio,
      };

      console.log(
        `[TvWip] Sincronizado: ${resultado.clientesAtivos} cliente(s) ativo(s) | ` +
          `+${criadas} nova(s) | ${reativadas} reativada(s) | ` +
          `${desativadas} desativada(s) | ${atualizadas} atualizada(s) | ` +
          `${resultado.duracaoMs}ms`,
      );

      return resultado;
    } finally {
      this.rodando = false;
    }
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
      if (!ativos.has(conta.login.trim().toUpperCase())) {
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
