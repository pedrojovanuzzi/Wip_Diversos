import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiRefreshCw, FiSearch } from "react-icons/fi";
import { NavBar } from "../../components/navbar/NavBar";
import { ErrorMessage } from "./components/ErrorMessage";
import { useAuth } from "../../context/AuthContext";
import { parseUptime } from "./ClientAnalytics";

type ClienteSemQueue = {
  servidor: string;
  pppoe: string;
  ip: string;
  upTime: string;
  callerId: string;
  erro?: string;
};

const Spinner: React.FC<{ text?: string }> = ({ text }) => (
  <span className="inline-flex items-center gap-2 text-slate-400">
    <svg className="animate-spin size-4" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
    {text && <span className="text-xs">{text}</span>}
  </span>
);

export const ClientesSemQueue = () => {
  const [lista, setLista] = useState<ClienteSemQueue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");

  const navigate = useNavigate();
  const { user } = useAuth();
  const token = user?.token;

  const fetchLista = async () => {
    setLoading(true);
    setError(null);
    setLista([]);
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/ClientAnalytics/ClientsWithoutQueue",
        { headers: { Authorization: `Bearer ${token}` }, timeout: 120000 },
      );
      setLista(response.data);
    } catch (e) {
      setError("Falha ao consultar clientes sem queue: " + e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const erros = lista.filter((c) => c.erro);
  const clientes = lista.filter((c) => !c.erro);

  const filtrados = clientes
    .filter((c) => {
      const q = filtro.trim().toLowerCase();
      if (!q) return true;
      return (
        c.pppoe?.toLowerCase().includes(q) ||
        c.ip?.toLowerCase().includes(q) ||
        c.servidor?.toLowerCase().includes(q) ||
        c.callerId?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => parseUptime(a.upTime ?? "") - parseUptime(b.upTime ?? ""));

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="inline-flex rounded-xl p-2.5 bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
            <FiAlertTriangle className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Clientes sem Queue
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Clientes conectados (PPPoE ativo) que não possuem uma simple queue
              correspondente no Mikrotik.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por PPPoE, IP, servidor ou MAC"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>
            <button
              onClick={fetchLista}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 transition disabled:opacity-50"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
              {loading ? "Buscando…" : "Atualizar"}
            </button>
          </div>
        </div>

        {/* Avisos de erro por servidor */}
        {erros.length > 0 && (
          <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
            <p className="font-semibold mb-1">
              Não foi possível consultar alguns servidores:
            </p>
            <ul className="list-disc list-inside text-xs">
              {erros.map((e, i) => (
                <li key={i}>
                  {e.servidor}: {e.erro}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Lista */}
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Resultado
              </h2>
              <p className="text-xs text-slate-500">
                Encontrados: {clientes.length}
                {filtro && ` · Exibindo: ${filtrados.length}`}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-6">
                <Spinner text="Cruzando PPPoE ativos × queues…" />
              </div>
            ) : error ? (
              <div className="p-6">
                <ErrorMessage message={error} />
              </div>
            ) : filtrados.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">
                Nenhum cliente conectado sem queue encontrado.
              </div>
            ) : (
              <div className="max-h-[32rem] overflow-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0 text-slate-600 uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">
                        Servidor
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        PPPOE
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Caller ID
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">IP</th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Uptime
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filtrados.map((f, i) => (
                      <tr
                        key={`${f.pppoe}-${i}`}
                        className="hover:bg-slate-50 cursor-pointer"
                        title="Abrir no Client Analytics"
                        onClick={() =>
                          navigate("/ClientAnalytics", {
                            state: { pppoe: f.pppoe },
                          })
                        }
                      >
                        <td className="px-3 py-2">{f.servidor}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {f.pppoe}
                        </td>
                        <td className="px-3 py-2 font-mono">{f.callerId}</td>
                        <td className="px-3 py-2 font-mono">{f.ip}</td>
                        <td className="px-3 py-2">{f.upTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
