import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import {
  FiActivity,
  FiArrowLeft,
  FiClock,
  FiRefreshCw,
  FiSquare,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { ErrorMessage } from "./components/ErrorMessage";

type Monitor = {
  id: number;
  pppoe: string;
  horas: number;
  intervalo: number;
  status: "ativo" | "finalizado" | "cancelado";
  iniciado_em: string;
  expira_em: string;
  finalizado_em: string | null;
  ultima_verificacao: string | null;
  criado_por: string | null;
};

type MonitorEvent = {
  id: number;
  tipo: string;
  mudanca: boolean;
  servidor: string | null;
  ip: string | null;
  caller_id: string | null;
  uptime: string | null;
  download: number | string | null;
  upload: number | string | null;
  mensagem: string | null;
  created_at: string;
};

const REFRESH_MS = 15000;

function formatarBytes(bytes: number | string | null): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + " GB";
  if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(2) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(2) + " KB";
  return n + " B";
}

function restante(expiraEm: string): string {
  const ms = new Date(expiraEm).getTime() - Date.now();
  if (ms <= 0) return "encerrado";
  const horas = Math.floor(ms / 3600_000);
  const minutos = Math.floor((ms % 3600_000) / 60_000);
  return horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;
}

const tipoTone = (tipo: string) => {
  switch (tipo) {
    case "conectado":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "desconectado":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "online":
      return "bg-emerald-50/70 text-emerald-600 ring-emerald-100";
    case "offline":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "erro":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    default:
      return "bg-slate-50 text-slate-600 ring-slate-200";
  }
};

export const MonitorCliente = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const token = user?.token;
  const navigate = useNavigate();

  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [eventos, setEventos] = useState<MonitorEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apenasMudancas, setApenasMudancas] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  const carregar = useCallback(async () => {
    if (!id || !token) return;
    try {
      setError(null);
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/ClientAnalytics/Monitor/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { apenasMudancas },
        },
      );
      setMonitor(response.data.monitor);
      setEventos(response.data.eventos ?? []);
    } catch (e: any) {
      setError(e.response?.data?.error || "Erro ao carregar o monitoramento.");
    }
  }, [id, token, apenasMudancas]);

  useEffect(() => {
    setLoading(true);
    carregar().finally(() => setLoading(false));
  }, [carregar]);

  // Atualiza sozinho enquanto o monitoramento estiver ativo.
  useEffect(() => {
    if (monitor?.status !== "ativo") return;
    const intervalo = setInterval(carregar, REFRESH_MS);
    return () => clearInterval(intervalo);
  }, [monitor?.status, carregar]);

  const encerrar = async () => {
    if (!id) return;
    setEncerrando(true);
    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/ClientAnalytics/Monitor/${id}/Stop`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await carregar();
    } catch (e: any) {
      setError(e.response?.data?.error || "Erro ao encerrar o monitoramento.");
    } finally {
      setEncerrando(false);
    }
  };

  const quedas = useMemo(
    () => eventos.filter((e) => e.tipo === "desconectado").length,
    [eventos],
  );
  const ultimo = eventos[0];
  const online = ultimo?.tipo === "online" || ultimo?.tipo === "conectado";

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-xl p-2.5 bg-slate-900 text-indigo-300">
              <FiActivity className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Monitoramento de conexão
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {monitor
                  ? `${monitor.pppoe} — janela de ${monitor.horas}h, coleta a cada ${monitor.intervalo}s`
                  : "Carregando…"}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/ClientAnalytics")}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <FiArrowLeft />
            <span className="hidden sm:inline">Voltar</span>
          </button>
        </div>

        {error && <ErrorMessage message={error} />}

        {/* Resumo */}
        {monitor && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <p className="text-xs text-slate-500">Situação</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {monitor.status === "ativo"
                  ? "Monitorando"
                  : monitor.status === "cancelado"
                    ? "Encerrado manualmente"
                    : "Finalizado"}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <p className="text-xs text-slate-500">Tempo restante</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 inline-flex items-center gap-1.5">
                <FiClock className="text-slate-400" />
                {monitor.status === "ativo"
                  ? restante(monitor.expira_em)
                  : "encerrado"}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <p className="text-xs text-slate-500">Estado atual</p>
              <p
                className={`mt-1 text-sm font-semibold ${online ? "text-emerald-600" : "text-rose-600"}`}
              >
                {ultimo ? (online ? "Conectado" : "Sem conexão") : "—"}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <p className="text-xs text-slate-500">Quedas registradas</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {quedas}
              </p>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:items-center">
          <label className="flex items-center gap-2 text-sm text-slate-700 flex-1">
            <input
              type="checkbox"
              checked={apenasMudancas}
              onChange={(e) => setApenasMudancas(e.target.checked)}
              className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
            />
            Mostrar apenas mudanças de estado (conectou / caiu)
          </label>
          <div className="flex gap-2">
            <button
              onClick={carregar}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-3 py-2.5 text-sm font-medium hover:bg-slate-700 transition"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            {monitor?.status === "ativo" && (
              <button
                onClick={encerrar}
                disabled={encerrando}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2.5 text-sm font-medium hover:bg-rose-100 transition disabled:opacity-50"
              >
                <FiSquare />
                {encerrando ? "Encerrando…" : "Encerrar"}
              </button>
            )}
          </div>
        </div>

        {/* Registros */}
        <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading && eventos.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Carregando registros…
            </div>
          ) : eventos.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhum registro ainda. A primeira coleta aparece em instantes.
            </div>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 sticky top-0 text-slate-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Quando</th>
                    <th className="px-3 py-2 text-left">Evento</th>
                    <th className="px-3 py-2 text-left">Servidor</th>
                    <th className="px-3 py-2 text-left">IP</th>
                    <th className="px-3 py-2 text-left">MAC</th>
                    <th className="px-3 py-2 text-left">Uptime</th>
                    <th className="px-3 py-2 text-left">Download</th>
                    <th className="px-3 py-2 text-left">Upload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eventos.map((e) => (
                    <tr
                      key={e.id}
                      className={e.mudanca ? "bg-amber-50/40" : undefined}
                    >
                      <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">
                        {format(new Date(e.created_at), "dd/MM HH:mm:ss")}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${tipoTone(e.tipo)}`}
                          title={e.mensagem ?? ""}
                        >
                          {e.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {e.servidor ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-700">
                        {e.ip ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-500">
                        {e.caller_id ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {e.uptime ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {formatarBytes(e.download)}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {formatarBytes(e.upload)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {monitor && (
          <p className="mt-3 text-xs text-slate-500">
            {eventos.length} registro(s)
            {monitor.ultima_verificacao &&
              ` · última coleta em ${format(new Date(monitor.ultima_verificacao), "dd/MM/yyyy HH:mm:ss")}`}
            {monitor.status === "ativo" &&
              ` · atualizando automaticamente a cada ${REFRESH_MS / 1000}s`}
          </p>
        )}
      </div>
    </div>
  );
};
