import { Request, Response } from "express";
import AppDataSource from "../database/DataSource";
import { StreamingAssinante } from "../entities/StreamingAssinante";
import {
  editPhone,
  updateTicketStatus,
  deleteTicket,
} from "../services/WatchBrasilService";

class Streaming {
  public async list(_req: Request, res: Response) {
    try {
      const repo = AppDataSource.getRepository(StreamingAssinante);
      const items = await repo.find({ order: { id: "DESC" } });
      res.json({ total: items.length, items });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ message: "Erro ao listar streaming." });
    }
  }

  public async getByLogin(req: Request, res: Response) {
    try {
      const login = String(req.params.login || "").trim();
      const repo = AppDataSource.getRepository(StreamingAssinante);
      const item = await repo.findOne({ where: { login } });
      if (!item) {
        res.status(404).json({ message: "Não encontrado." });
        return;
      }
      res.json(item);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ message: "Erro ao consultar." });
    }
  }

  public async updatePhone(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { phone } = req.body as { phone?: string };
      if (!id || !phone?.trim()) {
        res.status(400).json({ message: "id e phone obrigatórios." });
        return;
      }
      const repo = AppDataSource.getRepository(StreamingAssinante);
      const assinante = await repo.findOne({ where: { id } });
      if (!assinante) {
        res.status(404).json({ message: "Não encontrado." });
        return;
      }

      let remoteResp: any = null;
      try {
        remoteResp = await editPhone({
          email: assinante.email || "",
          phone: phone.trim(),
          pacote: assinante.pacote || undefined,
        });
      } catch (e: any) {
        console.error("Erro editPhone Watch Brasil:", e?.message);
      }

      assinante.phone = phone.trim();
      assinante.last_response = JSON.stringify(remoteResp || {}).slice(0, 2000);
      await repo.save(assinante);
      res.json({ ok: true, assinante, remoteResp });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ message: "Erro ao atualizar telefone." });
    }
  }

  public async toggleStatus(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { ativo } = req.body as { ativo?: boolean };
      if (!id || typeof ativo !== "boolean") {
        res.status(400).json({ message: "id e ativo (bool) obrigatórios." });
        return;
      }
      const repo = AppDataSource.getRepository(StreamingAssinante);
      const assinante = await repo.findOne({ where: { id } });
      if (!assinante) {
        res.status(404).json({ message: "Não encontrado." });
        return;
      }
      if (!assinante.ticket) {
        res.status(400).json({ message: "Assinante sem ticket cadastrado." });
        return;
      }
      const remoteResp = await updateTicketStatus(assinante.ticket, ativo);
      assinante.ativo = ativo;
      assinante.last_response = JSON.stringify(remoteResp || {}).slice(0, 2000);
      await repo.save(assinante);
      res.json({ ok: true, assinante, remoteResp });
    } catch (e: any) {
      console.error(e);
      res
        .status(500)
        .json({ message: "Erro ao alterar status.", error: e?.message });
    }
  }

  public async remove(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id) {
        res.status(400).json({ message: "id obrigatório." });
        return;
      }
      const repo = AppDataSource.getRepository(StreamingAssinante);
      const assinante = await repo.findOne({ where: { id } });
      if (!assinante) {
        res.status(404).json({ message: "Não encontrado." });
        return;
      }
      let remoteNote = null;
      if (assinante.ticket) {
        try {
          await deleteTicket(assinante.ticket);
        } catch (e: any) {
          remoteNote =
            "Removido localmente mas falhou na Watch Brasil: " +
            (e?.response?.data?.message || e?.message || "erro");
        }
      }
      await repo.delete(id);
      res.json({ ok: true, remoteNote });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ message: "Erro ao remover." });
    }
  }
}

export default new Streaming();
