import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Area,
  ComposedChart,
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

interface ClientesMensalResponse {
  year: number;
  series: { month: number; total: number | null }[];
}

interface MonthlyHistoryResponse {
  startYear: number;
  endYear: number;
  series: { year: number; monthly: MonthlySeriesRow[] }[];
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
  const canUseAi = (user?.permission || 0) >= 5;
  const [data, setData] = useState<StatsResponse | null>(null);
  const [trend, setTrend] = useState<MonthlyTrendResponse | null>(null);
  const [yearly, setYearly] = useState<YearlyComparisonResponse | null>(null);
  const [clientesAtivados, setClientesAtivados] =
    useState<ClientesAtivadosResponse | null>(null);
  const [history, setHistory] = useState<MonthlyHistoryResponse | null>(null);
  const [clientesMensal, setClientesMensal] =
    useState<ClientesMensalResponse | null>(null);
  const [breakdown, setBreakdown] = useState<
    { assunto: string; total: number }[] | null
  >(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLimit, setAiLimit] = useState(100);
  const [aiResult, setAiResult] = useState<{
    year: number;
    total: number;
    analyzed: number;
    summary: string;
    categories: {
      categoria: string;
      count: number;
      percent: number;
      samples: string[];
    }[];
    items: {
      id: number;
      login: string;
      abertura: string;
      categoria: string;
      resumo: string;
    }[];
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiProgress, setAiProgress] = useState<{
    processed: number;
    total: number;
    stage: string;
    elapsedMs: number;
  } | null>(null);
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [churnLoading, setChurnLoading] = useState(false);
  const [churnJobId, setChurnJobId] = useState<string | null>(null);
  const [churnProgress, setChurnProgress] = useState<{
    processed: number;
    total: number;
    elapsedMs: number;
  } | null>(null);
  const [churnLimit, setChurnLimit] = useState(100);
  const [churnMonths, setChurnMonths] = useState(6);
  const [churnError, setChurnError] = useState<string | null>(null);
  const [churnResult, setChurnResult] = useState<{
    total: number;
    items: {
      login: string;
      nome: string;
      cidade: string;
      plano: string;
      score: number;
      sinais: string[];
      acao_sugerida: string;
      justificativa: string;
      chamadosAnalisados: number;
    }[];
  } | null>(null);
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

  const runAiAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    setChatHistory([]);
    setAiProgress({ processed: 0, total: 0, stage: "starting", elapsedMs: 0 });
    try {
      const headers = { Authorization: `Bearer ${user?.token}` };
      const baseUrl = process.env.REACT_APP_URL;

      const startRes = await axios.post(
        `${baseUrl}/chamados/analytics/cancelamentos/motivos/start`,
        null,
        { params: { year, limit: aiLimit }, headers },
      );
      const jobId = startRes.data.jobId;
      setAiJobId(jobId);

      while (true) {
        await new Promise((r) => setTimeout(r, 1500));
        const statusRes = await axios.get(
          `${baseUrl}/chamados/analytics/cancelamentos/motivos/status`,
          { params: { jobId }, headers },
        );
        const data = statusRes.data;
        setAiProgress({
          processed: data.processed || 0,
          total: data.total || 0,
          stage: data.stage,
          elapsedMs: data.elapsedMs || 0,
        });
        if (data.stage === "done") {
          setAiResult(data.result);
          break;
        }
        if (data.stage === "cancelled") {
          setAiError("Análise cancelada pelo usuário.");
          break;
        }
        if (data.stage === "error") {
          throw new Error(data.error || "Erro na análise");
        }
      }
    } catch (e: any) {
      console.error(e);
      setAiError(
        e?.response?.data?.message ||
          e?.message ||
          "Erro ao analisar cancelamentos. Verifique se o Ollama está rodando.",
      );
    } finally {
      setAiLoading(false);
      setAiProgress(null);
    }
  };

  const sendChatQuestion = async () => {
    const question = chatInput.trim();
    if (!question || !aiJobId || chatLoading) return;
    const newHistory = [
      ...chatHistory,
      { role: "user" as const, content: question },
    ];
    setChatHistory(newHistory);
    setChatInput("");
    setChatLoading(true);
    try {
      const headers = { Authorization: `Bearer ${user?.token}` };
      const baseUrl = process.env.REACT_APP_URL;
      const res = await axios.post(
        `${baseUrl}/chamados/analytics/cancelamentos/motivos/ask`,
        {
          jobId: aiJobId,
          question,
          history: chatHistory,
        },
        { headers, timeout: 300000 },
      );
      setChatHistory([
        ...newHistory,
        { role: "assistant", content: res.data.answer || "(sem resposta)" },
      ]);
    } catch (e: any) {
      setChatHistory([
        ...newHistory,
        {
          role: "assistant",
          content:
            "Erro ao consultar a IA. " +
            (e?.response?.data?.message || e?.message || ""),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const runChurnAnalysis = async () => {
    setChurnLoading(true);
    setChurnError(null);
    setChurnResult(null);
    setChurnProgress({ processed: 0, total: 0, elapsedMs: 0 });
    try {
      const headers = { Authorization: `Bearer ${user?.token}` };
      const baseUrl = process.env.REACT_APP_URL;
      const startRes = await axios.post(
        `${baseUrl}/chamados/analytics/churn-risk/start`,
        null,
        {
          params: { limit: churnLimit, months: churnMonths },
          headers,
        },
      );
      const jobId = startRes.data.jobId;
      setChurnJobId(jobId);
      while (true) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await axios.get(
          `${baseUrl}/chamados/analytics/churn-risk/status`,
          { params: { jobId }, headers },
        );
        const data = statusRes.data;
        setChurnProgress({
          processed: data.processed || 0,
          total: data.total || 0,
          elapsedMs: data.elapsedMs || 0,
        });
        if (data.stage === "done") {
          setChurnResult(data.result);
          break;
        }
        if (data.stage === "cancelled") {
          setChurnError("Análise cancelada.");
          break;
        }
        if (data.stage === "error") {
          throw new Error(data.error || "Erro na análise");
        }
      }
    } catch (e: any) {
      setChurnError(
        e?.response?.data?.message ||
          e?.message ||
          "Erro ao analisar churn-risk.",
      );
    } finally {
      setChurnLoading(false);
      setChurnProgress(null);
      setChurnJobId(null);
    }
  };

  const cancelChurnAnalysis = async () => {
    if (!churnJobId) return;
    try {
      const headers = { Authorization: `Bearer ${user?.token}` };
      const baseUrl = process.env.REACT_APP_URL;
      await axios.post(
        `${baseUrl}/chamados/analytics/churn-risk/cancel`,
        null,
        { params: { jobId: churnJobId }, headers },
      );
    } catch (e) {
      console.error("Erro ao cancelar churn:", e);
    }
  };

  const cancelAiAnalysis = async () => {
    if (!aiJobId) return;
    try {
      const headers = { Authorization: `Bearer ${user?.token}` };
      const baseUrl = process.env.REACT_APP_URL;
      await axios.post(
        `${baseUrl}/chamados/analytics/cancelamentos/motivos/cancel`,
        null,
        { params: { jobId: aiJobId }, headers },
      );
    } catch (e) {
      console.error("Erro ao cancelar análise:", e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${user?.token}` };
      const baseUrl = process.env.REACT_APP_URL;

      const [statsRes, trendRes, yearlyRes, clientesRes] = await Promise.all([
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
        axios.get<ClientesAtivadosResponse>(
          `${baseUrl}/chamados/analytics/clientes/ativados`,
          { headers },
        ),
      ]);

      setData(statsRes.data);
      setTrend(trendRes.data);
      setYearly(yearlyRes.data);
      setClientesAtivados(clientesRes.data);

      try {
        const breakdownRes = await axios.get<{
          breakdown: { assunto: string; total: number }[];
        }>(
          `${baseUrl}/chamados/analytics/instalacoes/diagnostico`,
          { params: { year }, headers },
        );
        setBreakdown(breakdownRes.data.breakdown);
      } catch (e) {
        console.error("Erro no diagnóstico de assuntos:", e);
      }

      try {
        const historyRes = await axios.get<MonthlyHistoryResponse>(
          `${baseUrl}/chamados/analytics/instalacoes/historico-mensal`,
          { params: { years: 5, endYear: year }, headers },
        );
        setHistory(historyRes.data);
      } catch (e) {
        console.error("Erro no histórico mensal:", e);
      }

      try {
        const clientesMensalRes = await axios.get<ClientesMensalResponse>(
          `${baseUrl}/chamados/analytics/clientes/mensal`,
          { params: { year }, headers },
        );
        setClientesMensal(clientesMensalRes.data);
      } catch (e) {
        console.error("Erro nos snapshots mensais de clientes:", e);
      }
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

      // Build known points from multi-year history. If history is unavailable,
      // fall back to previousYear + currentYear YTD (2 years).
      const knownPoints: { x: number; y: number; m: number }[] = [];
      const historyYears = history?.series ?? [];
      const currentYearIdx = historyYears.findIndex((s) => s.year === year);
      const pastYears =
        currentYearIdx >= 0
          ? historyYears.slice(0, currentYearIdx)
          : [{ year: year - 1, monthly: previous as MonthlySeriesRow[] }];

      let x = 0;
      pastYears.forEach((yr) => {
        yr.monthly.forEach((row, i) => {
          knownPoints.push({ x, y: (row as any)[key] || 0, m: i });
          x++;
        });
      });
      current.slice(0, cutoff).forEach((row, i) => {
        knownPoints.push({ x, y: row[key] || 0, m: i });
        x++;
      });

      // Seasonal index (additive): per-month mean − overall mean
      const seasonalSum = Array(12).fill(0);
      const seasonalCount = Array(12).fill(0);
      knownPoints.forEach((p) => {
        seasonalSum[p.m] += p.y;
        seasonalCount[p.m] += 1;
      });
      const overallMean =
        knownPoints.reduce((a, p) => a + p.y, 0) / knownPoints.length;
      const seasonalIndex = seasonalSum.map((s, i) =>
        seasonalCount[i] > 0 ? s / seasonalCount[i] - overallMean : 0,
      );

      // Deseasonalized series + linear regression
      const deseasoned = knownPoints.map((p) => ({
        x: p.x,
        y: p.y - seasonalIndex[p.m],
      }));
      const n = deseasoned.length;
      const sumX = deseasoned.reduce((a, p) => a + p.x, 0);
      const sumY = deseasoned.reduce((a, p) => a + p.y, 0);
      const sumXY = deseasoned.reduce((a, p) => a + p.x * p.y, 0);
      const sumX2 = deseasoned.reduce((a, p) => a + p.x * p.x, 0);
      const denom = n * sumX2 - sumX * sumX;
      const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      const intercept = n > 0 ? (sumY - slope * sumX) / n : 0;

      const baseXForCurrentYear = pastYears.length * 12;
      const remaining = current.map((_, i) => {
        if (i < cutoff) return 0;
        const xFuture = baseXForCurrentYear + i;
        const trend = slope * xFuture + intercept;
        return Math.max(0, Math.round(trend + seasonalIndex[i]));
      });

      // What the model would have predicted for every month of the year
      // (used for projection-vs-reality comparison on past months)
      const predicted = current.map((_, i) => {
        const xMonth = baseXForCurrentYear + i;
        const trend = slope * xMonth + intercept;
        return Math.max(0, Math.round(trend + seasonalIndex[i]));
      });

      // Residual standard deviation over the entire training set
      // (used to draw a ±1σ confidence band around the model line)
      const residuals = knownPoints.map((p) => {
        const fitted = slope * p.x + intercept + seasonalIndex[p.m];
        return p.y - fitted;
      });
      const residualMean =
        residuals.reduce((a, v) => a + v, 0) / (residuals.length || 1);
      const residualVar =
        residuals.length > 1
          ? residuals.reduce(
              (a, v) => a + (v - residualMean) ** 2,
              0,
            ) /
            (residuals.length - 1)
          : 0;
      const residualStd = Math.sqrt(residualVar);

      return {
        realizedYTD,
        remaining,
        predicted,
        residualStd,
        projectedRemaining: remaining.reduce((a, v) => a + v, 0),
        slope,
        intercept,
        seasonalIndex,
      };
    };

    const inst = projectByCategory("instalacao");
    const canc = projectByCategory("cancelamento");

    const chartData = current.map((row, i) => {
      const isPast = i < cutoff;
      const lo = Math.max(0, inst.predicted[i] - inst.residualStd);
      const hi = inst.predicted[i] + inst.residualStd;
      return {
        month: monthShort[i],
        real: isPast ? row.instalacao : null,
        modelo: inst.predicted[i],
        modeloRange: [lo, hi] as [number, number],
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
      const lo = Math.max(0, canc.predicted[i] - canc.residualStd);
      const hi = canc.predicted[i] + canc.residualStd;
      return {
        month: monthShort[i],
        real: isPast ? row.cancelamento : null,
        modelo: canc.predicted[i],
        modeloRange: [lo, hi] as [number, number],
        previsto:
          i === cutoff - 1
            ? row.cancelamento
            : isPast
              ? null
              : canc.remaining[i],
        anterior: previous[i]?.cancelamento ?? 0,
      };
    });

    const series = clientesAtivados?.series ?? [];
    const currentEntry = series.find((s) => s.year === year);
    const previousEntry = series.find((s) => s.year === year - 1);
    const currentActive =
      currentEntry?.total ??
      series[series.length - 1]?.total ??
      0;
    const previousYearEnd =
      previousEntry?.total ??
      series[series.length - 2]?.total ??
      currentActive;

    const realClientChangeYTD = currentActive - previousYearEnd;
    const operationalNetYTD = inst.realizedYTD - canc.realizedYTD;

    const conversionRatio =
      operationalNetYTD !== 0
        ? realClientChangeYTD / operationalNetYTD
        : null;

    // Reconstruct real client count month-by-month from realized chamados
    const realActiveByMonth: number[] = [];
    let runningReal = previousYearEnd;
    for (let i = 0; i < cutoff; i++) {
      const opNet =
        (current[i]?.instalacao || 0) - (current[i]?.cancelamento || 0);
      const delta =
        conversionRatio !== null
          ? opNet * conversionRatio
          : cutoff > 0
            ? realClientChangeYTD / cutoff
            : 0;
      runningReal += delta;
      realActiveByMonth.push(runningReal);
    }

    // Build projection curve for the entire year using the model predictions
    const projectedActiveByMonth: number[] = [];
    let runningProj = previousYearEnd;
    for (let i = 0; i < 12; i++) {
      const opNetPred =
        (inst.predicted[i] || 0) - (canc.predicted[i] || 0);
      const delta =
        conversionRatio !== null
          ? opNetPred * conversionRatio
          : cutoff > 0
            ? realClientChangeYTD / cutoff
            : 0;
      runningProj += delta;
      projectedActiveByMonth.push(runningProj);
    }

    // Forward-running curve from currentActive using operational projections
    let runningFromCurrent = currentActive;
    const forwardFromCurrent: (number | null)[] = current.map((_row, i) => {
      if (i < cutoff) return null;
      const opNet = (inst.remaining[i] || 0) - (canc.remaining[i] || 0);
      const delta =
        conversionRatio !== null
          ? Math.round(opNet * conversionRatio)
          : Math.round(cutoff > 0 ? realClientChangeYTD / cutoff : 0);
      runningFromCurrent += delta;
      return runningFromCurrent;
    });

    // Confidence band for clientes: stdev of the net (inst − canc) residuals,
    // converted to client space, then accumulated over time (sqrt-of-time scaling)
    const netStd =
      conversionRatio !== null
        ? Math.sqrt(
            (inst.residualStd ** 2 + canc.residualStd ** 2) *
              conversionRatio ** 2,
          )
        : 0;

    const monthlyRealSnapshots = clientesMensal?.series ?? [];

    const clientesChartData = current.map((_row, i) => {
      const isPast = i < cutoff;
      const stepsFromStart = i + 1;
      const accumulatedStd = netStd * Math.sqrt(stepsFromStart);
      const modeloVal = Math.round(projectedActiveByMonth[i]);
      const snapshot = monthlyRealSnapshots.find((s) => s.month === i + 1);
      const realValue =
        snapshot && snapshot.total !== null
          ? snapshot.total
          : isPast
            ? Math.round(realActiveByMonth[i])
            : null;
      return {
        month: monthShort[i],
        real: realValue,
        modelo: modeloVal,
        modeloRange: [
          Math.round(modeloVal - accumulatedStd),
          Math.round(modeloVal + accumulatedStd),
        ] as [number, number],
        previsto:
          i === cutoff - 1
            ? currentActive
            : i >= cutoff
              ? forwardFromCurrent[i]
              : null,
      };
    });

    const projectedNet = runningFromCurrent - currentActive;

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
      realClientChangeYTD,
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
                {(() => {
                  const monthSeries = clientesMensal?.series ?? [];
                  const yearEnd = clientesAtivados?.series?.find(
                    (s) => s.year === year,
                  )?.total;
                  const prevYearEnd = clientesAtivados?.series?.find(
                    (s) => s.year === year - 1,
                  )?.total;

                  const selectedMonthSnap = monthSeries.find(
                    (s) => s.month === month,
                  )?.total;
                  const previousMonthSnap =
                    month === 1
                      ? (prevYearEnd ?? null)
                      : (monthSeries.find((s) => s.month === month - 1)
                          ?.total ?? null);
                  const monthNet =
                    selectedMonthSnap !== undefined &&
                    selectedMonthSnap !== null &&
                    previousMonthSnap !== null
                      ? selectedMonthSnap - previousMonthSnap
                      : null;

                  const yearNet =
                    yearEnd !== undefined && prevYearEnd !== undefined
                      ? yearEnd - prevYearEnd
                      : null;

                  return (
                    <>
                      <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-indigo-500">
                        <p className="text-xs text-gray-500 uppercase">
                          Crescimento Líquido Mês
                        </p>
                        <p
                          className={`text-xl font-bold ${
                            monthNet === null
                              ? "text-gray-400"
                              : monthNet >= 0
                                ? "text-green-600"
                                : "text-red-600"
                          }`}
                        >
                          {monthNet === null
                            ? "—"
                            : `${monthNet >= 0 ? "+" : ""}${monthNet}`}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          clientes ativos (fim do mês)
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-indigo-500">
                        <p className="text-xs text-gray-500 uppercase">
                          Crescimento Líquido Ano
                        </p>
                        <p
                          className={`text-xl font-bold ${
                            yearNet === null
                              ? "text-gray-400"
                              : yearNet >= 0
                                ? "text-green-600"
                                : "text-red-600"
                          }`}
                        >
                          {yearNet === null
                            ? "—"
                            : `${yearNet >= 0 ? "+" : ""}${yearNet}`}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          clientes ativos (vs ano anterior)
                        </p>
                      </div>
                    </>
                  );
                })()}
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
                      projeção dos meses restantes (regressão linear +
                      sazonalidade aditiva, base{" "}
                      {history
                        ? `${history.startYear}–${history.endYear}`
                        : `${year - 1}–${year}`}
                      )
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
                    <div className="bg-purple-50 border border-purple-100 rounded p-2 text-center min-w-[140px]">
                      <p className="text-[10px] uppercase text-purple-700 font-semibold">
                        Média/mês {year}
                      </p>
                      <p className="text-lg font-bold text-purple-900">
                        {(forecast.projectedYearTotal / 12).toFixed(1)}
                      </p>
                      <p className="text-[10px] text-purple-700">
                        YTD:{" "}
                        {(
                          forecast.realizedYTD / forecast.cutoffMonth
                        ).toFixed(1)}
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
                  <ComposedChart
                    data={forecast.chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="modeloRange"
                      stroke="none"
                      fill="#9333ea"
                      fillOpacity={0.12}
                      name="Banda ±1σ"
                      legendType="rect"
                    />
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
                      dataKey="modelo"
                      stroke="#9333ea"
                      strokeWidth={2}
                      strokeDasharray="2 4"
                      name="Modelo (regressão)"
                      dot={false}
                    />
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
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Diagnóstico: distintos assuntos contados como Instalação */}
            {breakdown && breakdown.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      Diagnóstico — Assuntos contados como "Instalação" ({year}
                      )
                    </h2>
                    <p className="text-xs text-gray-500">
                      Total: {breakdown.reduce((a, r) => a + r.total, 0)}{" "}
                      chamados. Verifique se algum tipo não deveria estar sendo
                      contado.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowBreakdown((s) => !s)}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    {showBreakdown ? "Ocultar" : "Mostrar"} detalhes
                  </button>
                </div>
                {showBreakdown && (
                  <div className="overflow-x-auto mt-2">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600 uppercase text-xs">
                          <th className="px-3 py-2 text-left">Assunto</th>
                          <th className="px-3 py-2 text-right">Qtd</th>
                          <th className="px-3 py-2 text-right">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const total = breakdown.reduce(
                            (a, r) => a + r.total,
                            0,
                          );
                          return breakdown.map((row) => (
                            <tr
                              key={row.assunto}
                              className="border-t border-gray-100"
                            >
                              <td className="px-3 py-2 text-gray-800">
                                {row.assunto}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold">
                                {row.total}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-500">
                                {total > 0
                                  ? ((row.total / total) * 100).toFixed(1)
                                  : "0"}
                                %
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
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
                      projeção dos meses restantes (regressão linear +
                      sazonalidade aditiva, base{" "}
                      {history
                        ? `${history.startYear}–${history.endYear}`
                        : `${year - 1}–${year}`}
                      )
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
                    <div className="bg-purple-50 border border-purple-100 rounded p-2 text-center min-w-[140px]">
                      <p className="text-[10px] uppercase text-purple-700 font-semibold">
                        Média/mês {year}
                      </p>
                      <p className="text-lg font-bold text-purple-900">
                        {(
                          (forecast.cancellation.realizedYTD +
                            forecast.cancellation.projectedRemaining) /
                          12
                        ).toFixed(1)}
                      </p>
                      <p className="text-[10px] text-purple-700">
                        YTD:{" "}
                        {(
                          forecast.cancellation.realizedYTD /
                          forecast.cutoffMonth
                        ).toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height="82%">
                  <ComposedChart
                    data={forecast.cancellationChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="modeloRange"
                      stroke="none"
                      fill="#9333ea"
                      fillOpacity={0.12}
                      name="Banda ±1σ"
                      legendType="rect"
                    />
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
                      dataKey="modelo"
                      stroke="#9333ea"
                      strokeWidth={2}
                      strokeDasharray="2 4"
                      name="Modelo (regressão)"
                      dot={false}
                    />
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
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Projeção de clientes ativos até o final do ano */}
            {forecast && (
              <div className="bg-white p-6 rounded-lg shadow-md h-[520px]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      Projeção de Clientes Ativos — {year}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Linha sólida: clientes ativos reais (snapshot fim de cada
                      mês). Tracejado roxo: previsão do modelo. Banda roxa:
                      ±1σ. Tracejado verde: projeção futura.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {(() => {
                      const totalNet =
                        forecast.realClientChangeYTD + forecast.projectedNet;
                      const avgMes = totalNet / 12;
                      const ytdAvg =
                        forecast.cutoffMonth > 0
                          ? forecast.realClientChangeYTD / forecast.cutoffMonth
                          : 0;
                      return (
                        <div className="bg-green-50 border border-green-200 rounded p-2 text-center min-w-[180px]">
                          <p className="text-[10px] uppercase text-green-700 font-semibold">
                            Média líquida/mês {year}
                          </p>
                          <p
                            className={`text-lg font-bold ${
                              avgMes >= 0 ? "text-green-800" : "text-red-700"
                            }`}
                          >
                            {avgMes >= 0 ? "+" : ""}
                            {avgMes.toFixed(1)}
                          </p>
                          <p className="text-[10px] text-green-700">
                            YTD: {ytdAvg >= 0 ? "+" : ""}
                            {ytdAvg.toFixed(1)} cliente/mês
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height="85%">
                  <ComposedChart
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
                    <Area
                      type="monotone"
                      dataKey="modeloRange"
                      stroke="none"
                      fill="#9333ea"
                      fillOpacity={0.12}
                      name="Banda ±1σ"
                      legendType="rect"
                    />
                    <Line
                      type="monotone"
                      dataKey="real"
                      stroke="#2563eb"
                      strokeWidth={3}
                      name="Real (reconstruído)"
                      connectNulls
                      activeDot={{ r: 6 }}
                    >
                      <LabelList
                        dataKey="real"
                        position="top"
                        formatter={(v: any) =>
                          typeof v === "number" ? v.toLocaleString("pt-BR") : ""
                        }
                      />
                    </Line>
                    <Line
                      type="monotone"
                      dataKey="modelo"
                      stroke="#9333ea"
                      strokeWidth={2}
                      strokeDasharray="2 4"
                      name="Modelo (regressão)"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="previsto"
                      stroke="#10b981"
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      name="Projeção (a partir do real)"
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
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Análise de motivos de cancelamento via IA (Ollama local) */}
            {canUseAi && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Motivos de Cancelamento — Análise por IA ({year})
                  </h2>
                  <p className="text-xs text-gray-500">
                    Lê as mensagens dos chamados de cancelamento via Ollama
                    (modelo local) e agrupa por motivo. Pode levar alguns
                    minutos dependendo do volume.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">
                    Máx. chamados:
                  </label>
                  <input
                    type="number"
                    value={aiLimit}
                    onChange={(e) =>
                      setAiLimit(
                        Math.max(
                          10,
                          Math.min(1000, Number(e.target.value) || 100),
                        ),
                      )
                    }
                    className="w-20 p-1 border border-gray-300 rounded text-sm"
                  />
                  <button
                    onClick={runAiAnalysis}
                    disabled={aiLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {aiLoading ? (
                      <>
                        <AiOutlineLoading3Quarters className="animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      "Analisar com IA"
                    )}
                  </button>
                  {aiLoading && aiJobId && (
                    <button
                      onClick={cancelAiAnalysis}
                      className="px-4 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700"
                    >
                      Parar
                    </button>
                  )}
                </div>
              </div>

              {aiLoading && aiProgress && (
                <div className="bg-indigo-50 border border-indigo-200 rounded p-3 mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-700 mb-1">
                    <span>
                      {aiProgress.stage === "starting" &&
                        "Iniciando análise..."}
                      {aiProgress.stage === "classifying" &&
                        `Classificando chamados: ${aiProgress.processed}/${aiProgress.total}`}
                      {aiProgress.stage === "summarizing" &&
                        "Gerando diagnóstico geral..."}
                    </span>
                    <span className="text-gray-500">
                      {Math.floor(aiProgress.elapsedMs / 1000)}s
                      {aiProgress.total > 0 &&
                        aiProgress.processed > 0 &&
                        aiProgress.stage === "classifying" &&
                        ` · ETA ${Math.max(
                          0,
                          Math.round(
                            (aiProgress.elapsedMs / aiProgress.processed) *
                              (aiProgress.total - aiProgress.processed) /
                              1000,
                          ),
                        )}s`}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        aiProgress.stage === "summarizing"
                          ? "bg-purple-500 animate-pulse"
                          : "bg-indigo-500"
                      }`}
                      style={{
                        width:
                          aiProgress.stage === "summarizing"
                            ? "95%"
                            : aiProgress.total > 0
                              ? `${Math.round(
                                  (aiProgress.processed / aiProgress.total) *
                                    90,
                                )}%`
                              : "5%",
                      }}
                    />
                  </div>
                </div>
              )}

              {aiError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-3 text-sm">
                  {aiError}
                </div>
              )}

              {aiResult && (
                <>
                  <div className="text-xs text-gray-500 mb-3">
                    {aiResult.total} de {aiResult.analyzed} chamados
                    classificados. Apenas os que tinham mensagem entram no
                    resumo.
                  </div>

                  {aiResult.summary && (
                    <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded mb-4">
                      <h3 className="font-bold text-indigo-900 mb-2">
                        Diagnóstico Geral
                      </h3>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {aiResult.summary}
                      </div>
                    </div>
                  )}

                  {aiJobId && (
                    <div className="border border-gray-200 rounded p-4 mb-4 bg-white">
                      <h3 className="font-bold text-gray-800 mb-2">
                        Perguntar à IA sobre esta análise
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Faça perguntas em cima dos dados acima — ex.: "quantos
                        cancelaram por mudança?", "tem cliente com reclamação
                        de preço?", "qual é o padrão de fim de semana?".
                      </p>

                      {chatHistory.length > 0 && (
                        <div className="max-h-80 overflow-y-auto space-y-2 mb-3 border border-gray-100 rounded p-2 bg-gray-50">
                          {chatHistory.map((m, i) => (
                            <div
                              key={i}
                              className={`text-sm p-2 rounded ${
                                m.role === "user"
                                  ? "bg-indigo-100 text-indigo-900"
                                  : "bg-white border border-gray-200 text-gray-800"
                              }`}
                            >
                              <div className="text-[10px] uppercase font-bold mb-1 opacity-60">
                                {m.role === "user" ? "Você" : "IA"}
                              </div>
                              <div className="whitespace-pre-wrap">
                                {m.content}
                              </div>
                            </div>
                          ))}
                          {chatLoading && (
                            <div className="text-xs text-gray-500 italic flex items-center gap-2 p-2">
                              <AiOutlineLoading3Quarters className="animate-spin" />
                              Pensando...
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendChatQuestion();
                            }
                          }}
                          disabled={chatLoading}
                          placeholder="Digite sua pergunta..."
                          className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          onClick={sendChatQuestion}
                          disabled={chatLoading || !chatInput.trim()}
                          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  )}

                  <details className="mb-4">
                    <summary className="cursor-pointer text-sm text-indigo-600 hover:underline font-semibold">
                      Ver distribuição por categoria
                    </summary>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    {aiResult.categories.map((cat) => (
                      <div
                        key={cat.categoria}
                        className="border border-gray-200 rounded p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-gray-800">
                            {cat.categoria}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-indigo-700">
                              {cat.count}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({cat.percent}%)
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded overflow-hidden mb-2">
                          <div
                            className="h-full bg-indigo-500"
                            style={{ width: `${cat.percent}%` }}
                          />
                        </div>
                        {cat.samples.length > 0 && (
                          <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
                            {cat.samples.map((s, i) => (
                              <li key={i}>"{s}"</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                    </div>
                  </details>

                  <details className="text-sm">
                    <summary className="cursor-pointer text-indigo-600 hover:underline">
                      Ver todos os {aiResult.items.length} chamados
                      classificados
                    </summary>
                    <div className="overflow-x-auto mt-2">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-gray-600 uppercase">
                            <th className="px-2 py-1 text-left">Data</th>
                            <th className="px-2 py-1 text-left">Login</th>
                            <th className="px-2 py-1 text-left">Categoria</th>
                            <th className="px-2 py-1 text-left">Resumo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiResult.items.map((it) => (
                            <tr
                              key={it.id}
                              className="border-t border-gray-100"
                            >
                              <td className="px-2 py-1 text-gray-500">
                                {it.abertura
                                  ? new Date(it.abertura).toLocaleDateString(
                                      "pt-BR",
                                    )
                                  : "—"}
                              </td>
                              <td className="px-2 py-1 text-gray-800">
                                {it.login}
                              </td>
                              <td className="px-2 py-1">{it.categoria}</td>
                              <td className="px-2 py-1 text-gray-600">
                                {it.resumo}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              )}
            </div>
            )}

            {/* Clientes em risco de churn (IA) */}
            {canUseAi && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Clientes em Risco de Churn — IA
                  </h2>
                  <p className="text-xs text-gray-500">
                    Analisa clientes ativos com chamados recentes e classifica
                    o risco de cancelamento.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Últimos</label>
                  <input
                    type="number"
                    value={churnMonths}
                    onChange={(e) =>
                      setChurnMonths(
                        Math.max(1, Math.min(24, Number(e.target.value) || 6)),
                      )
                    }
                    className="w-16 p-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-xs text-gray-600">meses, máx.</span>
                  <input
                    type="number"
                    value={churnLimit}
                    onChange={(e) =>
                      setChurnLimit(
                        Math.max(
                          10,
                          Math.min(2000, Number(e.target.value) || 100),
                        ),
                      )
                    }
                    className="w-20 p-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-xs text-gray-600">clientes</span>
                  <button
                    onClick={runChurnAnalysis}
                    disabled={churnLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {churnLoading ? (
                      <>
                        <AiOutlineLoading3Quarters className="animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      "Analisar Churn"
                    )}
                  </button>
                  {churnLoading && churnJobId && (
                    <button
                      onClick={cancelChurnAnalysis}
                      className="px-4 py-2 bg-gray-600 text-white rounded font-semibold hover:bg-gray-700"
                    >
                      Parar
                    </button>
                  )}
                </div>
              </div>

              {churnLoading && churnProgress && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-700 mb-1">
                    <span>
                      Analisando clientes: {churnProgress.processed}/
                      {churnProgress.total || "?"}
                    </span>
                    <span className="text-gray-500">
                      {Math.floor(churnProgress.elapsedMs / 1000)}s
                      {churnProgress.total > 0 &&
                        churnProgress.processed > 0 &&
                        ` · ETA ${Math.max(
                          0,
                          Math.round(
                            (churnProgress.elapsedMs /
                              churnProgress.processed) *
                              (churnProgress.total - churnProgress.processed) /
                              1000,
                          ),
                        )}s`}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all duration-500"
                      style={{
                        width:
                          churnProgress.total > 0
                            ? `${Math.round(
                                (churnProgress.processed /
                                  churnProgress.total) *
                                  100,
                              )}%`
                            : "5%",
                      }}
                    />
                  </div>
                </div>
              )}

              {churnError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-3 text-sm">
                  {churnError}
                </div>
              )}

              {churnResult && churnResult.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 uppercase text-xs">
                        <th className="px-2 py-2 text-left">Login</th>
                        <th className="px-2 py-2 text-left">Nome</th>
                        <th className="px-2 py-2 text-left">Cidade</th>
                        <th className="px-2 py-2 text-left">Plano</th>
                        <th className="px-2 py-2 text-center">Score</th>
                        <th className="px-2 py-2 text-left">Sinais</th>
                        <th className="px-2 py-2 text-left">Ação sugerida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {churnResult.items.map((it) => {
                        const color =
                          it.score >= 70
                            ? "bg-red-100 text-red-800"
                            : it.score >= 40
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-green-100 text-green-800";
                        return (
                          <tr
                            key={it.login}
                            className="border-t border-gray-100 hover:bg-gray-50"
                          >
                            <td className="px-2 py-2 font-mono text-xs">
                              {it.login}
                            </td>
                            <td className="px-2 py-2">{it.nome}</td>
                            <td className="px-2 py-2 text-gray-600">
                              {it.cidade}
                            </td>
                            <td className="px-2 py-2 text-gray-600">
                              {it.plano}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <span
                                className={`inline-block px-2 py-1 rounded font-bold ${color}`}
                              >
                                {it.score}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-xs text-gray-700">
                              <ul className="list-disc pl-4 space-y-0.5">
                                {it.sinais.slice(0, 3).map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </td>
                            <td className="px-2 py-2 text-xs text-gray-700">
                              {it.acao_sugerida}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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

          </div>
        </div>
      </div>
    </>
  );
};
