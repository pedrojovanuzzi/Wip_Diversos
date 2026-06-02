import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useNavigate } from "react-router-dom";
import {
  FiSearch,
  FiRefreshCw,
  FiExternalLink,
  FiActivity,
  FiUser,
} from "react-icons/fi";
import { NavBar } from "../../components/navbar/NavBar";
import { ErrorMessage } from "./components/ErrorMessage";
import { useAuth } from "../../context/AuthContext";

function formatarBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + " GB";
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(2) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
  return bytes + " B";
}

export function parseUptime(raw: string): number {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return 0;
  const unitToSec: Record<string, number> = {
    y: 365 * 24 * 60 * 60,
    mo: 30 * 24 * 60 * 60,
    w: 7 * 24 * 60 * 60,
    d: 24 * 60 * 60,
    h: 60 * 60,
    m: 60,
    s: 1,
  };
  const re = /(\d+)\s*(y|mo|w|d|h|m|s)/g;
  let total = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(s)) !== null) {
    total += Number(match[1]) * (unitToSec[match[2]] ?? 0);
  }
  return Number.isFinite(total) ? total : 0;
}

type Cliente = {
  suspensao: boolean;
  sinal_onu: string;
  pppoe_up: boolean;
  ip_duplicado: boolean;
};

type Desconexoes = {
  username: string;
  acctstarttime: string;
  acctstoptime: string;
  acctinputoctets: number;
  acctoutputoctets: number;
  framedipaddress: string;
};

type Testes = {
  ping: string;
  fr: string;
  velocidade: string;
};

type TempoReal = {
  tmp_tx: number;
  tmp_rx: number;
};

type ClientList = {
  servidor: string;
  pppoe: string;
  ip: string;
  upTime: string;
  callerId: string;
};

const Spinner: React.FC<{ text?: string; inline?: boolean }> = ({
  text,
  inline,
}) => (
  <span
    className={`inline-flex items-center gap-2 text-slate-400 ${inline ? "" : "ml-2"}`}
  >
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
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8z"
      />
    </svg>
    {text && <span className="text-xs">{text}</span>}
  </span>
);

const SectionCard: React.FC<{
  step?: number;
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}> = ({ step, title, children, right }) => (
  <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2.5">
        {step !== undefined && (
          <span className="inline-flex size-6 rounded-full bg-slate-900 text-white text-xs font-bold items-center justify-center">
            {step}
          </span>
        )}
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      {right}
    </div>
    {children}
  </section>
);

const StatusPill: React.FC<{
  tone: "ok" | "bad" | "neutral";
  children: React.ReactNode;
}> = ({ tone, children }) => {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "bad"
        ? "bg-rose-50 text-rose-700 ring-rose-200"
        : "bg-slate-50 text-slate-600 ring-slate-200";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${cls}`}
    >
      {children}
    </span>
  );
};

export const ClientAnalytics = () => {
  const [pppoe, setPppoe] = useState<string>("");
  const [clientinfo, setClientInfo] = useState<Cliente>();
  const [desconexoes, setDesconexoes] = useState<Desconexoes[]>([]);
  const [conectado, setConectado] = useState<string | boolean>("Não Conectado");
  const [suspenso, setSuspenso] = useState(false);
  const [testes, setTestes] = useState<Testes>();
  const [tempoReal, setTempoReal] = useState<TempoReal[]>([]);
  const [sinalOnu, setSinalOnu] = useState<null>(null);

  const [loadingInfo, setLoadingInfo] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [loadingConectado, setLoadingConectado] = useState(false);
  const [errorConectado, setErrorConectado] = useState<string | null>(null);
  const [, setLoadingDescon] = useState(false);
  const [errorDescon, setErrorDescon] = useState<string | null>(null);
  const [loadingSinal, setLoadingSinal] = useState(false);
  const [errorSinal, setErrorSinal] = useState<string | null>(null);
  const [loadingMikrotik, setLoadingMikrotik] = useState(false);
  const [errorMikrotik, setErrorMikrotik] = useState<string | null>(null);
  const [loadingTempoReal, setLoadingTempoReal] = useState(true);
  const [errorTempoReal, setErrorTempoReal] = useState<string | null>(null);
  const [loadingReset, setLoadingReset] = useState(false);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);

  const [loadingClientList, setLoadingClientList] = useState(false);
  const [errorClientList, setErrorClientList] = useState<string | null>(null);
  const [clientlist, setClientList] = useState<ClientList[]>([]);
  const navigate = useNavigate();

  const { user } = useAuth();
  const token = user?.token;

  function redirectLogs() {
    navigate("/ClientAnalytics/Logs");
  }

  const fetchClientInfo = async (pppoe: string) => {
    setLoadingInfo(true);
    setClientInfo(undefined);
    setSuspenso(false);
    setDesconexoes([]);
    setSinalOnu(null);
    setTempoReal([]);
    setLoadingReset(false);
    setConectado("Sem Conexao");
    setTestes(undefined);
    setLoadingTempoReal(true);

    setErrorConectado(null);
    setErrorDescon(null);
    setErrorInfo(null);
    setErrorMikrotik(null);
    setErrorSinal(null);
    setErrorTempoReal(null);
    setErrorLoading(null);

    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/info",
        { pppoe },
        { headers: { Authorization: `Bearer ${token}`, timeout: 60000 } },
      );
      setClientInfo(response.data.user);
      setSuspenso(response.data.suspensao);
      await fetchDesconexoes(pppoe);
      await fetchSinal(pppoe);
      await fetchMikrotik(pppoe);
    } catch (e: any) {
      setErrorInfo(
        e.response?.data?.error || "Erro inesperado ao buscar informações.",
      );
    } finally {
      setLoadingInfo(false);
    }
  };

  const fetchDesconexoes = async (pppoe: string) => {
    setErrorDescon(null);
    setLoadingDescon(true);
    setDesconexoes([]);
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/Desconections",
        { pppoe },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 },
      );
      setDesconexoes(response.data.desconexoes);
    } catch {
      setErrorDescon("Erro ao buscar desconexões");
    } finally {
      setLoadingDescon(false);
    }
  };

  const fetchTempoReal = async (pppoe: string) => {
    setErrorTempoReal(null);
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/TempoReal",
        { pppoe },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 },
      );
      setTempoReal((prev) => [...prev, response.data.tmp]);
    } catch {
      setErrorTempoReal("Erro ao buscar consumo em tempo real");
    } finally {
      setLoadingTempoReal(false);
    }
  };

  const fetchReset = async (pppoe: string) => {
    setErrorLoading(null);
    setLoadingReset(true);
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/Reset",
        { pppoe },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 },
      );
      setErrorLoading(response.data.message);
    } catch (e: any) {
      setErrorLoading(e.response?.data?.error || "Erro ao resetar onu");
    } finally {
      setLoadingReset(false);
    }
  };

  useEffect(() => {
    if (testes && !errorMikrotik) {
      const intervalo = setInterval(() => fetchTempoReal(pppoe), 5000);
      return () => clearInterval(intervalo);
    } else if (errorMikrotik) {
      setErrorTempoReal("Erro ao buscar dados do Mikrotik");
    }
    setLoadingTempoReal(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testes, errorMikrotik]);

  const fetchMikrotik = async (pppoe: string) => {
    setErrorMikrotik(null);
    setLoadingMikrotik(true);
    setLoadingConectado(true);
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/Mikrotik",
        { pppoe },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 },
      );
      setTestes(response.data.tests);
      setConectado(response.data.conectado);
    } catch {
      setErrorMikrotik("Erro ao executar teste Mikrotik");
      setErrorConectado("DOWN");
    } finally {
      setLoadingMikrotik(false);
      setLoadingConectado(false);
    }
  };

  const fetchSinal = async (pppoe: string) => {
    setErrorSinal(null);
    setLoadingSinal(true);
    setSinalOnu(null);
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/SinalOnu",
        { pppoe },
        { headers: { Authorization: `Bearer ${token}`, timeout: 60000 } },
      );
      setSinalOnu(response.data.respostaTelnet);
    } catch (e: any) {
      setErrorSinal("Erro ao consultar ONU");
    } finally {
      setLoadingSinal(false);
    }
  };

  const fetchClientsList = async () => {
    try {
      setLoadingClientList(true);
      setErrorClientList("");
      setClientList([]);
      const response = await axios.get(
        process.env.REACT_APP_URL + "/ClientAnalytics/ClientList",
        { headers: { Authorization: `Bearer ${token}`, timeout: 60000 } },
      );
      setClientList(response.data);
    } catch (error) {
      setErrorClientList("Falha ao consultar tabelas: " + error);
    } finally {
      setLoadingClientList(false);
    }
  };

  useEffect(() => {
    fetchClientsList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const servidorAtual = clientlist.find((c) => c.pppoe === pppoe)?.servidor;

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="inline-flex rounded-xl p-2.5 bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200">
            <FiActivity className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Client Analytics
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Diagnóstico completo de conexão, ONU e tráfego em tempo real.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="PPPOE do cliente"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                value={pppoe}
                onChange={(e) => setPppoe(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pppoe) fetchClientInfo(pppoe);
                }}
              />
            </div>
            <button
              onClick={() => fetchClientInfo(pppoe)}
              disabled={!pppoe || loadingInfo}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingInfo ? "Analisando…" : "Analisar"}
            </button>
          </div>

          {errorInfo && (
            <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">
              {errorInfo}
            </div>
          )}
        </div>

        {/* Resultado */}
        {clientinfo && (
          <div className="mt-6 space-y-4">
            {/* Cliente header */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-slate-900 text-white inline-flex items-center justify-center">
                  <FiUser />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {pppoe}
                  </p>
                  {servidorAtual && (
                    <p className="text-xs text-slate-500">
                      Servidor: {servidorAtual}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={suspenso ? "bad" : "ok"}>
                  {suspenso ? "Suspenso" : "Ativo"}
                </StatusPill>
                {loadingConectado ? (
                  <StatusPill tone="neutral">
                    <Spinner inline text="Verificando…" />
                  </StatusPill>
                ) : errorConectado ? (
                  <StatusPill tone="bad">Conexão: DOWN</StatusPill>
                ) : conectado === true ? (
                  <StatusPill tone="ok">Conexão: UP</StatusPill>
                ) : (
                  <StatusPill tone="neutral">Conexão: —</StatusPill>
                )}
              </div>
            </div>

            {/* Dados ONU */}
            <SectionCard
              step={1}
              title="Dados ONU"
              right={
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchSinal(pppoe)}
                    disabled={loadingSinal}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    <FiRefreshCw className="size-3.5" />
                    Testar
                  </button>
                  <button
                    onClick={() => fetchReset(pppoe)}
                    disabled={loadingReset}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    {loadingReset ? "Reiniciando…" : "Reiniciar"}
                  </button>
                </div>
              }
            >
              {loadingSinal ? (
                <Spinner text="Carregando ONU…" />
              ) : errorSinal ? (
                <ErrorMessage message={errorSinal} />
              ) : sinalOnu ? (
                <pre className="rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs sm:text-sm p-4 whitespace-pre overflow-x-auto">
                  {sinalOnu}
                </pre>
              ) : (
                <p className="text-sm text-slate-400">Sem dados de ONU.</p>
              )}
              {errorLoading && (
                <p className="mt-2 text-xs text-rose-600">{errorLoading}</p>
              )}
            </SectionCard>

            {/* Desconexões */}
            <SectionCard step={2} title="Relatório de conexões">
              {errorDescon ? (
                <ErrorMessage message={errorDescon} />
              ) : desconexoes && desconexoes.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">
                          Login
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Início
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Fim
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Duração
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Tráfego (in / out)
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          IP
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {desconexoes.map((d, i) => {
                        const start = new Date(d.acctstarttime);
                        const stop = new Date(d.acctstoptime);
                        const diffMs = stop.getTime() - start.getTime();
                        const dur =
                          isNaN(diffMs) || diffMs < 0
                            ? "--"
                            : `${String(Math.floor(diffMs / 3600000)).padStart(2, "0")}:${String(Math.floor((diffMs % 3600000) / 60000)).padStart(2, "0")}:${String(Math.floor((diffMs % 60000) / 1000)).padStart(2, "0")}`;
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium">
                              {d.username}
                            </td>
                            <td className="px-3 py-2">
                              {start.toLocaleString("pt-BR")}
                            </td>
                            <td className="px-3 py-2">
                              {d.acctstoptime ? (
                                stop.toLocaleString("pt-BR")
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Conectado
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono">{dur}</td>
                            <td className="px-3 py-2">
                              {formatarBytes(Number(d.acctinputoctets))} /{" "}
                              {formatarBytes(Number(d.acctoutputoctets))}
                            </td>
                            <td className="px-3 py-2 font-mono">
                              {d.framedipaddress}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  Nenhuma desconexão registrada.
                </p>
              )}
            </SectionCard>

            {/* Mikrotik tests */}
            <SectionCard
              step={3}
              title="Testes de rede"
              right={
                testes && (
                  <button
                    onClick={() => fetchMikrotik(pppoe)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-700 transition"
                  >
                    <FiRefreshCw className="size-3.5" />
                    Repetir
                  </button>
                )
              }
            >
              <div className="grid sm:grid-cols-3 gap-3">
                <Metric
                  label="Ping"
                  loading={loadingMikrotik}
                  error={errorMikrotik}
                  value={testes?.ping}
                />
                <Metric
                  label="Fragmentação"
                  loading={loadingMikrotik}
                  error={errorMikrotik}
                  value={testes?.fr}
                  badIf={(v) => !!v && v !== "Sem Fragmentação"}
                />
                <Metric
                  label="Velocidade"
                  loading={loadingMikrotik}
                  error={errorMikrotik}
                  value={testes?.velocidade}
                />
              </div>
            </SectionCard>

            {/* Tempo Real */}
            <SectionCard step={4} title="Consumo em tempo real">
              {loadingTempoReal && tempoReal.length === 0 ? (
                <Spinner text="Aguardando dados…" />
              ) : errorTempoReal ? (
                <ErrorMessage message={errorTempoReal} />
              ) : tempoReal.length > 0 ? (
                <div className="rounded-xl bg-slate-50 p-3">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={tempoReal}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis stroke="#94a3b8" fontSize={11} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        domain={[
                          0,
                          (dataMax: number) => Math.max(5, dataMax),
                        ]}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="tmp_tx"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={false}
                        name="TX"
                      />
                      <Line
                        type="monotone"
                        dataKey="tmp_rx"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                        name="RX"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sem dados ainda.</p>
              )}
            </SectionCard>

            {/* Acessar roteador */}
            {desconexoes.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const ip = desconexoes[0].framedipaddress;
                    const port = process.env.REACT_APP_PORT_ROUTER;
                    window.open(
                      `http://${ip}:${port}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-700 transition"
                >
                  <FiExternalLink />
                  Acessar Roteador
                </button>
              </div>
            )}
          </div>
        )}

        {/* Lista geral de clientes */}
        <div className="mt-10">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Clientes ativos
              </h2>
              <p className="text-xs text-slate-500">
                Total: {clientlist?.length || 0}
              </p>
            </div>
            <button
              onClick={redirectLogs}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              Ver logs
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingClientList ? (
              <div className="p-6">
                <Spinner text="Carregando clientes…" />
              </div>
            ) : errorClientList ? (
              <div className="p-6">
                <ErrorMessage message={errorClientList} />
              </div>
            ) : (
              <div className="max-h-96 overflow-auto">
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
                    {clientlist
                      .slice()
                      .sort(
                        (a, b) =>
                          parseUptime(a.upTime ?? "") -
                          parseUptime(b.upTime ?? ""),
                      )
                      .map((f, i) => (
                        <tr
                          key={`${f.pppoe}-${i}`}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => {
                            setPppoe(f.pppoe);
                            fetchClientInfo(f.pppoe);
                          }}
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

const Metric: React.FC<{
  label: string;
  value?: string;
  loading: boolean;
  error: string | null;
  badIf?: (v?: string) => boolean;
}> = ({ label, value, loading, error, badIf }) => {
  const isBad = badIf ? badIf(value) : false;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold">
        {loading ? (
          <Spinner inline />
        ) : error ? (
          <span className="text-rose-600">{error}</span>
        ) : value ? (
          <span className={isBad ? "text-rose-600" : "text-emerald-600"}>
            {value}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </div>
    </div>
  );
};
