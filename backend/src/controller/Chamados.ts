import { Request, Response } from "express";
import MkauthSource from "../database/MkauthSource";
import { ChamadosEntities } from "../entities/ChamadosEntities";
import { ClientesEntities } from "../entities/ClientesEntities";
import { FuncionariosEntities } from "../entities/FuncionariosEntities";
import { SelectQueryBuilder } from "typeorm";

type CategoryTotals = {
  instalacao: number;
  renovacao: number;
  migracao: number;
  mudanca: number;
  troca: number;
  cancelamento: number;
};

type CategoryGrowth = Record<keyof CategoryTotals, number | null>;

const emptyTotals = (): CategoryTotals => ({
  instalacao: 0,
  renovacao: 0,
  migracao: 0,
  mudanca: 0,
  troca: 0,
  cancelamento: 0,
});

const emptyGrowth = (): CategoryGrowth => ({
  instalacao: null,
  renovacao: null,
  migracao: null,
  mudanca: null,
  troca: null,
  cancelamento: null,
});

const parseTotals = (raw: any): CategoryTotals => ({
  instalacao: Number(raw?.instalacao || 0),
  renovacao: Number(raw?.renovacao || 0),
  migracao: Number(raw?.migracao || 0),
  mudanca: Number(raw?.mudanca || 0),
  troca: Number(raw?.troca || 0),
  cancelamento: Number(raw?.cancelamento || 0),
});

const sumTotals = (a: CategoryTotals, b: CategoryTotals): CategoryTotals => ({
  instalacao: a.instalacao + b.instalacao,
  renovacao: a.renovacao + b.renovacao,
  migracao: a.migracao + b.migracao,
  mudanca: a.mudanca + b.mudanca,
  troca: a.troca + b.troca,
  cancelamento: a.cancelamento + b.cancelamento,
});

const addCategorySums = (
  qb: SelectQueryBuilder<ChamadosEntities>,
): SelectQueryBuilder<ChamadosEntities> =>
  qb
    .addSelect(
      "SUM(CASE WHEN chamado.assunto LIKE '%Instala%' AND chamado.assunto NOT LIKE '%INSTALACAO INTERNA DO CLIENTE%' AND chamado.assunto NOT LIKE '%INSTALACAO TEMPORARIA%' AND chamado.assunto NOT LIKE '%INSTALACAO WIFI ESTENDIDO%' THEN 1 ELSE 0 END)",
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
    );

const growthPct = (current: number, previous: number): number | null => {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(2));
};

const computeGrowth = (
  current: CategoryTotals,
  previous: CategoryTotals,
): CategoryGrowth => ({
  instalacao: growthPct(current.instalacao, previous.instalacao),
  renovacao: growthPct(current.renovacao, previous.renovacao),
  migracao: growthPct(current.migracao, previous.migracao),
  mudanca: growthPct(current.mudanca, previous.mudanca),
  troca: growthPct(current.troca, previous.troca),
  cancelamento: growthPct(current.cancelamento, previous.cancelamento),
});

const cancellationRate = (t: CategoryTotals): number | null =>
  t.instalacao === 0
    ? null
    : Number(((t.cancelamento / t.instalacao) * 100).toFixed(2));

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
        .select("func.nome", "tecnicoNome")
        .addSelect("COUNT(chamado.id)", "totalChamados")
        .innerJoin(FuncionariosEntities, "func", "chamado.tecnico = func.id")
        .where("chamado.abertura BETWEEN :start AND :end", {
          start: firstDayOfYear,
          end: lastDayOfYear,
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
    const daysInMonth = lastDay.getDate();

    const firstDayOfYear = new Date(y, 0, 1);
    const lastDayOfYear = new Date(y, 11, 31, 23, 59, 59);

    const prevMonthFirst = new Date(y, m - 1, 1);
    const prevMonthLast = new Date(y, m, 0, 23, 59, 59);

    const prevYearSameMonthFirst = new Date(y - 1, m, 1);
    const prevYearSameMonthLast = new Date(y - 1, m + 1, 0, 23, 59, 59);

    const prevYearFirst = new Date(y - 1, 0, 1);
    const prevYearLast = new Date(y - 1, 11, 31, 23, 59, 59);

    const totalsInRange = (start: Date, end: Date) =>
      addCategorySums(
        MkRepository.createQueryBuilder("chamado").select(
          "COUNT(chamado.id)",
          "totalRegistros",
        ),
      )
        .where("chamado.abertura BETWEEN :start AND :end", { start, end })
        .getRawOne();

    try {
      const stats = await addCategorySums(
        MkRepository.createQueryBuilder("chamado").select(
          "DAY(chamado.abertura)",
          "day",
        ),
      )
        .where("chamado.abertura BETWEEN :start AND :end", {
          start: firstDay,
          end: lastDay,
        })
        .groupBy("day")
        .orderBy("day", "ASC")
        .getRawMany();

      const [yearRaw, prevMonthRaw, prevYearSameMonthRaw, prevYearRaw] =
        await Promise.all([
          totalsInRange(firstDayOfYear, lastDayOfYear),
          totalsInRange(prevMonthFirst, prevMonthLast),
          totalsInRange(prevYearSameMonthFirst, prevYearSameMonthLast),
          totalsInRange(prevYearFirst, prevYearLast),
        ]);

      const formattedStats = stats.map((item: any) => ({
        day: Number(item.day),
        instalacao: Number(item.instalacao),
        renovacao: Number(item.renovacao),
        migracao: Number(item.migracao),
        mudanca: Number(item.mudanca),
        troca: Number(item.troca),
        cancelamento: Number(item.cancelamento),
      }));

      const totals = formattedStats.reduce<CategoryTotals>(
        (acc, curr) =>
          sumTotals(acc, {
            instalacao: curr.instalacao,
            renovacao: curr.renovacao,
            migracao: curr.migracao,
            mudanca: curr.mudanca,
            troca: curr.troca,
            cancelamento: curr.cancelamento,
          }),
        emptyTotals(),
      );

      const yearTotals = parseTotals(yearRaw);
      const prevMonthTotals = parseTotals(prevMonthRaw);
      const prevYearSameMonthTotals = parseTotals(prevYearSameMonthRaw);
      const prevYearTotals = parseTotals(prevYearRaw);

      const peakInstallDay = formattedStats.reduce<
        { day: number; total: number } | null
      >((best, curr) => {
        if (!best || curr.instalacao > best.total) {
          return { day: curr.day, total: curr.instalacao };
        }
        return best;
      }, null);

      const lowInstallDay = formattedStats.reduce<
        { day: number; total: number } | null
      >((worst, curr) => {
        if (!worst || curr.instalacao < worst.total) {
          return { day: curr.day, total: curr.instalacao };
        }
        return worst;
      }, null);

      const performance = {
        daysInMonth,
        activeDays: formattedStats.length,
        avgPerDay: {
          instalacao: Number((totals.instalacao / daysInMonth).toFixed(2)),
          renovacao: Number((totals.renovacao / daysInMonth).toFixed(2)),
          cancelamento: Number((totals.cancelamento / daysInMonth).toFixed(2)),
        },
        peakInstallDay,
        lowInstallDay,
        netGrowth: {
          month: totals.instalacao - totals.cancelamento,
          year: yearTotals.instalacao - yearTotals.cancelamento,
          previousMonth: prevMonthTotals.instalacao - prevMonthTotals.cancelamento,
          previousYearSameMonth:
            prevYearSameMonthTotals.instalacao -
            prevYearSameMonthTotals.cancelamento,
          previousYear: prevYearTotals.instalacao - prevYearTotals.cancelamento,
        },
        cancellationRate: {
          month: cancellationRate(totals),
          year: cancellationRate(yearTotals),
          previousMonth: cancellationRate(prevMonthTotals),
          previousYearSameMonth: cancellationRate(prevYearSameMonthTotals),
          previousYear: cancellationRate(prevYearTotals),
        },
      };

      res.status(200).json({
        stats: formattedStats,
        totals,
        yearTotals,
        comparisons: {
          previousMonth: {
            range: {
              start: prevMonthFirst.toISOString(),
              end: prevMonthLast.toISOString(),
            },
            totals: prevMonthTotals,
            growth: computeGrowth(totals, prevMonthTotals),
          },
          previousYearSameMonth: {
            range: {
              start: prevYearSameMonthFirst.toISOString(),
              end: prevYearSameMonthLast.toISOString(),
            },
            totals: prevYearSameMonthTotals,
            growth: computeGrowth(totals, prevYearSameMonthTotals),
          },
          previousYear: {
            range: {
              start: prevYearFirst.toISOString(),
              end: prevYearLast.toISOString(),
            },
            totals: prevYearTotals,
            growth: computeGrowth(yearTotals, prevYearTotals),
          },
        },
        performance,
        month: m + 1,
        year: y,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao buscar estatísticas." });
    }
  }

  public async getInstallationMonthlyTrend(req: Request, res: Response) {
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);
    const { year } = req.query;

    if (!year) {
      res.status(400).json({ message: "Ano é obrigatório." });
      return;
    }

    const y = Number(year);
    const currentYearStart = new Date(y, 0, 1);
    const currentYearEnd = new Date(y, 11, 31, 23, 59, 59);
    const previousYearStart = new Date(y - 1, 0, 1);
    const previousYearEnd = new Date(y - 1, 11, 31, 23, 59, 59);

    const buildMonthlyQuery = (start: Date, end: Date) =>
      addCategorySums(
        MkRepository.createQueryBuilder("chamado").select(
          "MONTH(chamado.abertura)",
          "month",
        ),
      )
        .where("chamado.abertura BETWEEN :start AND :end", { start, end })
        .groupBy("month")
        .orderBy("month", "ASC")
        .getRawMany();

    try {
      const [currentRows, previousRows] = await Promise.all([
        buildMonthlyQuery(currentYearStart, currentYearEnd),
        buildMonthlyQuery(previousYearStart, previousYearEnd),
      ]);

      const buildSeries = (rows: any[]) => {
        const series: ({ month: number } & CategoryTotals)[] = Array.from(
          { length: 12 },
          (_, i) => ({ month: i + 1, ...emptyTotals() }),
        );
        rows.forEach((row) => {
          const idx = Number(row.month) - 1;
          if (idx >= 0 && idx < 12) {
            series[idx] = { month: idx + 1, ...parseTotals(row) };
          }
        });
        return series;
      };

      const currentSeries = buildSeries(currentRows);
      const previousSeries = buildSeries(previousRows);

      const toTotals = (
        row: { month: number } & CategoryTotals,
      ): CategoryTotals => ({
        instalacao: row.instalacao,
        renovacao: row.renovacao,
        migracao: row.migracao,
        mudanca: row.mudanca,
        troca: row.troca,
        cancelamento: row.cancelamento,
      });

      const monthOverMonth = currentSeries.map((curr, i) => ({
        month: curr.month,
        growth:
          i === 0
            ? emptyGrowth()
            : computeGrowth(toTotals(curr), toTotals(currentSeries[i - 1])),
      }));

      const yearOverYear = currentSeries.map((curr, i) => ({
        month: curr.month,
        growth: computeGrowth(toTotals(curr), toTotals(previousSeries[i])),
      }));

      const currentYearTotals = currentSeries.reduce<CategoryTotals>(
        (acc, curr) => sumTotals(acc, toTotals(curr)),
        emptyTotals(),
      );
      const previousYearTotals = previousSeries.reduce<CategoryTotals>(
        (acc, curr) => sumTotals(acc, toTotals(curr)),
        emptyTotals(),
      );

      const cumulativeCurrent: { month: number; totals: CategoryTotals }[] = [];
      currentSeries.reduce<CategoryTotals>((acc, curr) => {
        const next = sumTotals(acc, toTotals(curr));
        cumulativeCurrent.push({ month: curr.month, totals: next });
        return next;
      }, emptyTotals());

      const cumulativePrevious: { month: number; totals: CategoryTotals }[] = [];
      previousSeries.reduce<CategoryTotals>((acc, curr) => {
        const next = sumTotals(acc, toTotals(curr));
        cumulativePrevious.push({ month: curr.month, totals: next });
        return next;
      }, emptyTotals());

      const movingAverage = currentSeries.map((curr, i) => {
        const windowStart = Math.max(0, i - 2);
        const window = currentSeries.slice(windowStart, i + 1);
        const avg = window.reduce<CategoryTotals>(
          (acc, row) => sumTotals(acc, toTotals(row)),
          emptyTotals(),
        );
        const n = window.length;
        return {
          month: curr.month,
          instalacao: Number((avg.instalacao / n).toFixed(2)),
          cancelamento: Number((avg.cancelamento / n).toFixed(2)),
        };
      });

      const today = new Date();
      const cutoffMonth =
        y === today.getFullYear() ? today.getMonth() + 1 : 12;

      const currentComparableTotals = currentSeries
        .slice(0, cutoffMonth)
        .reduce<CategoryTotals>(
          (acc, row) => sumTotals(acc, toTotals(row)),
          emptyTotals(),
        );
      const previousComparableTotals = previousSeries
        .slice(0, cutoffMonth)
        .reduce<CategoryTotals>(
          (acc, row) => sumTotals(acc, toTotals(row)),
          emptyTotals(),
        );

      res.status(200).json({
        year: y,
        currentYear: {
          totals: currentYearTotals,
          monthly: currentSeries,
          cumulative: cumulativeCurrent,
        },
        previousYear: {
          year: y - 1,
          totals: previousYearTotals,
          monthly: previousSeries,
          cumulative: cumulativePrevious,
        },
        comparisons: {
          yearGrowth: computeGrowth(
            currentComparableTotals,
            previousComparableTotals,
          ),
          yearGrowthFullYear: computeGrowth(
            currentYearTotals,
            previousYearTotals,
          ),
          monthOverMonth,
          yearOverYear,
          cutoffMonth,
          comparableTotals: {
            current: currentComparableTotals,
            previous: previousComparableTotals,
          },
        },
        movingAverage,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao buscar tendência mensal." });
    }
  }

  public async getInstallationYearlyComparison(req: Request, res: Response) {
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);
    const yearsRequested = Number(req.query.years ?? 5);
    const yearsToShow = Math.min(
      Math.max(Number.isFinite(yearsRequested) ? yearsRequested : 5, 1),
      10,
    );

    const today = new Date();
    const currentYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const startYear = currentYear - yearsToShow + 1;
    const rangeStart = new Date(startYear, 0, 1);
    const rangeEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    try {
      const [rows, ytdRows] = await Promise.all([
        addCategorySums(
          MkRepository.createQueryBuilder("chamado").select(
            "YEAR(chamado.abertura)",
            "year",
          ),
        )
          .where("chamado.abertura BETWEEN :start AND :end", {
            start: rangeStart,
            end: rangeEnd,
          })
          .groupBy("year")
          .orderBy("year", "ASC")
          .getRawMany(),
        addCategorySums(
          MkRepository.createQueryBuilder("chamado").select(
            "YEAR(chamado.abertura)",
            "year",
          ),
        )
          .where(
            "chamado.abertura BETWEEN :start AND :end AND (MONTH(chamado.abertura) < :curMonth OR (MONTH(chamado.abertura) = :curMonth AND DAY(chamado.abertura) <= :curDay))",
            {
              start: rangeStart,
              end: rangeEnd,
              curMonth: todayMonth,
              curDay: todayDay,
            },
          )
          .groupBy("year")
          .orderBy("year", "ASC")
          .getRawMany(),
      ]);

      const seriesMap = new Map<number, CategoryTotals>();
      rows.forEach((row) => {
        seriesMap.set(Number(row.year), parseTotals(row));
      });

      const ytdMap = new Map<number, CategoryTotals>();
      ytdRows.forEach((row) => {
        ytdMap.set(Number(row.year), parseTotals(row));
      });

      const series = Array.from({ length: yearsToShow }, (_, i) => {
        const year = startYear + i;
        const totals = seriesMap.get(year) ?? emptyTotals();
        return {
          year,
          totals,
          netGrowth: totals.instalacao - totals.cancelamento,
          cancellationRate: cancellationRate(totals),
        };
      });

      const seriesYtd = Array.from({ length: yearsToShow }, (_, i) => {
        const year = startYear + i;
        const totals = ytdMap.get(year) ?? emptyTotals();
        return {
          year,
          totals,
          netGrowth: totals.instalacao - totals.cancelamento,
          cancellationRate: cancellationRate(totals),
        };
      });

      const yearOverYear = series.map((curr, i) => ({
        year: curr.year,
        growth:
          i === 0
            ? emptyGrowth()
            : computeGrowth(curr.totals, series[i - 1].totals),
      }));

      const yearOverYearYtd = seriesYtd.map((curr, i) => ({
        year: curr.year,
        growth:
          i === 0
            ? emptyGrowth()
            : computeGrowth(curr.totals, seriesYtd[i - 1].totals),
      }));

      const firstYtdTotals = seriesYtd[0]?.totals ?? emptyTotals();
      const lastYtdTotals =
        seriesYtd[seriesYtd.length - 1]?.totals ?? emptyTotals();
      const overallGrowth = computeGrowth(lastYtdTotals, firstYtdTotals);

      const firstYearTotals = series[0]?.totals ?? emptyTotals();
      const lastYearTotals =
        series[series.length - 1]?.totals ?? emptyTotals();
      const overallGrowthFullYear = computeGrowth(
        lastYearTotals,
        firstYearTotals,
      );

      const averagePerYear: CategoryTotals = {
        instalacao: Number(
          (
            series.reduce((acc, s) => acc + s.totals.instalacao, 0) /
            yearsToShow
          ).toFixed(2),
        ),
        renovacao: Number(
          (
            series.reduce((acc, s) => acc + s.totals.renovacao, 0) /
            yearsToShow
          ).toFixed(2),
        ),
        migracao: Number(
          (
            series.reduce((acc, s) => acc + s.totals.migracao, 0) / yearsToShow
          ).toFixed(2),
        ),
        mudanca: Number(
          (
            series.reduce((acc, s) => acc + s.totals.mudanca, 0) / yearsToShow
          ).toFixed(2),
        ),
        troca: Number(
          (
            series.reduce((acc, s) => acc + s.totals.troca, 0) / yearsToShow
          ).toFixed(2),
        ),
        cancelamento: Number(
          (
            series.reduce((acc, s) => acc + s.totals.cancelamento, 0) /
            yearsToShow
          ).toFixed(2),
        ),
      };

      res.status(200).json({
        startYear,
        endYear: currentYear,
        yearsShown: yearsToShow,
        ytdReference: { month: todayMonth, day: todayDay },
        series,
        seriesYtd,
        yearOverYear,
        yearOverYearYtd,
        overallGrowth,
        overallGrowthFullYear,
        averagePerYear,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao buscar comparação anual." });
    }
  }

  public async getClientesAtivadosComparison(req: Request, res: Response) {
    const ClientRepository = MkauthSource.getRepository(ClientesEntities);

    const startYear = 2022;
    const today = new Date();
    const currentYear = today.getFullYear();

    try {
      const years = currentYear - startYear + 1;
      const snapshots = await Promise.all(
        Array.from({ length: years }, async (_, i) => {
          const year = startYear + i;
          const isCurrent = year === currentYear;
          const snapshotDate = isCurrent
            ? today
            : new Date(year, 11, 31, 23, 59, 59);
          const yearStart = new Date(year, 0, 1);
          const yearEnd = isCurrent
            ? today
            : new Date(year, 11, 31, 23, 59, 59);

          const [ativosRow, desativadosRow] = await Promise.all([
            ClientRepository.createQueryBuilder("cliente")
              .select("COUNT(cliente.id)", "total")
              .where("cliente.data_ins IS NOT NULL")
              .andWhere("cliente.data_ins <= :snapshot", {
                snapshot: snapshotDate,
              })
              .andWhere(
                "(cliente.data_desativacao > :snapshot OR (cliente.data_desativacao IS NULL AND cliente.cli_ativado = 's'))",
                { snapshot: snapshotDate },
              )
              .getRawOne(),
            ClientRepository.createQueryBuilder("cliente")
              .select("COUNT(cliente.id)", "total")
              .where("cliente.data_desativacao BETWEEN :start AND :end", {
                start: yearStart,
                end: yearEnd,
              })
              .getRawOne(),
          ]);

          return {
            year,
            total: Number(ativosRow?.total || 0),
            desativados: Number(desativadosRow?.total || 0),
          };
        }),
      );

      const series = snapshots;

      const yearOverYear = series.map((curr, i) => {
        if (i === 0) return { year: curr.year, growth: null };
        return {
          year: curr.year,
          growth: growthPct(curr.total, series[i - 1].total),
        };
      });

      const overallGrowth =
        series.length > 1
          ? growthPct(series[series.length - 1].total, series[0].total)
          : null;

      res.status(200).json({
        startYear,
        endYear: currentYear,
        series,
        yearOverYear,
        overallGrowth,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Erro ao buscar total de clientes por ano." });
    }
  }

  public async getAgentStats(req: Request, res: Response) {
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
      const openedStats = await MkRepository.createQueryBuilder("chamado")
        .select("chamado.atendente", "agent")
        .addSelect("COUNT(chamado.id)", "opened")
        .where("chamado.abertura BETWEEN :start AND :end", {
          start: firstDay,
          end: lastDay,
        })
        .andWhere("chamado.atendente IS NOT NULL")
        .andWhere("chamado.atendente != ''")
        .groupBy("chamado.atendente")
        .getRawMany();

      const closedStats = await MkRepository.createQueryBuilder("chamado")
        .select("func.nome", "agent")
        .addSelect("COUNT(chamado.id)", "closed")
        .innerJoin(FuncionariosEntities, "func", "chamado.tecnico = func.id")
        .where("chamado.fechamento BETWEEN :start AND :end", {
          start: firstDay,
          end: lastDay,
        })
        .andWhere("chamado.status = 'fechado'")
        .groupBy("func.nome")
        .getRawMany();

      const agentMap = new Map<
        string,
        { agent: string; opened: number; closed: number }
      >();

      openedStats.forEach((stat) => {
        const agent = stat.agent;
        if (!agentMap.has(agent)) {
          agentMap.set(agent, { agent, opened: 0, closed: 0 });
        }
        agentMap.get(agent)!.opened += Number(stat.opened);
      });

      closedStats.forEach((stat) => {
        const agent = stat.agent;
        if (!agentMap.has(agent)) {
          agentMap.set(agent, { agent, opened: 0, closed: 0 });
        }
        agentMap.get(agent)!.closed += Number(stat.closed);
      });

      const result = Array.from(agentMap.values()).sort(
        (a, b) => b.closed - a.closed,
      );

      res.status(200).json(result);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Erro ao buscar estatísticas por atendente." });
    }
  }
}

export default new Chamados();
