import { Request, Response } from "express";
import MkauthSource from "../database/MkauthSource";
import AppDataSource from "../database/DataSource";
import { SisSerContratos } from "../entities/SisSerContratos";
import { ClientesEntities } from "../entities/ClientesEntities";
import { StreamingAssinante } from "../entities/StreamingAssinante";
import {
  insertAssinante,
  deleteTicket,
} from "../services/WatchBrasilService";

const VALORES: Record<string, number> = {
  STREAMER: 39.9,
  STREAMER_COLAB: 0,
  CAMERA: 20.0,
};

const CFOP_DEFAULT = "5949";

const UNIQUE_PER_LOGIN = new Set(["STREAMER", "STREAMER_COLAB"]);
const STREAMING_TYPES = new Set(["STREAMER", "STREAMER_COLAB"]);

class SerContratos {
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
      res.json({
        login,
        items,
        total: Number(total.toFixed(2)),
        valoresUnitarios: VALORES,
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
      } = req.body as {
        login?: string;
        tipo?: string;
        quantidade?: number;
        email?: string;
        phone?: string;
        replace?: boolean;
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

      const ClientRepo = MkauthSource.getRepository(ClientesEntities);
      const cliente = await ClientRepo.findOne({ where: { login } });
      if (!cliente) {
        res.status(404).json({ message: "Cliente não encontrado." });
        return;
      }

      const repo = MkauthSource.getRepository(SisSerContratos);

      const countExisting = async (l: string, tipo: string) =>
        repo
          .createQueryBuilder("s")
          .where("UPPER(TRIM(s.login)) = UPPER(TRIM(:l))", { l })
          .andWhere("UPPER(TRIM(s.nome)) = :tipo", { tipo })
          .getCount();

      // Streamer e Streamer Colaborador são mutuamente exclusivos.
      // Se já houver qualquer um dos dois e não tiver "replace=true", bloqueia.
      // Com replace=true, remove o anterior (e ticket Watch Brasil) antes de inserir.
      if (STREAMING_TYPES.has(tipoNorm)) {
        const existing = await repo
          .createQueryBuilder("s")
          .where("UPPER(TRIM(s.login)) = UPPER(TRIM(:l))", { l: login })
          .andWhere("UPPER(TRIM(s.nome)) IN (:...tipos)", {
            tipos: Array.from(STREAMING_TYPES),
          })
          .getMany();

        if (existing.length > 0) {
          if (!replace) {
            const atual = (existing[0].nome || "").toUpperCase();
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
            .andWhere("UPPER(TRIM(nome)) IN (:...tipos)", {
              tipos: Array.from(STREAMING_TYPES),
            })
            .execute();
        }
      } else if (UNIQUE_PER_LOGIN.has(tipoNorm)) {
        const total = await countExisting(login, tipoNorm);
        if (total > 0) {
          res.status(409).json({
            message: `Cliente já possui ${tipoNorm}. Esse serviço é único por cliente.`,
          });
          return;
        }
      }


      const qtd = Math.max(1, Math.min(Number(quantidade) || 1, 20));
      const valorUnitario = VALORES[tipoNorm];

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
        const assinanteIDIntegracao = String(cliente.id);
        try {
          const apiResp = await insertAssinante({
            email: emailUse,
            assinanteIDIntegracao,
            phone: phoneUse,
          });
          console.log("[WatchBrasil][insertAssinante] resposta:", apiResp);
          if (apiResp?.HasError === true) {
            throw new Error(
              "Watch Brasil HasError: " +
                (apiResp?.ErrorMessage || JSON.stringify(apiResp).slice(0, 300)),
            );
          }
          const ticket =
            apiResp?.ticket ||
            apiResp?.pTicket ||
            apiResp?.data?.ticket ||
            apiResp?.Result?.ticket ||
            apiResp?.Result?.[0]?.ticket ||
            null;
          const chave =
            apiResp?.chave ||
            apiResp?.Result?.chave ||
            apiResp?.Result?.[0]?.chave ||
            null;

          const streamingRepo =
            AppDataSource.getRepository(StreamingAssinante);
          let assinante = await streamingRepo.findOne({
            where: { login: cliente.login },
          });
          if (!assinante) {
            assinante = streamingRepo.create({ login: cliente.login });
          }
          assinante.email = emailUse;
          assinante.phone = phoneUse;
          assinante.assinante_id_integracao = assinanteIDIntegracao;
          assinante.ticket = ticket || assinante.ticket;
          assinante.chave = chave || assinante.chave;
          assinante.ativo = true;
          assinante.last_response = JSON.stringify(apiResp).slice(0, 2000);
          await streamingRepo.save(assinante);
          streamingInfo = { ticket, chave, assinante };
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
            qb.andWhere("UPPER(TRIM(s.nome)) IN (:...tipos)", {
              tipos: Array.from(STREAMING_TYPES),
            });
          } else {
            qb.andWhere("UPPER(TRIM(s.nome)) = :tipo", { tipo: tipoNorm });
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
            nome: tipoNorm,
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
            message: `Cliente já possui ${tipoNorm}. Esse serviço é único por cliente.`,
          };
        }
        throw e;
      });

      res.status(201).json({
        message: `${saved.length} item(ns) adicionado(s).`,
        items: saved,
        streaming: streamingInfo,
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
      if (STREAMING_TYPES.has((item.nome || "").toUpperCase())) {
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
        .andWhere("UPPER(TRIM(s.nome)) IN (:...tipos)", {
          tipos: Array.from(STREAMING_TYPES),
        })
        .getMany();

      if (atuais.length === 0) {
        res.status(404).json({
          message: "Cliente não possui streaming para converter.",
        });
        return;
      }
      const ja = atuais.find((a) => (a.nome || "").toUpperCase() === novoTipoRaw);
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
        .set({ nome: novoTipoRaw, valor: novoValor })
        .where("UPPER(TRIM(login)) = UPPER(TRIM(:l))", { l: login })
        .andWhere("UPPER(TRIM(nome)) IN (:...tipos)", {
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

  public async removeAllOfTypeForLogin(req: Request, res: Response) {
    try {
      const login = String(req.body?.login || "").trim();
      const tipo = String(req.body?.tipo || "").trim().toUpperCase();
      if (!login || !tipo) {
        res.status(400).json({ message: "login e tipo obrigatórios." });
        return;
      }
      const repo = MkauthSource.getRepository(SisSerContratos);
      const result = await repo.delete({ login, nome: tipo });
      res.json({ removed: result.affected || 0 });
    } catch (error: any) {
      console.error("Erro ao remover em lote:", error);
      res.status(500).json({ message: "Erro ao remover em lote." });
    }
  }
}

export default new SerContratos();
