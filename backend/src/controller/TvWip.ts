import { Request, Response } from "express";
import { Brackets } from "typeorm";

import AppDataSource from "../database/DataSource";
import { TvWipConta } from "../entities/TvWipConta";
import TvWipService from "../services/TvWipService";

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

      res.json({
        contas,
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
      const logins = this.lerLogins(req.body?.logins ?? req.body?.login);
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
