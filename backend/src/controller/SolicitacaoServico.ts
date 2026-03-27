import { Request, Response } from "express";
import AppDataSource from "../database/DataSource";
import { SolicitacaoServico } from "../entities/SolicitacaoServico";
import { Between, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import moment from "moment-timezone";

class SolicitacaoServicoController {
  public async list(req: Request, res: Response) {
    try {
      const { startDate, endDate, page = 1, limit = 10 } = req.query;

      const repository = AppDataSource.getRepository(SolicitacaoServico);
      let where: any = {};

      if (startDate && endDate) {
        where.data_solicitacao = Between(
          moment(startDate as string).startOf("day").toDate(),
          moment(endDate as string).endOf("day").toDate()
        );
      } else if (startDate) {
        where.data_solicitacao = MoreThanOrEqual(
          moment(startDate as string).startOf("day").toDate()
        );
      } else if (endDate) {
        where.data_solicitacao = LessThanOrEqual(
          moment(endDate as string).endOf("day").toDate()
        );
      }

      // Pagination
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      const [list, count] = await repository.findAndCount({
        where,
        order: {
          data_solicitacao: "DESC",
        },
        skip,
        take: limitNum,
      });

      res.status(200).json({
        data: list,
        total: count,
        page: pageNum,
        totalPages: Math.ceil(count / limitNum),
      });
    } catch (error) {
      console.error("Erro ao listar solicitações de serviço:", error);
      res.status(500).send("Erro interno do servidor.");
    }
  }
}

export default new SolicitacaoServicoController();
