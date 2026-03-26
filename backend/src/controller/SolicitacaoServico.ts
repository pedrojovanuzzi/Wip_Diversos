import { Request, Response } from "express";
import AppDataSource from "../database/DataSource";
import { SolicitacaoServico } from "../entities/SolicitacaoServico";
import { Between, LessThanOrEqual, MoreThanOrEqual } from "typeorm";

class SolicitacaoServicoController {
  public async list(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      const repository = AppDataSource.getRepository(SolicitacaoServico);
      let where: any = {};

      if (startDate && endDate) {
        where.data_solicitacao = Between(
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else if (startDate) {
        where.data_solicitacao = MoreThanOrEqual(new Date(startDate as string));
      } else if (endDate) {
        where.data_solicitacao = LessThanOrEqual(new Date(endDate as string));
      }

      const list = await repository.find({
        where,
        order: {
          data_solicitacao: "DESC",
        },
      });

      res.status(200).json(list);
    } catch (error) {
      console.error("Erro ao listar solicitações de serviço:", error);
      res.status(500).send("Erro interno do servidor.");
    }
  }
}

export default new SolicitacaoServicoController();
