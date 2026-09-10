import { Request, Response } from "express";
import MkauthSource from "../database/MkauthSource";
import AppDataSource from "../database/DataSource";
import { In } from "typeorm";
import { SisSerContratos } from "../entities/SisSerContratos";
import { ClientesEntities } from "../entities/ClientesEntities";
import { StreamingAssinante } from "../entities/StreamingAssinante";
import { deleteTicket } from "../services/WatchBrasilService";
import { registrarAssinanteStreaming } from "../services/streamingCadastro";
import { planFor, normalizeStorageGb } from "../config/cameraStoragePlans";
import {
  VALOR_STREAMER,
  VALOR_STREAMER_COLAB,
  nomeStreaming,
  nomeStreamingColab,
} from "../config/servicosAdicionais";
import {
  buscarResumoCameraDeUmLogin,
  nomeServicoContrato,
  buscarResumoCameras,
  nomeContratoParaGravar,
  storageGbDoValor,
  tagDoServico,
  sqlTagServico,
} from "../services/servicosAdicionaisNomes";

/** Rótulo curto do serviço para mensagens de erro (nunca a tag crua). */
const rotuloServico = (tipo: string): string =>
  tipo === "CAMERA"
    ? "Gravação em Nuvem"
    : tipo === "STREAMER_COLAB"
      ? "WatchTV Brasil Colaborador"
      : "WatchTV Brasil";

const VALORES: Record<string, number> = {
  STREAMER: VALOR_STREAMER,
  STREAMER_COLAB: VALOR_STREAMER_COLAB,
  CAMERA: 20.0,
};

const CFOP_DEFAULT = "5949";

// CAMERA é único por login (1 "tag" por cliente, como o streaming). A quantidade
// de câmeras em si é ilimitada e configurada pelo cliente no portal de câmeras.
const UNIQUE_PER_LOGIN = new Set(["STREAMER", "STREAMER_COLAB", "CAMERA"]);
const STREAMING_TYPES = new Set(["STREAMER", "STREAMER_COLAB"]);

class SerContratos {
  /**
   * GET /clientes — quem já tem streaming ou câmera contratados.
   *
   * A tela abre com essa lista para o atendente não precisar saber o login de
   * cor; a busca por login continua existindo para casos pontuais.
   */
  public async listarClientes(req: Request, res: Response) {
    try {
      const busca = String(req.query.busca || "").trim();
      const limite = Math.min(Number(req.query.limite) || 100, 300);

      const repo = MkauthSource.getRepository(SisSerContratos);
      const qb = repo
        .createQueryBuilder("s")
        .select("s.login", "login")
        .addSelect(`GROUP_CONCAT(DISTINCT ${sqlTagServico("s.nome")})`, "servicos")
        .addSelect("SUM(s.valor)", "total")
        .addSelect("MAX(s.data)", "ultima")
        .where(`${sqlTagServico("s.nome")} IN (:...tipos)`, {
          tipos: Object.keys(VALORES),
        })
        .groupBy("s.login")
        .orderBy("ultima", "DESC")
        .limit(limite);

      if (busca) {
        qb.andWhere("s.login LIKE :busca", { busca: `%${busca}%` });
      }

      const linhas = await qb.getRawMany();
      if (linhas.length === 0) {
        res.json({ clientes: [] });
        return;
      }

      // Nome do cliente vem do cadastro; um SELECT só para todos os logins.
      const clientes = await MkauthSource.getRepository(ClientesEntities).find({
        select: { login: true, nome: true, cli_ativado: true },
        where: { login: In(linhas.map((l) => l.login)) },
      });
      const porLogin = new Map(clientes.map((c) => [c.login, c]));

      res.json({
        clientes: linhas.map((l) => ({
          login: l.login,
          nome: porLogin.get(l.login)?.nome ?? null,
          ativo: porLogin.get(l.login)?.cli_ativado === "s",
          servicos: String(l.servicos || "").split(",").filter(Boolean),
          total: Number(Number(l.total || 0).toFixed(2)),
          ultima: l.ultima,
        })),
      });
    } catch (error: any) {
      console.error("Erro ao listar clientes com serviços:", error);
      res.status(500).json({ message: "Erro ao listar os clientes." });
    }
  }

  public async listByLogin(req: Request, res: Response) {
    try {
      const login = String(req.params.login || "").trim();
      if (!login) {
        res.status(400).json({ message: "login é obrigatório." });
        return;
      }
      const clienteRepo = MkauthSource.getRepository(ClientesEntities);
      const cliente = await clienteRepo.findOne({
        where: { login },
        select: { login: true },
      });
      if (!cliente) {
        res.status(404).json({ message: "Cliente não cadastrado." });
        return;
      }
      const repo = MkauthSource.getRepository(SisSerContratos);
      const items = await repo.find({
        where: { login },
        order: { id: "ASC" },
      });
      const total = items.reduce((a, c) => a + Number(c.valor || 0), 0);

      // Assinatura de teste em andamento, para a tela mostrar o prazo.
      const assinante = await AppDataSource.getRepository(
        StreamingAssinante,
      ).findOne({ where: { login } });

      // Conta de câmeras do cliente (banco wip_cams): a quantidade de canais
      // gravando e a cota compartilhada montam o nome comercial do serviço.
      const resumoCamera = await buscarResumoCameraDeUmLogin(login);
      const valorCameraContrato = items
        .filter((i) => tagDoServico(i.nome) === "CAMERA")
        .reduce((a, c) => a + Number(c.valor || 0), 0);

      res.json({
        login,
        // Cada item já vem com a descrição completa pronta para exibir.
        items: items.map((i) => ({
          ...i,
          // `tag` é o tipo do serviço; `nome` agora guarda a descrição que sai
          // no boleto, então a tela não pode mais comparar por ele.
          tag: tagDoServico(i.nome),
          nomeExibicao: nomeServicoContrato(i.nome, Number(i.valor || 0), resumoCamera),
        })),
        total: Number(total.toFixed(2)),
        valoresUnitarios: VALORES,
        streamingTesteExpiraEm: assinante?.teste_expira_em ?? null,
        camera: resumoCamera,
        nomesServicos: {
          STREAMER: nomeStreaming(VALORES.STREAMER),
          STREAMER_COLAB: nomeStreamingColab(),
          CAMERA: nomeServicoContrato("CAMERA", valorCameraContrato, resumoCamera),
        },
      });
    } catch (error: any) {
      console.error("Erro ao listar sercontratos:", error);
      res.status(500).json({ message: "Erro ao consultar." });
    }
  }

  public async add(req: Request, res: Response) {
    try {
      const {
        login,
        tipo,
        quantidade,
        email: emailForm,
        phone: phoneForm,
        replace,
        storageGb,
        teste,
      } = req.body as {
        login?: string;
        tipo?: string;
        quantidade?: number;
        email?: string;
        phone?: string;
        replace?: boolean;
        storageGb?: number;
        /** Assinatura de teste: prazo em dias/horas/minutos. */
        teste?: { dias?: number; horas?: number; minutos?: number };
      };
      const usuario = (req as any).user?.username || "sistema";

      if (!login?.trim() || !tipo?.trim()) {
        res
          .status(400)
          .json({ message: "login e tipo são obrigatórios." });
        return;
      }

      const tipoNorm = tipo.trim().toUpperCase();
      if (!(tipoNorm in VALORES)) {
        res.status(400).json({
          message: `Tipo inválido. Use: ${Object.keys(VALORES).join(", ")}`,
        });
        return;
      }

      // Assinatura de teste: some sozinha quando o prazo acaba.
      const minutosTeste =
        (Math.max(0, Number(teste?.dias) || 0) * 24 * 60) +
        (Math.max(0, Number(teste?.horas) || 0) * 60) +
        Math.max(0, Number(teste?.minutos) || 0);
      if (minutosTeste > 0 && !STREAMING_TYPES.has(tipoNorm)) {
        res.status(400).json({
          message: "Período de teste só vale para os serviços de streaming.",
        });
        return;
      }
      const expiraTeste =
        minutosTeste > 0
          ? new Date(Date.now() + minutosTeste * 60_000)
          : null;

      const ClientRepo = MkauthSource.getRepository(ClientesEntities);
      const cliente = await ClientRepo.findOne({ where: { login } });
      if (!cliente) {
        res.status(404).json({ message: "Cliente não encontrado." });
        return;
      }

      // STREAMER pago: limpa títulos em aberto fora do mês atual — mas só os
      // "seguros" (sem remessa CNAB e sem chave de gateway). Os registrados são
      // listados pra tratamento manual. Não se aplica ao COLAB (grátis não
      // altera valor de fatura).
      //
      // Cliente com mensalidade vencida não é mais barrado aqui: a regra saiu
      // a pedido do negócio.
      if (tipoNorm === "STREAMER") {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const inicioProx = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        const dataIniMes = fmt(inicioMes);
        const dataIniProx = fmt(inicioProx);

        // Lista títulos em aberto fora do mês atual
        const abertosForaMes = (await MkauthSource.query(
          `SELECT id, datavenc, valor, nossonum, gerourem,
                  chave_gnet, chave_juno, chave_galaxpay, chave_iugu, chave_bfacil,
                  codigo_barras
             FROM sis_lanc
            WHERE UPPER(TRIM(login)) = UPPER(TRIM(?))
              AND status = 'aberto'
              AND (deltitulo = 0 OR deltitulo IS NULL)
              AND (DATE(datavenc) < ? OR DATE(datavenc) >= ?)`,
          [login, dataIniMes, dataIniProx],
        )) as any[];

        const registrados = abertosForaMes.filter(
          (t) =>
            Number(t.gerourem) === 1 ||
            t.chave_gnet ||
            t.chave_juno ||
            t.chave_galaxpay ||
            t.chave_iugu ||
            t.chave_bfacil,
        );
        const seguros = abertosForaMes.filter((t) => !registrados.includes(t));

        let removidos = 0;
        if (seguros.length > 0) {
          const ids = seguros.map((t) => t.id);
          const result = await MkauthSource.query(
            `DELETE FROM sis_lanc WHERE id IN (${ids.map(() => "?").join(",")})`,
            ids,
          );
          removidos = (result as any)?.affectedRows ?? seguros.length;
        }

        // Anexa no objeto pra responder no final
        (res as any).locals = (res as any).locals || {};
        (res as any).locals.faturasLimpeza = {
          removidos,
          registradosPendentes: registrados.map((t) => ({
            id: t.id,
            datavenc: t.datavenc,
            valor: t.valor,
            nossonum: t.nossonum,
            motivo:
              Number(t.gerourem) === 1
                ? "remessa CNAB já enviada"
                : "cobrança registrada em gateway",
          })),
        };
      }

      const repo = MkauthSource.getRepository(SisSerContratos);

      const countExisting = async (l: string, tipo: string) =>
        repo
          .createQueryBuilder("s")
          .where("UPPER(TRIM(s.login)) = UPPER(TRIM(:l))", { l })
          .andWhere(`${sqlTagServico("s.nome")} = :tipo`, { tipo })
          .getCount();

      // Streamer e Streamer Colaborador são mutuamente exclusivos.
      // Se já houver qualquer um dos dois e não tiver "replace=true", bloqueia.
      // Com replace=true, remove o anterior (e ticket Watch Brasil) antes de inserir.
      if (STREAMING_TYPES.has(tipoNorm)) {
        const existing = await repo
          .createQueryBuilder("s")
          .where("UPPER(TRIM(s.login)) = UPPER(TRIM(:l))", { l: login })
          .andWhere(`${sqlTagServico("s.nome")} IN (:...tipos)`, {
            tipos: Array.from(STREAMING_TYPES),
          })
          .getMany();

        if (existing.length > 0) {
          if (!replace) {
            const atual = tagDoServico(existing[0].nome);
            res.status(409).json({
              message: `Cliente já possui ${atual}. Confirme a substituição.`,
              code: "STREAMING_REPLACE_REQUIRED",
              currentType: atual,
            });
            return;
          }
          // Remove streaming(s) anterior(es)
          try {
            const streamingRepo = AppDataSource.getRepository(StreamingAssinante);
            const assinante = await streamingRepo.findOne({
              where: { login: cliente.login },
            });
            if (assinante?.ticket) {
              try {
                await deleteTicket(assinante.ticket);
              } catch (e: any) {
                console.error(
                  "Falha ao remover ticket Watch Brasil ao substituir:",
                  e?.message,
                );
              }
            }
            if (assinante) await streamingRepo.delete(assinante.id);
          } catch (e: any) {
            console.error("Erro ao limpar streaming anterior:", e?.message);
          }
          await repo
            .createQueryBuilder()
            .delete()
            .from(SisSerContratos)
            .where("UPPER(TRIM(login)) = UPPER(TRIM(:l))", { l: login })
            .andWhere(`${sqlTagServico("nome")} IN (:...tipos)`, {
              tipos: Array.from(STREAMING_TYPES),
            })
            .execute();
        }
      } else if (UNIQUE_PER_LOGIN.has(tipoNorm)) {
        const total = await countExisting(login, tipoNorm);
        if (total > 0) {
          res.status(409).json({
            message: `Cliente já possui ${rotuloServico(tipoNorm)}. Esse serviço é único por cliente.`,
          });
          return;
        }
      }


      const qtd = Math.max(1, Math.min(Number(quantidade) || 1, 20));
      // CAMERA: o valor cobrado vem do plano de armazenamento escolhido
      // (5GB=R$20, 10GB=R$30, 15GB=R$35, 20GB=R$40). Demais tipos: valor fixo.
      const valorUnitario = expiraTeste
        ? // Teste não entra na mensalidade; se o cliente ficar, o serviço é
          // recadastrado depois pelo valor cheio.
          0
        : tipoNorm === "CAMERA"
          ? planFor(normalizeStorageGb(storageGb))!.priceBRL
          : VALORES[tipoNorm];

      // O boleto do mkauth imprime este campo literalmente ("Valor adicional:
      // <nome>"), então o que vai gravado é a descrição comercial — a tag do
      // tipo continua sendo deduzida dela por `tagDoServico`.
      const nomeContrato = nomeContratoParaGravar(
        tipoNorm,
        valorUnitario,
        tipoNorm === "CAMERA" ? normalizeStorageGb(storageGb) : undefined,
      );

      // STREAMER / STREAMER_COLAB: valida na Watch Brasil ANTES de gravar local
      let streamingInfo: any = null;
      if (STREAMING_TYPES.has(tipoNorm)) {
        const emailUse = (emailForm || cliente.email || "").trim();
        const phoneUse = ((phoneForm || cliente.celular || cliente.fone || "") + "")
          .replace(/\D/g, "");
        if (!emailUse) {
          res.status(400).json({ message: "Email é obrigatório para streaming." });
          return;
        }
        if (!phoneUse) {
          res.status(400).json({ message: "Celular é obrigatório para streaming." });
          return;
        }
        try {
          // Mesmo registro usado quando o cliente assina o Contrato de SVA
          // sozinho, pelo bot ou pelo site.
          streamingInfo = await registrarAssinanteStreaming({
            cliente,
            email: emailUse,
            phone: phoneUse,
            expiraTeste,
          });
        } catch (e: any) {
          console.error(
            "Erro ao criar assinante Watch Brasil:",
            e?.response?.status,
            e?.response?.data || e?.message,
          );
          res.status(502).json({
            message:
              "Falha ao registrar streaming na Watch Brasil. Nada foi gravado.",
            detail:
              e?.response?.data?.ErrorMessage ||
              e?.response?.data?.message ||
              e?.response?.data ||
              e?.message ||
              "erro desconhecido",
          });
          return;
        }
      }

      const saved = await MkauthSource.transaction(async (manager) => {
        const trxRepo = manager.getRepository(SisSerContratos);

        if (UNIQUE_PER_LOGIN.has(tipoNorm)) {
          const qb = trxRepo
            .createQueryBuilder("s")
            .where("UPPER(TRIM(s.login)) = UPPER(TRIM(:l))", { l: login });
          if (STREAMING_TYPES.has(tipoNorm)) {
            qb.andWhere(`${sqlTagServico("s.nome")} IN (:...tipos)`, {
              tipos: Array.from(STREAMING_TYPES),
            });
          } else {
            qb.andWhere(`${sqlTagServico("s.nome")} = :tipo`, { tipo: tipoNorm });
          }
          const recheck = await qb.getCount();
          if (recheck > 0) {
            throw new Error("UNIQUE_VIOLATION");
          }
        }

        const novos: SisSerContratos[] = [];
        for (let i = 0; i < qtd; i++) {
          const item = trxRepo.create({
            cfop_serc: CFOP_DEFAULT,
            nome: nomeContrato,
            valor: valorUnitario,
            incluir: "sim",
            data: new Date(),
            insuser: usuario,
            login,
          });
          novos.push(item);
          if (UNIQUE_PER_LOGIN.has(tipoNorm)) break;
        }
        return trxRepo.save(novos);
      }).catch((e) => {
        if (e?.message === "UNIQUE_VIOLATION") {
          throw {
            status: 409,
            message: `Cliente já possui ${rotuloServico(tipoNorm)}. Esse serviço é único por cliente.`,
          };
        }
        throw e;
      });

      const faturasLimpeza = (res as any).locals?.faturasLimpeza;
      res.status(201).json({
        message: expiraTeste
          ? `Teste liberado até ${expiraTeste.toLocaleString("pt-BR")}.`
          : `${saved.length} item(ns) adicionado(s).`,
        items: saved,
        streaming: streamingInfo,
        teste_expira_em: expiraTeste,
        ...(faturasLimpeza ? { faturasLimpeza } : {}),
      });
    } catch (error: any) {
      if (error?.status === 409) {
        res.status(409).json({ message: error.message });
        return;
      }
      console.error("Erro ao adicionar sercontratos:", error);
      res
        .status(500)
        .json({ message: "Erro ao adicionar serviço.", error: error?.message });
    }
  }

  public async remove(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id) {
        res.status(400).json({ message: "id inválido." });
        return;
      }
      const repo = MkauthSource.getRepository(SisSerContratos);
      const item = await repo.findOne({ where: { id } });
      if (!item) {
        res.status(404).json({ message: "Item não encontrado." });
        return;
      }

      // Se for STREAMER ou STREAMER_COLAB, derruba na Watch Brasil também
      let streamingNote: string | null = null;
      if (STREAMING_TYPES.has(tagDoServico(item.nome))) {
        try {
          const streamingRepo =
            AppDataSource.getRepository(StreamingAssinante);
          const assinante = await streamingRepo.findOne({
            where: { login: item.login },
          });
          if (assinante?.ticket) {
            await deleteTicket(assinante.ticket);
          }
          if (assinante) await streamingRepo.delete(assinante.id);
        } catch (e: any) {
          console.error("Erro ao remover ticket Watch Brasil:", e?.message);
          streamingNote =
            "Removido localmente mas falhou remoção na Watch Brasil: " +
            (e?.response?.data?.message || e?.message || "erro");
        }
      }

      await repo.delete(id);
      res.json({ ok: true, streaming: streamingNote });
    } catch (error: any) {
      console.error("Erro ao remover sercontratos:", error);
      res.status(500).json({ message: "Erro ao remover." });
    }
  }

  // Troca apenas a tag entre STREAMER e STREAMER_COLAB sem mexer no
  // Watch Brasil. A conta do cliente permanece ativa; apenas o nome e o
  // valor do serviço mudam (pago <-> grátis).
  public async convertStreamingTipo(req: Request, res: Response) {
    try {
      const login = String(req.body?.login || "").trim();
      const novoTipoRaw = String(req.body?.novoTipo || "").trim().toUpperCase();
      if (!login || !novoTipoRaw) {
        res.status(400).json({ message: "login e novoTipo obrigatórios." });
        return;
      }
      if (!STREAMING_TYPES.has(novoTipoRaw)) {
        res.status(400).json({
          message: "novoTipo deve ser STREAMER ou STREAMER_COLAB.",
        });
        return;
      }
      const repo = MkauthSource.getRepository(SisSerContratos);
      const atuais = await repo
        .createQueryBuilder("s")
        .where("UPPER(TRIM(s.login)) = UPPER(TRIM(:l))", { l: login })
        .andWhere(`${sqlTagServico("s.nome")} IN (:...tipos)`, {
          tipos: Array.from(STREAMING_TYPES),
        })
        .getMany();

      if (atuais.length === 0) {
        res.status(404).json({
          message: "Cliente não possui streaming para converter.",
        });
        return;
      }
      const ja = atuais.find((a) => tagDoServico(a.nome) === novoTipoRaw);
      if (ja && atuais.length === 1) {
        res.status(409).json({
          message: `Cliente já está como ${novoTipoRaw}.`,
        });
        return;
      }

      const novoValor = VALORES[novoTipoRaw];
      const result = await repo
        .createQueryBuilder()
        .update(SisSerContratos)
        .set({
          nome: nomeContratoParaGravar(novoTipoRaw, novoValor),
          valor: novoValor,
        })
        .where("UPPER(TRIM(login)) = UPPER(TRIM(:l))", { l: login })
        .andWhere(`${sqlTagServico("nome")} IN (:...tipos)`, {
          tipos: Array.from(STREAMING_TYPES),
        })
        .execute();

      res.json({
        ok: true,
        updated: result.affected || 0,
        novoTipo: novoTipoRaw,
        novoValor,
      });
    } catch (error: any) {
      console.error("Erro ao converter tipo de streaming:", error);
      res.status(500).json({ message: "Erro ao converter streaming." });
    }
  }

  /**
   * Regrava os contratos antigos que ainda guardam a tag crua ("CAMERA",
   * "STREAMER") com o nome comercial completo — é esse campo que o boleto do
   * mkauth imprime. Sem `?aplicar=1` a chamada só mostra o que mudaria.
   */
  public async detalharNomes(req: Request, res: Response) {
    try {
      const aplicar = String(req.query.aplicar || "") === "1";
      const repo = MkauthSource.getRepository(SisSerContratos);
      const itens = await repo
        .createQueryBuilder("s")
        .where(`${sqlTagServico("s.nome")} IN (:...tipos)`, {
          tipos: Object.keys(VALORES),
        })
        .getMany();

      // A cota de cada cliente vem da conta de câmeras; sem ela, é deduzida
      // do valor cobrado no próprio contrato.
      const resumos = await buscarResumoCameras(itens.map((i) => i.login));

      const mudancas: {
        id: number;
        login: string;
        de: string;
        para: string;
      }[] = [];
      for (const item of itens) {
        const tag = tagDoServico(item.nome);
        const valor = Number(item.valor || 0);
        const gb =
          tag === "CAMERA"
            ? (resumos.get(String(item.login || "").trim().toUpperCase())
                ?.storageGb ?? storageGbDoValor(valor))
            : undefined;
        const novo = nomeContratoParaGravar(tag, valor, gb);
        if (novo && novo !== String(item.nome || "").trim()) {
          mudancas.push({ id: item.id, login: item.login, de: item.nome, para: novo });
        }
      }

      if (aplicar) {
        for (const m of mudancas) {
          await repo.update(m.id, { nome: m.para });
        }
      }

      res.json({
        analisados: itens.length,
        alteracoes: mudancas.length,
        aplicado: aplicar,
        itens: mudancas.slice(0, 300),
      });
    } catch (error: any) {
      console.error("Erro ao detalhar nomes dos serviços:", error);
      res.status(500).json({ message: "Erro ao detalhar os nomes." });
    }
  }

  public async removeAllOfTypeForLogin(req: Request, res: Response) {
    try {
      const login = String(req.body?.login || "").trim();
      const tipo = String(req.body?.tipo || "").trim().toUpperCase();
      if (!login || !tipo) {
        res.status(400).json({ message: "login e tipo obrigatórios." });
        return;
      }
      const repo = MkauthSource.getRepository(SisSerContratos);
      const result = await repo
        .createQueryBuilder()
        .delete()
        .from(SisSerContratos)
        .where("UPPER(TRIM(login)) = UPPER(TRIM(:l))", { l: login })
        .andWhere(`${sqlTagServico("nome")} = :tipo`, { tipo })
        .execute();
      res.json({ removed: result.affected || 0 });
    } catch (error: any) {
      console.error("Erro ao remover em lote:", error);
      res.status(500).json({ message: "Erro ao remover em lote." });
    }
  }
}

export default new SerContratos();
