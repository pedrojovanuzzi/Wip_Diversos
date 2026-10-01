import { Request, Response } from "express";
import { Brackets } from "typeorm";
import DataSource from "../database/DataSource";
import { AuditLog } from "../entities/AuditLog";

const POR_PAGINA = 50;

class AuditoriaController {
  /**
   * GET /api/auditoria?pagina=&usuario=&acao=&modulo=&inicio=&fim=&busca=
   * `inicio`/`fim` em AAAA-MM-DD (dias inteiros).
   */
  public async listar(req: Request, res: Response) {
    try {
      const pagina = Math.max(1, Number(req.query.pagina) || 1);
      const { usuario, acao, modulo, inicio, fim, busca } = req.query as Record<
        string,
        string | undefined
      >;

      const qb = DataSource.getRepository(AuditLog)
        .createQueryBuilder("l")
        .orderBy("l.criado_em", "DESC")
        .addOrderBy("l.id", "DESC")
        .skip((pagina - 1) * POR_PAGINA)
        .take(POR_PAGINA);

      if (usuario) qb.andWhere("l.user_login = :usuario", { usuario });
      if (acao) qb.andWhere("l.acao = :acao", { acao });
      if (modulo) qb.andWhere("l.modulo = :modulo", { modulo });
      if (inicio) qb.andWhere("l.criado_em >= :inicio", { inicio: `${inicio} 00:00:00` });
      if (fim) qb.andWhere("l.criado_em <= :fim", { fim: `${fim} 23:59:59` });
      if (busca) {
        qb.andWhere(
          new Brackets((w) => {
            w.where("l.descricao LIKE :b")
              .orWhere("l.rota LIKE :b")
              .orWhere("l.dados LIKE :b");
          }),
          { b: `%${busca}%` },
        );
      }

      const [registros, total] = await qb.getManyAndCount();
      res.json({
        registros,
        total,
        pagina,
        paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
      });
    } catch (error) {
      console.error("[auditoria] erro ao listar:", error);
      res.status(500).json({ message: "Erro ao consultar os logs." });
    }
  }

  /** Valores distintos para preencher os selects de filtro. */
  public async filtros(_req: Request, res: Response) {
    try {
      const repo = DataSource.getRepository(AuditLog);
      const [usuarios, modulos] = await Promise.all([
        repo
          .createQueryBuilder("l")
          .select("DISTINCT l.user_login", "v")
          .where("l.user_login IS NOT NULL")
          .orderBy("v")
          .getRawMany(),
        repo
          .createQueryBuilder("l")
          .select("DISTINCT l.modulo", "v")
          .where("l.modulo IS NOT NULL")
          .orderBy("v")
          .getRawMany(),
      ]);
      res.json({
        usuarios: usuarios.map((r) => r.v),
        modulos: modulos.map((r) => r.v),
      });
    } catch (error) {
      console.error("[auditoria] erro ao listar filtros:", error);
      res.status(500).json({ message: "Erro ao consultar os filtros." });
    }
  }
}

export default new AuditoriaController();
