import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { NavBar } from "../../components/navbar/NavBar";

interface InstallationStat {
  day: number;
  instalacao: number;
  renovacao: number;
  migracao: number;
  mudanca: number;
  troca: number;
  cancelamento: number;
}

interface AgentStat {
  agent: string;
  opened: number;
  closed: number;
}

interface CategoryTotals {
  instalacao: number;
  renovacao: number;
  migracao: number;
  mudanca: number;
  troca: number;
  cancelamento: number;
}

type CategoryGrowth = Record<keyof CategoryTotals, number | null>;

interface ComparisonBlock {
  range: { start: string; end: string };
  totals: CategoryTotals;
  growth: CategoryGrowth;
}

interface Performance {
  daysInMonth: number;
  activeDays: number;
  avgPerDay: {
    instalacao: number;
    renovacao: number;
    cancelamento: number;
  };
  peakInstallDay: { day: number; total: number } | null;
  lowInstallDay: { day: number; total: number } | null;
  netGrowth: {
    month: number;
    year: number;
    previousMonth: number;
    previousYearSameMonth: number;
    previousYear: number;
  };
  cancellationRate: {
    month: number | null;
    year: number | null;
    previousMonth: number | null;
    previousYearSameMonth: number | null;
    previousYear: number | null;
  };
}

interface StatsResponse {
  stats: InstallationStat[];
  totals: CategoryTotals;
  yearTotals: CategoryTotals;
  comparisons: {
    previousMonth: ComparisonBlock;
    previousYearSameMonth: ComparisonBlock;
    previousYear: ComparisonBlock;
  };
  performance: Performance;
  month: number;
  year: number;
}

interface MonthlySeriesRow extends CategoryTotals {
  month: number;
}

interface MonthlyTrendResponse {
  year: number;
  currentYear: {
    totals: CategoryTotals;
    monthly: MonthlySeriesRow[];
    cumulative: { month: number; totals: CategoryTotals }[];
  };
  previousYear: {
    year: number;
    totals: CategoryTotals;
    monthly: MonthlySeriesRow[];
    cumulative: { month: number; totals: CategoryTotals }[];
  };
  comparisons: {
    yearGrowth: CategoryGrowth;
    yearGrowthFullYear: CategoryGrowth;
    monthOverMonth: { month: number; growth: CategoryGrowth }[];
    yearOverYear: { month: number; growth: CategoryGrowth }[];
    cutoffMonth: number;
    comparableTotals: {
      current: CategoryTotals;
      previous: CategoryTotals;
    };
  };
  movingAverage: { month: number; instalacao: number; cancelamento: number }[];
}

interface ClientesAtivadosRow {
  year: number;
  total: number;
  desativados: number;
}

interface ClientesAtivadosResponse {
  startYear: number;
  endYear: number;
  series: ClientesAtivadosRow[];
  yearOverYear: { year: number; growth: number | null }[];
  overallGrowth: number | null;
}

interface YearlySeriesRow {
  year: number;
  totals: CategoryTotals;
  netGrowth: number;
  cancellationRate: number | null;
}

interface YearlyComparisonResponse {
  startYear: number;
  endYear: number;
  yearsShown: number;
  ytdReference: { month: number; day: number };
  series: YearlySeriesRow[];
  seriesYtd: YearlySeriesRow[];
  yearOverYear: { year: number; growth: CategoryGrowth }[];
  yearOverYearYtd: { year: number; growth: CategoryGrowth }[];
  overallGrowth: CategoryGrowth;
  overallGrowthFullYear: CategoryGrowth;
  averagePerYear: CategoryTotals;
}

const categoryLabels: Record<keyof CategoryTotals, string> = {
  instalacao: "Instalação",
  renovacao: "Renovação",
  migracao: "Migração",
  mudanca: "Mudança",
  troca: "Troca",
  cancelamento: "Cancelamento",
};

const categoryColors: Record<keyof CategoryTotals, string> = {
  instalacao: "#4f46e5",
  renovacao: "#10b981",
  migracao: "#f59e0b",
  mudanca: "#8b5cf6",
  troca: "#ec4899",
  cancelamento: "#ef4444",
};

const monthShort = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const formatGrowth = (value: number | null): string => {
  if (value === null) return "—";
  if (value === 0) return "0%";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
};

const GrowthBadge: React.FC<{
  value: number | null;
  invert?: boolean;
  compact?: boolean;
}> = ({ value, invert = false, compact = false }) => {
  if (value === null) {
    return <span className="text-gray-400 text-xs">sem base</span>;
  }
  if (value === 0) {
    return <span className="text-gray-500 text-xs">0%</span>;
  }
  const isPositive = value > 0;
  const isGood = invert ? !isPositive : isPositive;
  const color = isGood ? "text-green-600" : "text-red-600";
  const arrow = isPositive ? "▲" : "▼";
  return (
    <span
      className={`${color} ${compact ? "text-xs" : "text-sm"} font-semibold`}
    >
      {arrow} {formatGrowth(value)}
    </span>
  );
};

export const GraficoInstalacoes = () => {
  const { user } = useAuth();
  const [data, setData] = useState<StatsResponse | null>(null);
  const [trend, setTrend] = useState<MonthlyTrendResponse | null>(null);
  const [yearly, setYearly] = useState<YearlyComparisonResponse | null>(null);
  const [clientesAtivados, setClientesAtivados] =
    useState<ClientesAtivadosResponse | null>(null);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const years = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - i,
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${user?.token}` };
      const baseUrl = process.env.REACT_APP_URL;

      const [statsRes, trendRes, yearlyRes, agentRes, clientesRes] =
        await Promise.all([
          axios.get<StatsResponse>(
            `${baseUrl}/chamados/analytics/instalacoes`,
            { params: { month, year }, headers },
          ),
          axios.get<MonthlyTrendResponse>(
            `${baseUrl}/chamados/analytics/instalacoes/trend`,
            { params: { year }, headers },
          ),
          axios.get<YearlyComparisonResponse>(
            `${baseUrl}/chamados/analytics/instalacoes/anos`,
            { params: { years: 5 }, headers },
          ),
          axios.get<AgentStat[]>(`${baseUrl}/chamados/analytics/agents`, {
            params: { month, year },
            headers,
          }),
          axios.get<ClientesAtivadosResponse>(
            `${baseUrl}/chamados/analytics/clientes/ativados`,
            { headers },
          ),
        ]);

      setData(statsRes.data);
      setTrend(trendRes.data);
      setYearly(yearlyRes.data);
      setAgentStats(agentRes.data);
      setClientesAtivados(clientesRes.data);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      alert("Erro ao carregar gráficos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchData();
    }
    // eslint-disable-next-line
  }, [month, year, user?.token]);

  const yearlyChartData = yearly
    ? yearly.seriesYtd.map((row) => ({
        year: String(row.year),
        instalacao: row.totals.instalacao,
        cancelamento: row.totals.cancelamento,
        netGrowth: row.netGrowth,
      }))
    : [];

  const clientesAtivadosChartData = clientesAtivados
    ? clientesAtivados.series.map((row) => ({
        year: String(row.year),
        total: row.total,
        desativados: row.desativados,
      }))
    : [];

  const forecast = (() => {
    if (!trend) return null;
    const current = trend.currentYear.monthly;
    const previous = trend.previousYear.monthly;
    const cutoff = trend.comparisons.cutoffMonth;

    const projectByCategory = (key: "instalacao" | "cancelamento") => {
      const realizedYTD = current
        .slice(0, cutoff)
        .reduce((acc, r) => acc + (r[key] || 0), 0);
      const previousYTD = previous
        .slice(0, cutoff)
        .reduce((acc, r) => acc + (r[key] || 0), 0);
      const ratio = previousYTD > 0 ? realizedYTD / previousYTD : null;
      const avg =
        realizedYTD > 0 && cutoff > 0 ? realizedYTD / cutoff : 0;
      const remaining = current.map((_, i) => {
        if (i < cutoff) return 0;
        if (ratio !== null) {
          return Math.max(0, Math.round((previous[i]?.[key] ?? 0) * ratio));
        }
        return Math.round(avg);
      });
      return {
        realizedYTD,
        remaining,
        projectedRemaining: remaining.reduce((a, v) => a + v, 0),
      };
    };

    const inst = projectByCategory("instalacao");
    const canc = projectByCategory("cancelamento");

    const chartData = current.map((row, i) => {
      const isPast = i < cutoff;
      return {
        month: monthShort[i],
        real: isPast ? row.instalacao : null,
        previsto:
          i === cutoff - 1
            ? row.instalacao
            : isPast
              ? null
              : inst.remaining[i],
        anterior: previous[i]?.instalacao ?? 0,
      };
    });

    const cancellationChartData = current.map((row, i) => {
      const isPast = i < cutoff;
      return {
        month: monthShort[i],
        real: isPast ? row.cancelamento : null,
        previsto:
          i === cutoff - 1
            ? row.cancelamento
            : isPast
              ? null
              : canc.remaining[i],
        anterior: previous[i]?.cancelamento ?? 0,
      };
    });

    const currentActive =
      clientesAtivados?.series?.[clientesAtivados.series.length - 1]?.total ??
      0;

    let running = currentActive;
    const clientesChartData = current.map((_row, i) => {
      const isPast = i < cutoff;
      if (isPast) {
        return {
          month: monthShort[i],
          atual: i === cutoff - 1 ? currentActive : null,
          previsto: i === cutoff - 1 ? currentActive : null,
        };
      }
      const netMonth = (inst.remaining[i] || 0) - (canc.remaining[i] || 0);
      running += netMonth;
      return {
        month: monthShort[i],
        atual: null,
        previsto: running,
      };
    });

    const projectedNet = inst.projectedRemaining - canc.projectedRemaining;

    return {
      cutoffMonth: cutoff,
      realizedYTD: inst.realizedYTD,
      projectedRemaining: inst.projectedRemaining,
      projectedYearTotal: inst.realizedYTD + inst.projectedRemaining,
      chartData,
      cancellation: canc,
      currentActive,
      projectedNet,
      projectedClientesEOY: currentActive + projectedNet,
      clientesChartData,
      cancellationChartData,
    };
  })();

  return (
    <>
      <NavBar></NavBar>
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            Gráfico de Suporte Mensal
          </h1>

          <div className="bg-white p-6 rounded-lg shadow-md mb-6 flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mês
                  </label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  >
                    {months.map((m, index) => (
                      <option key={index} value={index + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ano
                  </label>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Monthly Totals */}
            <div>
              <h2 className="text-sm font-bold text-gray-500 uppercase mb-2">
                Totais de {months[month - 1]}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {data?.totals &&
                  (Object.keys(categoryLabels) as (keyof CategoryTotals)[]).map(
                    (key) => (
                      <div
                        key={key}
                        className="bg-gray-50 p-2 rounded border border-gray-200 shadow-sm text-center"
                      >
                        <p className="text-xs text-gray-500 uppercase font-semibold">
                          {categoryLabels[key]}
                        </p>
                        <p className="text-lg font-bold text-gray-800">
                          {data.totals[key]}
                        </p>
                      </div>
                    ),
                  )}
              </div>
            </div>

            {/* Yearly Totals */}
            <div>
              <h2 className="text-sm font-bold text-gray-500 uppercase mb-2">
                Acumulado do Ano {year}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {data?.yearTotals &&
                  (Object.keys(categoryLabels) as (keyof CategoryTotals)[]).map(
                    (key) => (
                      <div
                        key={key}
                        className="bg-indigo-50 p-2 rounded border border-indigo-100 shadow-sm text-center"
                      >
                        <p className="text-xs text-indigo-600 uppercase font-semibold">
                          {categoryLabels[key]}
                        </p>
                        <p className="text-lg font-bold text-indigo-900">
                          {data.yearTotals[key]}
                        </p>
                      </div>
                    ),
                  )}
              </div>
            </div>
          </div>

          {/* KPIs de desempenho */}
          {data?.performance && (
            <div className="mb-6">
              <h2 className="text-sm font-bold text-gray-500 uppercase mb-2">
                Indicadores de Desempenho — {months[month - 1]}/{year}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-indigo-500">
                  <p className="text-xs text-gray-500 uppercase">
                    Crescimento Líquido Mês
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      data.performance.netGrowth.month >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {data.performance.netGrowth.month >= 0 ? "+" : ""}
                    {data.performance.netGrowth.month}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    instalações − cancelamentos
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-indigo-500">
                  <p className="text-xs text-gray-500 uppercase">
                    Crescimento Líquido Ano
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      data.performance.netGrowth.year >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {data.performance.netGrowth.year >= 0 ? "+" : ""}
                    {data.performance.netGrowth.year}
                  </p>
                  <p className="text-[10px] text-gray-400">acumulado anual</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-green-500">
                  <p className="text-xs text-gray-500 uppercase">
                    Média Instalações/Dia
                  </p>
                  <p className="text-xl font-bold text-gray-800">
                    {data.performance.avgPerDay.instalacao}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    em {data.performance.daysInMonth} dias
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-yellow-500">
                  <p className="text-xs text-gray-500 uppercase">Pico Inst.</p>
                  <p className="text-xl font-bold text-gray-800">
                    {data.performance.peakInstallDay
                      ? `Dia ${data.performance.peakInstallDay.day}`
                      : "—"}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {data.performance.peakInstallDay
                      ? `${data.performance.peakInstallDay.total} instalações`
                      : "sem dados"}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-red-500">
                  <p className="text-xs text-gray-500 uppercase">
                    Taxa Cancelamento
                  </p>
                  <p className="text-xl font-bold text-gray-800">
                    {data.performance.cancellationRate.month !== null
                      ? `${data.performance.cancellationRate.month}%`
                      : "—"}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    cancelamentos / instalações
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-gray-400">
                  <p className="text-xs text-gray-500 uppercase">Dias Ativos</p>
                  <p className="text-xl font-bold text-gray-800">
                    {data.performance.activeDays}/
                    {data.performance.daysInMonth}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    com movimentação
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-6">
            {/* Comparação anual (últimos 5 anos) */}
            <div className="bg-white p-6 rounded-lg shadow-md h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Comparação Anual YTD — Últimos {yearly?.yearsShown ?? 5}{" "}
                  anos
                </h2>
                {yearly && (
                  <div className="flex flex-col items-end text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">
                        Crescimento YTD ({yearly.startYear} → {yearly.endYear}
                        ):
                      </span>
                      <GrowthBadge value={yearly.overallGrowth.instalacao} />
                    </div>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      Comparação Jan–
                      {monthShort[yearly.ytdReference.month - 1]}{" "}
                      {yearly.ytdReference.day} em cada ano
                    </span>
                  </div>
                )}
              </div>
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <AiOutlineLoading3Quarters className="animate-spin text-4xl text-indigo-600" />
                </div>
              ) : yearlyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart
                    data={yearlyChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="instalacao"
                      name="Instalações"
                      fill={categoryColors.instalacao}
                    >
                      <LabelList dataKey="instalacao" position="top" />
                    </Bar>
                    <Bar
                      dataKey="cancelamento"
                      name="Cancelamentos"
                      fill={categoryColors.cancelamento}
                    >
                      <LabelList dataKey="cancelamento" position="top" />
                    </Bar>
                    <Bar
                      dataKey="netGrowth"
                      name="Crescimento Líquido"
                      fill="#10b981"
                    >
                      <LabelList dataKey="netGrowth" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500">
                  Nenhum dado encontrado.
                </div>
              )}
            </div>

            {/* Total de Clientes Ativos por Ano (2022 -> atual) */}
            <div className="bg-white p-6 rounded-lg shadow-md h-[520px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Total de Clientes Ativos por Ano —{" "}
                  {clientesAtivados?.startYear ?? 2022} até{" "}
                  {clientesAtivados?.endYear ?? new Date().getFullYear()}
                </h2>
                {clientesAtivados && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">
                      Crescimento {clientesAtivados.startYear} →{" "}
                      {clientesAtivados.endYear}:
                    </span>
                    <GrowthBadge value={clientesAtivados.overallGrowth} />
                  </div>
                )}
              </div>
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <AiOutlineLoading3Quarters className="animate-spin text-4xl text-indigo-600" />
                </div>
              ) : clientesAtivadosChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="80%">
                  <BarChart
                    data={clientesAtivadosChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="total"
                      name="Clientes Ativos"
                      fill="#4f46e5"
                    >
                      <LabelList dataKey="total" position="top" />
                    </Bar>
                    <Bar
                      dataKey="desativados"
                      name="Desativados no Ano"
                      fill="#ef4444"
                    >
                      <LabelList dataKey="desativados" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500">
                  Nenhum dado encontrado.
                </div>
              )}
            </div>

            {/* Previsão até o final do ano */}
            {forecast && (
              <div className="bg-white p-6 rounded-lg shadow-md h-[560px]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      Previsão de Instalações — {year}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Real até {monthShort[forecast.cutoffMonth - 1]} +
                      projeção dos meses restantes (sazonalidade {year - 1}{" "}
                      ajustada pelo ritmo YTD)
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-indigo-50 border border-indigo-100 rounded p-2 text-center min-w-[120px]">
                      <p className="text-[10px] uppercase text-indigo-600 font-semibold">
                        Realizado YTD
                      </p>
                      <p className="text-lg font-bold text-indigo-900">
                        {forecast.realizedYTD}
                      </p>
                    </div>
                    <div className="bg-green-50 border border-green-100 rounded p-2 text-center min-w-[120px]">
                      <p className="text-[10px] uppercase text-green-700 font-semibold">
                        Projeção restante
                      </p>
                      <p className="text-lg font-bold text-green-800">
                        {forecast.projectedRemaining}
                      </p>
                    </div>
                    <div className="bg-gray-900 rounded p-2 text-center min-w-[140px]">
                      <p className="text-[10px] uppercase text-gray-300 font-semibold">
                        Total previsto {year}
                      </p>
                      <p className="text-lg font-bold text-white">
                        {forecast.projectedYearTotal}
                      </p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded p-2 text-center min-w-[160px]">
                      <p className="text-[10px] uppercase text-blue-700 font-semibold">
                        Clientes ao fim de {year}
                      </p>
                      <p className="text-lg font-bold text-blue-900">
                        {forecast.projectedClientesEOY.toLocaleString("pt-BR")}
                      </p>
                      <p className="text-[10px] text-blue-700">
                        {forecast.currentActive.toLocaleString("pt-BR")}{" "}
                        {forecast.projectedNet >= 0 ? "+" : ""}
                        {forecast.projectedNet}
                      </p>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height="82%">
                  <LineChart
                    data={forecast.chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="real"
                      stroke={categoryColors.instalacao}
                      strokeWidth={3}
                      name={`Real ${year}`}
                      connectNulls
                      activeDot={{ r: 6 }}
                    >
                      <LabelList dataKey="real" position="top" />
                    </Line>
                    <Line
                      type="monotone"
                      dataKey="previsto"
                      stroke="#10b981"
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      name="Projeção"
                      connectNulls
                    >
                      <LabelList dataKey="previsto" position="top" />
                    </Line>
                    <Line
                      type="monotone"
                      dataKey="anterior"
                      stroke="#9ca3af"
                      strokeWidth={2}
                      strokeDasharray="2 4"
                      name={`Real ${year - 1}`}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Previsão de cancelamentos até o final do ano */}
            {forecast && (
              <div className="bg-white p-6 rounded-lg shadow-md h-[560px]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      Previsão de Cancelamentos — {year}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Real até {monthShort[forecast.cutoffMonth - 1]} +
                      projeção dos meses restantes (sazonalidade {year - 1}{" "}
                      ajustada pelo ritmo YTD)
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-red-50 border border-red-100 rounded p-2 text-center min-w-[120px]">
                      <p className="text-[10px] uppercase text-red-700 font-semibold">
                        Realizado YTD
                      </p>
                      <p className="text-lg font-bold text-red-900">
                        {forecast.cancellation.realizedYTD}
                      </p>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 rounded p-2 text-center min-w-[120px]">
                      <p className="text-[10px] uppercase text-orange-700 font-semibold">
                        Projeção restante
                      </p>
                      <p className="text-lg font-bold text-orange-800">
                        {forecast.cancellation.projectedRemaining}
                      </p>
                    </div>
                    <div className="bg-gray-900 rounded p-2 text-center min-w-[140px]">
                      <p className="text-[10px] uppercase text-gray-300 font-semibold">
                        Total previsto {year}
                      </p>
                      <p className="text-lg font-bold text-white">
                        {forecast.cancellation.realizedYTD +
                          forecast.cancellation.projectedRemaining}
                      </p>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height="82%">
                  <LineChart
                    data={forecast.cancellationChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="real"
                      stroke={categoryColors.cancelamento}
                      strokeWidth={3}
                      name={`Real ${year}`}
                      connectNulls
                      activeDot={{ r: 6 }}
                    >
                      <LabelList dataKey="real" position="top" />
                    </Line>
                    <Line
                      type="monotone"
                      dataKey="previsto"
                      stroke="#f97316"
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      name="Projeção"
                      connectNulls
                    >
                      <LabelList dataKey="previsto" position="top" />
                    </Line>
                    <Line
                      type="monotone"
                      dataKey="anterior"
                      stroke="#9ca3af"
                      strokeWidth={2}
                      strokeDasharray="2 4"
                      name={`Real ${year - 1}`}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Projeção de clientes ativos até o final do ano */}
            {forecast && (
              <div className="bg-white p-6 rounded-lg shadow-md h-[500px]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      Projeção de Clientes Ativos — {year}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Acumulado mês a mês: clientes atuais + (instalações −
                      cancelamentos) projetados
                    </p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height="85%">
                  <LineChart
                    data={forecast.clientesChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis
                      domain={[
                        (dataMin: number) =>
                          Math.max(0, Math.floor(dataMin * 0.98)),
                        (dataMax: number) => Math.ceil(dataMax * 1.02),
                      ]}
                    />
                    <Tooltip
                      formatter={(value: any) =>
                        typeof value === "number"
                          ? value.toLocaleString("pt-BR")
                          : value
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="previsto"
                      stroke="#2563eb"
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      name="Clientes ativos (projeção)"
                      connectNulls
                    >
                      <LabelList
                        dataKey="previsto"
                        position="top"
                        formatter={(v: any) =>
                          typeof v === "number" ? v.toLocaleString("pt-BR") : ""
                        }
                      />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Evolução diária */}
            <div className="bg-white p-6 rounded-lg shadow-md h-[500px]">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Evolução Diária
              </h2>
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <AiOutlineLoading3Quarters className="animate-spin text-4xl text-indigo-600" />
                </div>
              ) : data && data.stats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.stats}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 40,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="day"
                      label={{
                        value: "Dia do Mês",
                        position: "insideBottomRight",
                        offset: -5,
                      }}
                    />
                    <YAxis
                      label={{
                        value: "Qtd. Tickets",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip labelFormatter={(label) => `Dia ${label}`} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="instalacao"
                      stroke={categoryColors.instalacao}
                      name="Instalação"
                      strokeWidth={2}
                      activeDot={{ r: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="renovacao"
                      stroke={categoryColors.renovacao}
                      name="Renovação"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="migracao"
                      stroke={categoryColors.migracao}
                      name="Migração"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="mudanca"
                      stroke={categoryColors.mudanca}
                      name="Mudança"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="troca"
                      stroke={categoryColors.troca}
                      name="Troca"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="cancelamento"
                      stroke={categoryColors.cancelamento}
                      name="Cancelamento"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500">
                  Nenhum dado encontrado para o período selecionado.
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md h-[600px]">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Chamados Abertos/Fechados por Atendente
              </h2>
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <AiOutlineLoading3Quarters className="animate-spin text-4xl text-indigo-600" />
                </div>
              ) : agentStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={agentStats}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 100,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="agent"
                      interval={0}
                      tickFormatter={(value) => {
                        const firstName = value.split(" ")[0];
                        return value.includes(" ")
                          ? `${firstName}...`
                          : firstName;
                      }}
                    />
                    <YAxis />
                    <Tooltip cursor={{ fill: "transparent" }} />
                    <Legend
                      verticalAlign="top"
                      wrapperStyle={{
                        paddingBottom: "20px",
                        paddingTop: "10px",
                      }}
                    />
                    <Bar
                      dataKey="opened"
                      name="Chamados Abertos"
                      fill="#8884d8"
                    >
                      <LabelList dataKey="opened" position="top" />
                    </Bar>
                    <Bar
                      dataKey="closed"
                      name="Chamados Fechados"
                      fill="#82ca9d"
                    >
                      <LabelList dataKey="closed" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500">
                  Nenhum dado encontrado para o período selecionado.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
