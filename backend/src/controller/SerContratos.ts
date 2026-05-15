import { Request, Response } from "express";
import MkauthSource from "../database/MkauthSource";
import { SisSerContratos } from "../entities/SisSerContratos";
import { ClientesEntities } from "../entities/ClientesEntities";

const VALORES: Record<string, number> = {
  STREAMER: 39.9,
  CAMERA: 20.0,
};

const CFOP_DEFAULT = "5949";

const UNIQUE_PER_LOGIN = new Set(["STREAMER"]);

class SerContratos {
  public async listByLogin(req: Request, res: Response) {
    try {
      const login = String(req.params.login || "").trim();
      if (!login) {
        res.status(400).json({ message: "login é obrigatório." });
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
      const { login, tipo, quantidade } = req.body as {
        login?: string;
        tipo?: string;
        quantidade?: number;
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

      if (UNIQUE_PER_LOGIN.has(tipoNorm)) {
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

      const saved = await MkauthSource.transaction(async (manager) => {
        const trxRepo = manager.getRepository(SisSerContratos);

        if (UNIQUE_PER_LOGIN.has(tipoNorm)) {
          const recheck = await trxRepo
            .createQueryBuilder("s")
            .where("UPPER(TRIM(s.login)) = UPPER(TRIM(:l))", { l: login })
            .andWhere("UPPER(TRIM(s.nome)) = :tipo", { tipo: tipoNorm })
            .getCount();
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
      await repo.delete(id);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Erro ao remover sercontratos:", error);
      res.status(500).json({ message: "Erro ao remover." });
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
