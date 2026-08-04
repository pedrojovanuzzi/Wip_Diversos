import React, { useCallback, useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import axios from "axios";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import {
  FaDownload,
  FaUpload,
  FaChartBar,
  FaRegCalendarAlt,
  FaRegClock,
  FaSearch,
  FaSortAmountDown,
} from "react-icons/fa";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";

interface Consumer {
  username: string;
  nome: string;
  plano: string;
  download: number;
  upload: number;
  total: number;
}

interface TimeSeriesRow {
  dia: string;
  download: number;
  upload: number;
}

interface ConsumoResponse {
  range: { start: string; end: string };
  totals: { download: number; upload: number; total: number };
  topConsumers: Consumer[];
  timeSeries: TimeSeriesRow[];
}

const DOWNLOAD_COLOR = "#4f46e5";
const UPLOAD_COLOR = "#10b981";

const fmtBytes = (b: number): string => {
  if (!b || b <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
  return `${(b / Math.pow(1024, i)).toFixed(2)} ${u[i]}`;
};

const toGB = (b: number): number =>
  Number((b / Math.pow(1024, 3)).toFixed(3));

const todayStr = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}> = ({ title, value, icon, accent }) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
    <div
      className="w-12 h-12 rounded-xl grid place-items-center text-white text-xl"
      style={{ backgroundColor: accent }}
    >
      {icon}
    </div>
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
        {title}
      </p>
      <p className="text-xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

export const ConsumoClientes: React.FC = () => {
  const { user } = useAuth();

  const [startDate, setStartDate] = useState(todayStr(-29));
  const [endDate, setEndDate] = useState(todayStr(0));
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<"total" | "download" | "upload">("total");

  const [data, setData] = useState<ConsumoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const response = await axios.get<ConsumoResponse>(
        process.env.REACT_APP_URL + "/ClientAnalytics/Consumo",
        {
          params: {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            startTime: startTime || undefined,
            endTime: endTime || undefined,
            limit,
            search: search || undefined,
            order,
          },
          headers: { Authorization: `Bearer ${user?.token}` },
          timeout: 120000,
        },
      );
      setData(response.data);
    } catch (err: any) {
      setErro(
        err?.response?.data?.error ||
          "Erro ao carregar o consumo dos clientes.",
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, startDate, endDate, startTime, endTime, limit, search, order]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const serieChart =
    data?.timeSeries.map((r) => ({
      dia: r.dia.slice(5), // MM-DD
      Download: toGB(r.download),
      Upload: toGB(r.upload),
    })) ?? [];

  const topChart =
    data?.topConsumers.slice(0, 12).map((c) => ({
      nome: c.nome ? c.nome.split(" ")[0] : c.username,
      username: c.username,
      Download: toGB(c.download),
      Upload: toGB(c.upload),
    })) ?? [];

  const tooltipGB = (value: number) => `${value} GB`;

  return (
    <div className="min-h-screen bg-gray-100 sm:p-2">
      <NavBar />
      <div className="sm:ml-32 p-4 md:p-8 max-w-[1400px] mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-800 flex items-center gap-2">
            <FaChartBar className="text-green-500" /> Consumo dos Clientes
          </h1>
          <p className="text-gray-500 text-sm">
            Download e upload por cliente (dados de accounting/radacct) e ranking
            dos que mais consomem.
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 shadow-sm">
          {/* Intervalo de data + hora */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Início */}
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-green-50 to-white p-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-green-700 mb-2">
                <FaRegCalendarAlt /> Início do período
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex items-center gap-2 flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-green-400">
                  <FaRegCalendarAlt className="text-gray-400 shrink-0" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 sm:w-32 bg-white border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-green-400">
                  <FaRegClock className="text-gray-400 shrink-0" />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>
            {/* Fim */}
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-sky-50 to-white p-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-700 mb-2">
                <FaRegCalendarAlt /> Fim do período
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex items-center gap-2 flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-sky-400">
                  <FaRegCalendarAlt className="text-gray-400 shrink-0" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 sm:w-32 bg-white border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-sky-400">
                  <FaRegClock className="text-gray-400 shrink-0" />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Demais filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                <FaSortAmountDown className="text-gray-400" /> Ordenar por
              </label>
              <select
                value={order}
                onChange={(e) => setOrder(e.target.value as any)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="total">Total</option>
                <option value="download">Download</option>
                <option value="upload">Upload</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-500 mb-1">
                Top (qtd.)
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-500 mb-1">
                PPPoE (busca)
              </label>
              <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-green-400">
                <FaSearch className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={search}
                  placeholder="login..."
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchData()}
                  className="w-full bg-transparent text-sm focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="h-[42px] bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-bold rounded-lg px-4 text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <AiOutlineLoading3Quarters className="animate-spin" />
              ) : (
                <>
                  <FaSearch /> Filtrar
                </>
              )}
            </button>
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
            {erro}
          </div>
        )}

        {/* Cards de totais */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard
            title="Download total"
            value={fmtBytes(data?.totals.download ?? 0)}
            icon={<FaDownload />}
            accent={DOWNLOAD_COLOR}
          />
          <StatCard
            title="Upload total"
            value={fmtBytes(data?.totals.upload ?? 0)}
            icon={<FaUpload />}
            accent={UPLOAD_COLOR}
          />
          <StatCard
            title="Consumo total"
            value={fmtBytes(data?.totals.total ?? 0)}
            icon={<FaChartBar />}
            accent="#0ea5e9"
          />
        </div>

        {/* Série temporal */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">
            Consumo por dia (GB)
          </h2>
          {loading ? (
            <div className="h-72 grid place-items-center text-gray-400">
              <AiOutlineLoading3Quarters className="animate-spin text-3xl" />
            </div>
          ) : serieChart.length === 0 ? (
            <div className="h-72 grid place-items-center text-gray-400 text-sm">
              Sem dados no período selecionado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <AreaChart data={serieChart}>
                <defs>
                  <linearGradient id="gDown" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={DOWNLOAD_COLOR} stopOpacity={0.7} />
                    <stop offset="95%" stopColor={DOWNLOAD_COLOR} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gUp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={UPLOAD_COLOR} stopOpacity={0.7} />
                    <stop offset="95%" stopColor={UPLOAD_COLOR} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit=" GB" width={70} />
                <Tooltip formatter={tooltipGB} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Download"
                  stroke={DOWNLOAD_COLOR}
                  fill="url(#gDown)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Upload"
                  stroke={UPLOAD_COLOR}
                  fill="url(#gUp)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar chart top consumidores */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">
            Maiores consumidores (GB)
          </h2>
          {topChart.length === 0 ? (
            <div className="h-72 grid place-items-center text-gray-400 text-sm">
              Sem dados no período selecionado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(288, topChart.length * 34)}>
              <BarChart
                data={topChart}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 12 }} unit=" GB" />
                <YAxis
                  type="category"
                  dataKey="username"
                  tick={{ fontSize: 12 }}
                  width={120}
                />
                <Tooltip formatter={tooltipGB} />
                <Legend />
                <Bar dataKey="Download" stackId="a" fill={DOWNLOAD_COLOR} />
                <Bar dataKey="Upload" stackId="a" fill={UPLOAD_COLOR} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">PPPoE</th>
                  <th className="px-4 py-3 font-semibold">Plano</th>
                  <th className="px-4 py-3 font-semibold text-right">Download</th>
                  <th className="px-4 py-3 font-semibold text-right">Upload</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topConsumers ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-gray-400"
                    >
                      Nenhum consumo encontrado.
                    </td>
                  </tr>
                )}
                {(data?.topConsumers ?? []).map((c, idx) => (
                  <tr
                    key={c.username}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-400 font-semibold">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {c.nome || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.username}</td>
                    <td className="px-4 py-3 text-gray-600">{c.plano || "—"}</td>
                    <td className="px-4 py-3 text-right text-indigo-600 font-medium">
                      {fmtBytes(c.download)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                      {fmtBytes(c.upload)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800">
                      {fmtBytes(c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsumoClientes;
