import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
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

interface InstallationStat {
  day: number;
  count: number;
}

export const GraficoInstalacoes = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<InstallationStat[]>([]);
  const [total, setTotal] = useState<number>(0);
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
      setTotal(response.data.total);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      alert("Erro ao carregar gráfico de instalações.");
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
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Gráfico de Instalações Mensais
        </h1>

        <div className="bg-white p-6 rounded-lg shadow-md mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
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

          <div className="bg-indigo-600 text-white p-4 rounded-lg shadow-lg">
            <p className="text-sm font-medium uppercase tracking-wider">
              Total de Instalações
            </p>
            <p className="text-4xl font-bold text-center">
              {loading ? (
                <AiOutlineLoading3Quarters className="animate-spin inline" />
              ) : (
                total
              )}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md h-[500px]">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <AiOutlineLoading3Quarters className="animate-spin text-4xl text-indigo-600" />
            </div>
          ) : stats.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
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
                    value: "Qtd. Instalações",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value} Instalações`, ""]}
                  labelFormatter={(label) => `Dia ${label}`}
                />
                <Legend />
                <Bar dataKey="count" fill="#4f46e5" name="Instalações">
                  <LabelList dataKey="count" position="top" />
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
  );
};
