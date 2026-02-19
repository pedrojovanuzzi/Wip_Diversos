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

interface Totals {
  instalacao: number;
  renovacao: number;
  migracao: number;
  mudanca: number;
  troca: number;
  cancelamento: number;
}

export const GraficoInstalacoes = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<InstallationStat[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [yearTotals, setYearTotals] = useState<Totals | null>(null);
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
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/chamados/analytics/instalacoes`,
        {
          params: { month, year },
          headers: {
            Authorization: `Bearer ${user?.token}`,
          },
        },
      );
      setStats(response.data.stats);
      setTotals(response.data.totals);
      setYearTotals(response.data.yearTotals);

      const agentResponse = await axios.get(
        `${process.env.REACT_APP_URL}/chamados/analytics/agents`,
        {
          params: { month, year },
          headers: {
            Authorization: `Bearer ${user?.token}`,
          },
        },
      );
      setAgentStats(agentResponse.data);
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
                {totals &&
                  Object.entries(totals).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-gray-50 p-2 rounded border border-gray-200 shadow-sm text-center"
                    >
                      <p className="text-xs text-gray-500 uppercase font-semibold">
                        {key}
                      </p>
                      <p className="text-lg font-bold text-gray-800">{value}</p>
                    </div>
                  ))}
              </div>
            </div>

            {/* Yearly Totals */}
            <div>
              <h2 className="text-sm font-bold text-gray-500 uppercase mb-2">
                Acumulado do Ano {year}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {yearTotals &&
                  Object.entries(yearTotals).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-indigo-50 p-2 rounded border border-indigo-100 shadow-sm text-center"
                    >
                      <p className="text-xs text-indigo-600 uppercase font-semibold">
                        {key}
                      </p>
                      <p className="text-lg font-bold text-indigo-900">
                        {value}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md h-[500px]">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Evolução Diária
              </h2>
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <AiOutlineLoading3Quarters className="animate-spin text-4xl text-indigo-600" />
                </div>
              ) : stats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={stats}
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
                      stroke="#4f46e5"
                      name="Instalação"
                      strokeWidth={2}
                      activeDot={{ r: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="renovacao"
                      stroke="#10b981"
                      name="Renovação"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="migracao"
                      stroke="#f59e0b"
                      name="Migração"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="mudanca"
                      stroke="#8b5cf6"
                      name="Mudança"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="troca"
                      stroke="#ec4899"
                      name="Troca"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="cancelamento"
                      stroke="#ef4444"
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
