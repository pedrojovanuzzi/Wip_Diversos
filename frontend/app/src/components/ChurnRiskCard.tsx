import React, { useEffect, useState } from "react";
import axios from "axios";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { useAuth } from "../context/AuthContext";

interface ChurnInfo {
  login: string;
  nome: string;
  cidade: string;
  plano: string;
  score: number;
  sinais: string[];
  acao_sugerida: string;
  justificativa: string;
  chamadosAnalisados: number;
}

interface Props {
  login: string;
  months?: number;
  autoLoad?: boolean;
}

export const ChurnRiskCard: React.FC<Props> = ({
  login,
  months = 6,
  autoLoad = false,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChurnInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!login || !user?.token) return;
    setLoading(true);
    setError(null);
    try {
      const baseUrl = process.env.REACT_APP_URL;
      const res = await axios.get<ChurnInfo>(
        `${baseUrl}/chamados/analytics/churn-risk/client/${encodeURIComponent(login)}`,
        {
          params: { months },
          headers: { Authorization: `Bearer ${user.token}` },
          timeout: 180000,
        },
      );
      setData(res.data);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Erro na análise.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [login, autoLoad]);

  if (!login) return null;

  if (!data && !loading && !error) {
    return (
      <div className="bg-white border border-gray-200 rounded p-3 my-3 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Avaliar risco de cancelamento deste cliente com IA?
        </div>
        <button
          onClick={run}
          className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
        >
          Analisar
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded p-3 my-3 flex items-center gap-2 text-sm text-indigo-800">
        <AiOutlineLoading3Quarters className="animate-spin" />
        Analisando histórico de chamados...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-3 my-3 text-sm text-red-700 flex items-center justify-between">
        <span>{error}</span>
        <button
          onClick={run}
          className="text-xs underline hover:no-underline"
        >
          tentar de novo
        </button>
      </div>
    );
  }

  if (!data) return null;

  const score = data.score;
  const tier =
    score >= 70
      ? {
          bg: "bg-red-50",
          border: "border-red-400",
          badge: "bg-red-600 text-white",
          title: "ALTO RISCO DE CANCELAMENTO",
          icon: "🚨",
        }
      : score >= 40
        ? {
            bg: "bg-yellow-50",
            border: "border-yellow-400",
            badge: "bg-yellow-500 text-white",
            title: "RISCO MODERADO",
            icon: "⚠️",
          }
        : {
            bg: "bg-green-50",
            border: "border-green-400",
            badge: "bg-green-600 text-white",
            title: "BAIXO RISCO",
            icon: "✅",
          };

  return (
    <div className={`${tier.bg} border-l-4 ${tier.border} rounded p-4 my-3`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{tier.icon}</span>
          <div>
            <h3 className="font-bold text-gray-900">{tier.title}</h3>
            <p className="text-xs text-gray-600">
              Baseado em {data.chamadosAnalisados} chamado(s) dos últimos{" "}
              {months} meses
            </p>
          </div>
        </div>
        <div
          className={`px-3 py-1 rounded font-bold text-lg ${tier.badge}`}
          title="Score de risco 0-100"
        >
          {score}
        </div>
      </div>

      {data.justificativa && (
        <p className="text-sm text-gray-800 mb-2">{data.justificativa}</p>
      )}

      {data.sinais.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-bold text-gray-700 uppercase mb-1">
            Sinais detectados
          </p>
          <ul className="text-xs text-gray-700 list-disc pl-5 space-y-0.5">
            {data.sinais.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {data.acao_sugerida && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-xs font-bold text-gray-700 uppercase mb-1">
            Ação sugerida
          </p>
          <p className="text-sm text-gray-800">{data.acao_sugerida}</p>
        </div>
      )}

      <div className="mt-2 text-right">
        <button
          onClick={run}
          className="text-xs text-indigo-600 hover:underline"
        >
          Reanalisar
        </button>
      </div>
    </div>
  );
};
