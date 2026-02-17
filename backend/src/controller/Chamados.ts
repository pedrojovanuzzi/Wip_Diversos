import { Request, Response } from "express";
import MkauthSource from "../database/MkauthSource";
import { ChamadosEntities } from "../entities/ChamadosEntities";
import { ClientesEntities } from "../entities/ClientesEntities";
import { FuncionariosEntities } from "../entities/FuncionariosEntities";
import { Between } from "typeorm";

class Chamados {
  public async showMonth(req: Request, res: Response) {
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);
    const currentDate = new Date();
    const firstDayOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    const lastDayOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const ClientRepository = MkauthSource.getRepository(ClientesEntities);

    const ClientsDisabled = await ClientRepository.find({
      where: { cli_ativado: "n" },
      select: ["login"],
    });

    const disabledLogins = ClientsDisabled.map((client) => client.login);

    try {
      const Dados = await MkRepository.createQueryBuilder("chamado")
        .select("chamado.login")
        .addSelect("COUNT(chamado.id)", "totalChamados")
        .where("chamado.abertura BETWEEN :start AND :end", {
          start: firstDayOfMonth,
          end: lastDayOfMonth,
        })
        .andWhere("chamado.login != 'noc'")
        .andWhere("chamado.login NOT IN (:...disabledLogins)", {
          disabledLogins,
        }) // Exclui logins desativados
        .groupBy("chamado.login")
        .orderBy("totalChamados", "DESC")
        .limit(10)
        .getRawMany();

      res.status(200).json(Dados);
    } catch (error) {
      res.status(500).json({ errors: [{ msg: "Ocorreu um Erro" }] });
    }
  }

  public async showYear(req: Request, res: Response) {
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);
    const currentDate = new Date();
    const firstDayOfYear = new Date(currentDate.getFullYear(), 0, 1);
    const lastDayOfYear = new Date(
      currentDate.getFullYear(),
      11,
      31,
      23,
      59,
      59,
    );

    const ClientRepository = MkauthSource.getRepository(ClientesEntities);

    const ClientsDisabled = await ClientRepository.find({
      where: { cli_ativado: "n" },
      select: ["login"],
    });

    const disabledLogins = ClientsDisabled.map((client) => client.login);

    try {
      const Dados = await MkRepository.createQueryBuilder("chamado")
        .select("chamado.login")
        .addSelect("COUNT(chamado.id)", "totalChamados")
        .where("(chamado.abertura BETWEEN :start AND :end)", {
          start: firstDayOfYear,
          end: lastDayOfYear,
        })
        .andWhere("chamado.login != 'noc'")
        .andWhere("chamado.login NOT IN (:...disabledLogins)", {
          disabledLogins,
        })
        .groupBy("chamado.login")
        .orderBy("totalChamados", "DESC")
        .limit(10)
        .getRawMany();

      res.status(200).json(Dados);
    } catch (error) {
      res.status(500).json({ errors: [{ msg: "Ocorreu um Erro" }] });
    }
  }

  public async showAll(req: Request, res: Response) {
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);

    const ClientRepository = MkauthSource.getRepository(ClientesEntities);

    const ClientsDisabled = await ClientRepository.find({
      where: { cli_ativado: "n" },
      select: ["login"],
    });

    const disabledLogins = ClientsDisabled.map((client) => client.login);

    try {
      const Dados = await MkRepository.createQueryBuilder("chamado")
        .select("chamado.login")
        .where("chamado.login != 'noc'")
        .andWhere("chamado.login NOT IN (:...disabledLogins)", {
          disabledLogins,
        })
        .addSelect("COUNT(chamado.id)", "totalChamados")
        .groupBy("chamado.login")
        .orderBy("totalChamados", "DESC")
        .limit(10)
        .getRawMany();

      res.status(200).json(Dados);
    } catch (error) {
      res.status(500).json({ errors: [{ msg: "Ocorreu um Erro" }] });
    }
  }

  public async returnMonth(req: Request, res: Response) {
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);

    const currentDate = new Date();
    const firstDayOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    const lastDayOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    try {
      const Dados = await MkRepository.createQueryBuilder("chamado")
        .select("func.nome", "tecnicoNome")
        .addSelect("COUNT(chamado.id)", "totalChamados")
        .innerJoin(FuncionariosEntities, "func", "chamado.tecnico = func.id")
        .where("chamado.abertura BETWEEN :start AND :end", {
          start: firstDayOfMonth,
          end: lastDayOfMonth,
        })
        .andWhere("chamado.login != 'noc'")
        .andWhere("chamado.tecnico != 0")
        .groupBy("func.nome")
        .orderBy("totalChamados", "DESC")
        .limit(10)
        .getRawMany();

      res.status(200).json(Dados);
    } catch (error) {
      res.status(500).json({ errors: [{ msg: "Ocorreu um Erro" }] });
    }
  }

  public async returnYear(req: Request, res: Response) {
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);

    const currentDate = new Date();
    const firstDayOfYear = new Date(currentDate.getFullYear(), 0, 1);
    const lastDayOfYear = new Date(
      currentDate.getFullYear(),
      11,
      31,
      23,
      59,
      59,
    );

    try {
      const Dados = await MkRepository.createQueryBuilder("chamado")
        .select("func.nome", "tecnicoNome") // Seleciona o nome do técnico
        .addSelect("COUNT(chamado.id)", "totalChamados")
        .innerJoin(FuncionariosEntities, "func", "chamado.tecnico = func.id") // Faz o join com a entidade FuncionariosEntities
        .where("chamado.abertura BETWEEN :start AND :end", {
          start: firstDayOfYear,
          end: lastDayOfYear,
        })
        .andWhere("chamado.login != 'noc'")
        .andWhere("chamado.tecnico != 0")
        .groupBy("func.nome") // Agrupa pelo nome do técnico
        .orderBy("totalChamados", "DESC")
        .limit(10)
        .getRawMany();

      res.status(200).json(Dados);
    } catch (error) {
      res.status(500).json({ errors: [{ msg: "Ocorreu um Erro" }] });
    }
  }

  public async getInstallationStats(req: Request, res: Response) {
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);
    const { month, year } = req.query;

    if (!month || !year) {
      res.status(400).json({ message: "Mês e Ano são obrigatórios." });
      return;
    }

    const m = Number(month) - 1;
    const y = Number(year);

    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0, 23, 59, 59);

    try {
      const stats = await MkRepository.createQueryBuilder("chamado")
        .select("DAY(chamado.abertura)", "day")
        .addSelect(
          "SUM(CASE WHEN chamado.assunto LIKE '%Instala%' THEN 1 ELSE 0 END)",
          "instalacao",
        )
        .addSelect(
          "SUM(CASE WHEN chamado.assunto LIKE '%Renova%' THEN 1 ELSE 0 END)",
          "renovacao",
        )
        .addSelect(
          "SUM(CASE WHEN chamado.assunto LIKE '%Migra%' THEN 1 ELSE 0 END)",
          "migracao",
        )
        .addSelect(
          "SUM(CASE WHEN chamado.assunto LIKE '%Mudan%' THEN 1 ELSE 0 END)",
          "mudanca",
        )
        .addSelect(
          "SUM(CASE WHEN chamado.assunto LIKE '%Troca%' THEN 1 ELSE 0 END)",
          "troca",
        )
        .addSelect(
          "SUM(CASE WHEN chamado.assunto LIKE '%Cancela%' THEN 1 ELSE 0 END)",
          "cancelamento",
        )
        .where("chamado.abertura BETWEEN :start AND :end", {
          start: firstDay,
          end: lastDay,
        })
        .groupBy("day")
        .orderBy("day", "ASC")
        .getRawMany();

      const formattedStats = stats.map((item: any) => ({
        day: Number(item.day),
        instalacao: Number(item.instalacao),
        renovacao: Number(item.renovacao),
        migracao: Number(item.migracao),
        mudanca: Number(item.mudanca),
        troca: Number(item.troca),
        cancelamento: Number(item.cancelamento),
      }));

      const totals = formattedStats.reduce(
        (acc: any, curr: any) => ({
          instalacao: acc.instalacao + curr.instalacao,
          renovacao: acc.renovacao + curr.renovacao,
          migracao: acc.migracao + curr.migracao,
          mudanca: acc.mudanca + curr.mudanca,
          troca: acc.troca + curr.troca,
          cancelamento: acc.cancelamento + curr.cancelamento,
        }),
        {
          instalacao: 0,
          renovacao: 0,
          migracao: 0,
          mudanca: 0,
          troca: 0,
          cancelamento: 0,
        },
      );

      res.status(200).json({
        stats: formattedStats,
        totals,
        month: m + 1,
        year: y,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao buscar estatísticas." });
    }
  }
}

export default new Chamados();
