import { Request, Response } from "express";
import axios from "axios";
import { Brackets } from "typeorm";

import AppDataSource from "../database/DataSource";
import { TvWipConta } from "../entities/TvWipConta";
import TvWipService from "../services/TvWipService";
import TvWipCanaisService from "../services/TvWipCanaisService";
import TvWipEpgService from "../services/TvWipEpgService";
import { salvarLogo } from "../services/TvWipLogoService";

/**
 * TV WIP grátis — lista de clientes com acesso ao aplicativo.
 *
 * A credencial é o próprio login/senha do cadastro no MKAuth. Nada aqui toca o
 * streaming pago da Watch Brasil.
 */
class TvWip {
  /** Lista paginada, porque são milhares de clientes ativos. */
  public listar = async (req: Request, res: Response) => {
    try {
      const busca = String(req.query.busca || "").trim();
      const situacao = String(req.query.situacao || "ativas");
      const pagina = Math.max(1, Number(req.query.pagina) || 1);
      const porPagina = Math.min(Number(req.query.porPagina) || 50, 200);

      const qb = AppDataSource.getRepository(TvWipConta)
        .createQueryBuilder("c")
        .orderBy("c.login", "ASC")
        .skip((pagina - 1) * porPagina)
        .take(porPagina);

      if (situacao === "ativas") qb.andWhere("c.ativo = true");
      if (situacao === "desativadas") qb.andWhere("c.ativo = false");

      if (busca) {
        qb.andWhere(
          new Brackets((w) => {
            w.where("c.login LIKE :b", { b: `%${busca}%` }).orWhere(
              "c.nome LIKE :b",
              { b: `%${busca}%` },
            );
          }),
        );
      }

      const [contas, total] = await qb.getManyAndCount();

      const repo = AppDataSource.getRepository(TvWipConta);
      const [totalAtivas, totalDesativadas] = await Promise.all([
        repo.count({ where: { ativo: true } }),
        repo.count({ where: { ativo: false } }),
      ]);

      // Pacotes de cada conta da página, para a lista mostrar o grupo de
      // canais ao lado do cliente. Só dos logins visíveis: com milhares de
      // contas, trazer tudo não se paga.
      const pacotesPorConta = await TvWipCanaisService.pacotesDetalhadosDasContas(
        contas.map((c) => c.login),
      );

      res.json({
        contas: contas.map((c) => ({
          ...c,
          pacotes: pacotesPorConta.get(c.login) ?? [],
        })),
        total,
        pagina,
        porPagina,
        paginas: Math.max(1, Math.ceil(total / porPagina)),
        resumo: { ativas: totalAtivas, desativadas: totalDesativadas },
      });
    } catch (error: any) {
      console.error("[TvWip] Erro ao listar:", error?.message || error);
      res.status(500).json({ message: "Erro ao listar as contas da TV WIP." });
    }
  };

  /** Desativa uma ou várias contas. */
  public desativar = async (req: Request, res: Response) => {
    try {
      const logins = await this.alvos(req);
      if (logins.length === 0) {
        res.status(400).json({ message: "Informe ao menos um login." });
        return;
      }

      const usuario = (req as any).user?.login || "";
      const total = await TvWipService.desativar(
        logins,
        String(req.body?.motivo || "").trim(),
        usuario,
      );

      res.json({
        ok: true,
        desativadas: total,
        message:
          total === 1
            ? "Conta desativada."
            : `${total} conta(s) desativada(s).`,
      });
    } catch (error: any) {
      console.error("[TvWip] Erro ao desativar:", error?.message || error);
      res.status(500).json({ message: "Erro ao desativar a conta." });
    }
  };

  /** Reativa contas — só de quem ainda é cliente ativo. */
  public reativar = async (req: Request, res: Response) => {
    try {
      const logins = this.lerLogins(req.body?.logins ?? req.body?.login);
      if (logins.length === 0) {
        res.status(400).json({ message: "Informe ao menos um login." });
        return;
      }

      const { reativadas, recusadas } = await TvWipService.reativar(logins);
      res.json({
        ok: true,
        reativadas,
        recusadas,
        message: recusadas.length
          ? `${reativadas} reativada(s). Sem efeito para ${recusadas.join(", ")}: não são clientes ativos.`
          : `${reativadas} conta(s) reativada(s).`,
      });
    } catch (error: any) {
      console.error("[TvWip] Erro ao reativar:", error?.message || error);
      res.status(500).json({ message: "Erro ao reativar a conta." });
    }
  };

  /** Roda a varredura na hora, sem esperar o horário agendado. */
  public sincronizar = async (_req: Request, res: Response) => {
    try {
      const resultado = await TvWipService.sincronizar();
      res.json({ ok: true, ...resultado });
    } catch (error: any) {
      console.error("[TvWip] Erro ao sincronizar:", error?.message || error);
      res
        .status(500)
        .json({ message: error?.message || "Erro ao sincronizar a lista." });
    }
  };

  /** Cria uma conta avulsa, para quem não tem cadastro no MKAuth. */
  public criarAvulso = async (req: Request, res: Response) => {
    try {
      const conta = await TvWipService.criarAvulso({
        login: req.body?.login,
        senha: req.body?.senha,
        nome: req.body?.nome,
        observacao: req.body?.observacao,
        criadoPor: (req as any).user?.login || "",
      });
      res.status(201).json({
        ok: true,
        conta,
        message: `Conta avulsa ${conta.login} criada.`,
      });
    } catch (error: any) {
      // Aqui a mensagem é do próprio domínio (login repetido, tem cadastro):
      // vale mostrar ao operador em vez de um "erro interno".
      res.status(400).json({ message: error?.message || "Erro ao criar." });
    }
  };

  /** Apaga uma conta avulsa. */
  public removerAvulso = async (req: Request, res: Response) => {
    try {
      await TvWipService.removerAvulso(String(req.params.login || ""));
      res.json({ ok: true, message: "Conta avulsa removida." });
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao remover." });
    }
  };

  /**
   * Autentica um usuário no aplicativo da TV.
   *
   * Responde sempre 200 com o resultado no corpo: o aplicativo precisa
   * diferenciar "senha errada" de "conta desativada", e alguns clientes HTTP
   * engolem o corpo da resposta em 4xx.
   */
  public autenticar = async (req: Request, res: Response) => {
    try {
      const login = req.body?.login ?? req.body?.usuario ?? req.query?.login;
      const senha = req.body?.senha ?? req.body?.password ?? req.query?.senha;
      const resultado = await TvWipService.autenticar(
        String(login ?? ""),
        String(senha ?? ""),
      );

      // Entrou: já devolve a grade, para o aplicativo não precisar de uma
      // segunda chamada só para montar a lista de canais.
      if (resultado.permitido && resultado.conta) {
        const canais = await TvWipCanaisService.canaisDaConta(
          resultado.conta.login,
        );
        res.json({ ...resultado, canais });
        return;
      }

      res.json(resultado);
    } catch (error: any) {
      console.error("[TvWip] Erro na autenticação:", error?.message || error);
      res.status(500).json({
        permitido: false,
        motivo: "ERRO",
        mensagem: "Erro ao validar o acesso.",
      });
    }
  };

  // ------------------------------------------------- canais e pacotes

  /** Todos os canais do sistema antigo (wip_canais). */
  public listarCanais = async (req: Request, res: Response) => {
    try {
      const apenasAtivos = String(req.query.ativos) === "true";
      res.json({
        canais: await TvWipCanaisService.listarCanais(apenasAtivos),
        // O banco guarda o caminho relativo (canais/logo/x.png); a tela precisa
        // do endereço público do servidor da TV para exibir a imagem.
        logoBase: process.env.TVWIP_LOGO_URL_BASE || "",
      });
    } catch (error: any) {
      console.error("[TvWip] Erro ao listar canais:", error?.message || error);
      res.status(500).json({ message: "Erro ao listar os canais." });
    }
  };

  /**
   * Devolve a logo de um canal passando por este backend.
   *
   * O servidor da TV só responde em HTTP; como o painel roda em HTTPS, o
   * navegador bloqueia a imagem por conteúdo misto. Buscando aqui, ela chega
   * pela mesma origem segura do painel.
   *
   * Sem AuthGuard de propósito: uma tag <img> não envia cabeçalho de
   * autorização. Em compensação o nome do arquivo é validado e o caminho
   * remoto é fixo — não dá para apontar a rota para outro endereço.
   */
  public logoDoCanal = async (req: Request, res: Response) => {
    try {
      const arquivo = decodeURIComponent(String(req.params.arquivo || ""));

      // Nada de subir de diretório nem escapar da pasta das logos.
      if (
        !arquivo ||
        arquivo.includes("/") ||
        arquivo.includes("\\") ||
        arquivo.includes("..")
      ) {
        res.status(400).send("Arquivo inválido.");
        return;
      }

      const raiz = (process.env.TVWIP_LOGO_URL_BASE || "").replace(/\/$/, "");
      if (!raiz) {
        res.status(503).send("TVWIP_LOGO_URL_BASE não configurada.");
        return;
      }

      const alvo = `${raiz}/canais/logo/${encodeURIComponent(arquivo)}`;
      const resposta = await axios.get<ArrayBuffer>(alvo, {
        responseType: "arraybuffer",
        timeout: 15000,
        validateStatus: () => true,
      });

      if (resposta.status !== 200) {
        res.status(404).send("Logo não encontrada.");
        return;
      }

      res.setHeader(
        "Content-Type",
        String(resposta.headers["content-type"] || "image/png"),
      );
      // Logo de canal quase nunca muda; evita repetir a busca a cada rolagem.
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(Buffer.from(resposta.data));
    } catch (error: any) {
      console.error("[TvWip] Erro ao buscar a logo:", error?.message || error);
      res.status(502).send("Erro ao buscar a logo.");
    }
  };

  /**
   * Cria um canal. A logo, quando enviada, vai para o servidor do TV_WIP2 e o
   * caminho relativo devolvido é o que fica gravado em `tb_canais.imagens`.
   */
  public criarCanal = async (req: Request, res: Response) => {
    try {
      const arquivo = (req.files as Express.Multer.File[] | undefined)?.[0];
      let imagens = String(req.body?.imagens || "").trim();

      if (arquivo?.buffer?.length) {
        imagens = await salvarLogo(arquivo.buffer, arquivo.originalname);
      }

      const canal = await TvWipCanaisService.criarCanal({
        canal: req.body?.canal,
        url: req.body?.url,
        imagens,
        ativo: req.body?.ativo !== "false" && req.body?.ativo !== false,
      });
      res.status(201).json({
        ok: true,
        canal,
        message: `Canal ${canal.canal} criado.`,
      });
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao criar." });
    }
  };

  /** Troca só a logo de um canal existente. */
  public enviarLogo = async (req: Request, res: Response) => {
    try {
      const arquivo = (req.files as Express.Multer.File[] | undefined)?.[0];
      if (!arquivo?.buffer?.length) {
        res.status(400).json({ message: "Selecione uma imagem." });
        return;
      }
      const imagens = await salvarLogo(arquivo.buffer, arquivo.originalname);
      const canal = await TvWipCanaisService.salvarCanal(
        Number(req.params.idcanal),
        { imagens },
      );
      res.json({ ok: true, canal, imagens, message: "Logo atualizada." });
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao enviar." });
    }
  };

  public removerCanal = async (req: Request, res: Response) => {
    try {
      await TvWipCanaisService.removerCanal(Number(req.params.idcanal));
      res.json({ ok: true, message: "Canal removido." });
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao remover." });
    }
  };

  /** Guia de programação de um canal, buscada no XUI. */
  public epgDoCanal = async (req: Request, res: Response) => {
    try {
      const limite = Math.min(Number(req.query.limite) || 8, 50);
      res.json(
        await TvWipEpgService.doCanal(Number(req.params.idcanal), limite),
      );
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao buscar EPG." });
    }
  };

  /** Guia de vários canais de uma vez (?ids=1,2,3). */
  public epgDeVarios = async (req: Request, res: Response) => {
    try {
      const ids = String(req.query.ids || "")
        .split(",")
        .map((i) => Number(i.trim()))
        .filter((i) => Number.isFinite(i));
      const limite = Math.min(Number(req.query.limite) || 4, 20);
      res.json({ canais: await TvWipEpgService.deVarios(ids, limite) });
    } catch (error: any) {
      console.error("[TvWip] Erro no EPG:", error?.message || error);
      res.status(500).json({ message: "Erro ao buscar a programação." });
    }
  };

  /** Edita um canal (nome, url, logo, no ar). */
  public salvarCanal = async (req: Request, res: Response) => {
    try {
      const canal = await TvWipCanaisService.salvarCanal(
        Number(req.params.idcanal),
        req.body,
      );
      res.json({ ok: true, canal, message: "Canal atualizado." });
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao salvar." });
    }
  };

  public listarPacotes = async (_req: Request, res: Response) => {
    try {
      res.json({ pacotes: await TvWipCanaisService.listarPacotes() });
    } catch (error: any) {
      console.error("[TvWip] Erro ao listar pacotes:", error?.message || error);
      res.status(500).json({ message: "Erro ao listar os pacotes." });
    }
  };

  public salvarPacote = async (req: Request, res: Response) => {
    try {
      const pacote = await TvWipCanaisService.salvarPacote({
        id: req.body?.id,
        nome: req.body?.nome,
        descricao: req.body?.descricao,
        ativo: req.body?.ativo,
        padrao: req.body?.padrao,
        canais: req.body?.canais,
      });
      res.json({ ok: true, pacote, message: `Pacote ${pacote.nome} salvo.` });
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao salvar." });
    }
  };

  public removerPacote = async (req: Request, res: Response) => {
    try {
      await TvWipCanaisService.removerPacote(Number(req.params.id));
      res.json({ ok: true, message: "Pacote removido." });
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao remover." });
    }
  };

  /** Aplica pacotes a várias contas de uma vez. */
  public atribuirPacotes = async (req: Request, res: Response) => {
    try {
      const modo = String(req.body?.modo || "adicionar") as
        | "adicionar"
        | "substituir"
        | "remover";
      const r = await TvWipCanaisService.atribuirPacotes(
        await this.alvos(req),
        Array.isArray(req.body?.pacotes) ? req.body.pacotes : [],
        modo,
      );
      res.json({
        ok: true,
        ...r,
        message:
          `${r.contas} conta(s): ${r.vinculosCriados} vínculo(s) criado(s), ` +
          `${r.vinculosRemovidos} removido(s).`,
      });
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao atribuir." });
    }
  };

  /** Situação de um cliente: pacotes, exceções e a grade resultante. */
  public detalhesDaConta = async (req: Request, res: Response) => {
    try {
      const login = String(req.params.login || "").trim();
      const [pacotes, excecoes, canais] = await Promise.all([
        TvWipCanaisService.pacotesDasContas([login]),
        TvWipCanaisService.excecoesDaConta(login),
        TvWipCanaisService.canaisDaConta(login),
      ]);
      res.json({
        login,
        pacotes: pacotes.get(login) ?? [],
        excecoes,
        canais,
      });
    } catch (error: any) {
      console.error("[TvWip] Erro nos detalhes:", error?.message || error);
      res.status(500).json({ message: "Erro ao carregar os detalhes." });
    }
  };

  /** Libera ou bloqueia um canal para um cliente específico. */
  public definirExcecao = async (req: Request, res: Response) => {
    try {
      const permitido =
        req.body?.permitido === null || req.body?.permitido === undefined
          ? null
          : !!req.body.permitido;
      await TvWipCanaisService.definirExcecao(
        String(req.params.login || ""),
        Number(req.body?.idcanal),
        permitido,
      );
      res.json({ ok: true, message: "Exceção atualizada." });
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao salvar." });
    }
  };

  /**
   * Contas alvo de uma ação: a lista marcada na tela, ou — com
   * `todos: true` — tudo que casa com o filtro atual, sem o navegador
   * precisar mandar milhares de logins.
   */
  private async alvos(req: Request): Promise<string[]> {
    if (req.body?.todos) {
      return TvWipService.loginsDoFiltro({
        situacao: req.body?.situacao,
        busca: req.body?.busca,
      });
    }
    return this.lerLogins(req.body?.logins ?? req.body?.login);
  }

  /** Aceita um login só ou uma lista, sempre devolvendo um array limpo. */
  private lerLogins(entrada: unknown): string[] {
    const bruto = Array.isArray(entrada) ? entrada : [entrada];
    return Array.from(
      new Set(
        bruto
          .map((item) => String(item ?? "").trim())
          .filter((item) => item.length > 0),
      ),
    );
  }
}

export default new TvWip();
