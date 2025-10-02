import React, { useEffect, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
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
import { ErrorMessage } from "./components/ErrorMessage";
import { AuthContext, useAuth } from "../../context/AuthContext";

function formatarBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return (bytes / 1024 ** 3).toFixed(2) + " GB";
  } else if (bytes >= 1024 ** 2) {
    return (bytes / 1024 ** 2).toFixed(2) + " MB";
  } else if (bytes >= 1024) {
    return (bytes / 1024).toFixed(2) + " KB";
  } else {
    return bytes + " B";
  }
}

// converte uptime do Mikrotik para segundos (suporta y, mo, w, d, h, m, s)
export function parseUptime(raw: string): number {
  // garante que temos uma string, remove espaços e normaliza para minúsculas
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!s) return 0;

  // tabela de multiplicadores por unidade
  // OBS: mês (mo) = 30 dias, ano (y) = 365 dias (aproximação)
  const unitToSec: Record<string, number> = {
    y: 365 * 24 * 60 * 60,  // 1 ano em segundos
    mo: 30 * 24 * 60 * 60,  // 1 mês em segundos (aproximado)
    w: 7 * 24 * 60 * 60,    // 1 semana
    d: 24 * 60 * 60,        // 1 dia
    h: 60 * 60,             // 1 hora
    m: 60,                  // 1 minuto
    s: 1,                   // 1 segundo
  };

  // regex que captura "<numero><unidade>", incluindo "mo" e "y"
  const re = /(\d+)\s*(y|mo|w|d|h|m|s)/g;

  let total = 0;
  let match: RegExpExecArray | null;

  // percorre cada combinação <valor><unidade> encontrada na string
  while ((match = re.exec(s)) !== null) {
    const value = Number(match[1]);
    const unit = match[2];
    total += value * (unitToSec[unit] ?? 0);
  }

  if (!Number.isFinite(total)) return 0;
  return total;
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
  const [loadingDescon, setLoadingDescon] = useState(false);
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

  const { user } = useAuth();
  const token = user?.token;

  // Spinner reutilizável
  const Spinner: React.FC<{ text?: string }> = ({ text }) => (
    <span className="flex ml-5 items-center gap-2 text-gray-500">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
      {text}
    </span>
  );

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
        {
          headers: { Authorization: `Bearer ${token}`, timeout: 60000 },
        }
      );
      setClientInfo(response.data.user);
      setSuspenso(response.data.suspensao);
      await fetchDesconexoes(pppoe);
      await fetchSinal(pppoe);
      await fetchMikrotik(pppoe);
      console.log(response);
    } catch (e: any) {
      setErrorInfo(
        e.response?.data?.error || "Erro inesperado ao buscar informações."
      );
      console.log(e);
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
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
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
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
      );
      setTempoReal((prev) => [...prev, response.data.tmp]);
      console.log(response.data.tmp);
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
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
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
  }, [testes, errorMikrotik]);

  const fetchMikrotik = async (pppoe: string) => {
    setErrorMikrotik(null);
    setLoadingMikrotik(true);
    setLoadingConectado(true);
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/Mikrotik",
        { pppoe },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
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
        { headers: { Authorization: `Bearer ${token}`, timeout: 60000 } }
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
        { headers: { Authorization: `Bearer ${token}`, timeout: 60000 } }
      );
      setClientList(response.data);
      console.log(response.data);
    } catch (error) {
      setErrorClientList("Falha ao consultar tabelas: " + error);
    } finally {
      setLoadingClientList(false);
    }
  };

  useEffect(() => {
    const exec = async () => {
      await fetchClientsList();
    };
    exec();
  }, [token]);

  return (
    <>
      <NavBar />
      <div className="bg-gray-100 min-h-screen flex flex-col items-center py-6 px-4 text-sm">
        <h1 className="text-2xl">ClientAnalytics</h1>

        <div className="flex items-center mb-6 w-full max-w-md">
          <input
            type="text"
            placeholder="PPPOE do cliente"
            className="flex-1 p-2 border border-gray-400 rounded-l"
            value={pppoe}
            onChange={(e) => {
              setPppoe(e.target.value);
            }}
          />
          <button
            onClick={() => {
              fetchClientInfo(pppoe);
            }}
            className="bg-red-700 hover:bg-red-500 transition-all text-white px-4 py-2 rounded-r"
          >
            OK
          </button>
        </div>
        {(() => {
          if (errorInfo) {
            return <ErrorMessage message={errorInfo} />;
          }

          if (clientinfo) {
            return (
              <div className="bg-white shadow-md m-3 p-4 w-full text-left max-w-2xl">
                <div className="my-5">
                  {clientlist.some((c) => c.pppoe === pppoe) && (
                    <h1>
                      {clientlist.find((c) => c.pppoe === pppoe)?.servidor}
                    </h1>
                  )}
                  <h2 className="font-semibold mb-2">Analise detalhada:</h2>
                  <ul className="space-y-1">
                    <li className="my-5">
                      1. Cliente em Suspensão?:{" "}
                      <span className="text-green-600 font-semibold">
                        {!suspenso && <>NÃO</>}
                      </span>
                      <span className="text-red-600 font-semibold">
                        {suspenso && <>SIM</>}
                      </span>
                    </li>
                    <li className="my-5">
                      <li className="my-5">
                        <div>2. Dados ONU:</div>

                        {loadingSinal ? (
                          // 1. enquanto carrega
                          <Spinner text="Carregando ONU..." />
                        ) : errorSinal ? (
                          // 2. se houve erro
                          <ErrorMessage message={errorSinal} />
                        ) : (
                          // 3. quando tiver o resultado
                          <pre
                            className={`text-left text-sm my-5 ml-3 font-mono whitespace-pre text-green-500`}
                          >
                            {sinalOnu}
                          </pre>
                        )}
                      </li>
                    </li>

                    {!loadingSinal && (
                      <div className="flex flex-col sm:flex-row">
                        <button
                          onClick={() => fetchSinal(pppoe)}
                          className="sm:mx-2 my-2 sm:my-0 bg-red-700 text-white px-6 py-2 rounded hover:bg-red-400 transition-all"
                        >
                          Testar Onu Novamente
                        </button>
                        {loadingReset ? (
                          <>
                            <Spinner text="Reiniciando ONU" />
                          </>
                        ) : errorLoading ? (
                          <>
                            <button
                              onClick={() => fetchReset(pppoe)}
                              className="bg-blue-700 sm:mx-2 my-2 sm:my-0 text-white px-6 py-2 rounded hover:bg-blue-400 transition-all"
                            >
                              Reiniciar ONU
                            </button>
                            <ErrorMessage message={errorLoading} />
                          </>
                        ) : (
                          <button
                            onClick={() => fetchReset(pppoe)}
                            className="bg-blue-700 text-white px-6 py-2 rounded hover:bg-blue-400 transition-all"
                          >
                            Reiniciar ONU
                          </button>
                        )}
                      </div>
                    )}

                    <div className="p-5 mt-5"></div>
                    <li className="flex">
                      3. Conectado?:{" "}
                      {loadingConectado ? (
                        <Spinner />
                      ) : errorConectado ? (
                        <ErrorMessage message={errorConectado} />
                      ) : conectado === true ? (
                        <pre
                          className={`text-left text-sm ml-3 font-mono whitespace-pre text-green-500`}
                        >
                          UP
                        </pre>
                      ) : null}
                    </li>
                  </ul>
                </div>

                <h3 className="mt-6 mb-2 font-semibold">Relatorio</h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border border-gray-300">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th className="p-2">Login</th>
                        <th className="p-2">Hora Inicial</th>
                        <th className="p-2">Hora Final</th>
                        <th className="p-2">Duração</th>
                        <th className="p-2">Tráfego</th>
                        <th className="p-2">Ip</th>
                      </tr>
                    </thead>
                    <tbody className="bg-black text-gray-100 divide-y divide-gray-700">
                      {desconexoes?.map((d, i) => (
                        <tr key={i}>
                          <td className="p-2">{d.username}</td>

                          <td className="p-2">
                            {new Date(d.acctstarttime).toLocaleString("pt-BR", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="p-2">
                            {d.acctstoptime && (
                              <>
                                {new Date(d.acctstoptime).toLocaleString(
                                  "pt-BR",
                                  {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  }
                                )}
                              </>
                            )}
                            {!d.acctstoptime && <>Conectado</>}
                          </td>

                          <td className="p-2">
                            {(() => {
                              const start = new Date(d.acctstarttime);
                              const stop = new Date(d.acctstoptime);

                              const diffMs = stop.getTime() - start.getTime();
                              if (isNaN(diffMs) || diffMs < 0) return "--";

                              const h = Math.floor(diffMs / 3600000);
                              const m = Math.floor((diffMs % 3600000) / 60000);
                              const s = Math.floor((diffMs % 60000) / 1000);

                              const pad = (n: number) =>
                                n.toString().padStart(2, "0");
                              return `${pad(h)}:${pad(m)}:${pad(s)}`;
                            })()}
                          </td>

                          <td className="p-2">
                            {formatarBytes(Number(d.acctinputoctets))} /{" "}
                            {formatarBytes(Number(d.acctoutputoctets))}
                          </td>

                          <td className="p-2">{d.framedipaddress}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 space-y-2">
                  <p className="flex">
                    <span>Ping:</span>
                    {loadingMikrotik ? (
                      <Spinner />
                    ) : errorMikrotik ? (
                      <ErrorMessage message={errorMikrotik} />
                    ) : (
                      <span className="text-green-600 ml-3">
                        {testes?.ping}
                      </span>
                    )}
                  </p>
                  <p className="flex items-center gap-2">
                    Fragmentação:{" "}
                    {loadingMikrotik ? (
                      <Spinner />
                    ) : errorMikrotik ? (
                      <ErrorMessage message={errorMikrotik} />
                    ) : testes?.fr !== "Sem Fragmentação" ? (
                      <span className="text-red-500">{testes?.fr}</span>
                    ) : (
                      <span className="text-green-600">Sem Fragmentação</span>
                    )}
                  </p>

                  <p className="flex">
                    Velocidade:{" "}
                    {loadingMikrotik ? (
                      <Spinner />
                    ) : errorMikrotik ? (
                      <ErrorMessage message={errorMikrotik} />
                    ) : (
                      <span className="text-green-600 ml-3">
                        {testes?.velocidade}
                      </span>
                    )}
                  </p>

                  {testes && (
                    <button
                      onClick={() => {
                        fetchMikrotik(pppoe);
                      }}
                      className="bg-red-700 text-white px-6 py-2 rounded hover:bg-red-400 transition-all"
                    >
                      Realizar o Teste Novamente
                    </button>
                  )}
                </div>

                <div className="mt-6 w-full max-w-xl">
                  <h4 className="font-semibold mb-2">Consumo em Tempo Real:</h4>
                  {loadingTempoReal ? (
                    <Spinner />
                  ) : errorTempoReal ? (
                    <ErrorMessage message={errorTempoReal} />
                  ) : tempoReal.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={tempoReal}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <YAxis
                          domain={[
                            0,
                            (dataMax: number) => Math.max(5, dataMax),
                          ]}
                        />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="tmp_tx"
                          stroke="#10B981" // verde
                          strokeWidth={2}
                          dot={false}
                          name="TX"
                        />
                        <Line
                          type="monotone"
                          dataKey="tmp_rx"
                          stroke="#3B82F6" // azul
                          strokeWidth={2}
                          dot={false}
                          name="RX"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : null}
                </div>

                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => {
                      const ip = desconexoes[0].framedipaddress;
                      const port = process.env.REACT_APP_PORT_ROUTER;
                      window.open(
                        `http://${ip}:${port}`,
                        "_blank",
                        "noopener,noreferrer"
                      );
                    }}
                    className="bg-red-700 transition-all hover:bg-red-500 text-white px-6 py-2 rounded"
                  >
                    Acessar Roteador
                  </button>
                </div>
              </div>
            );
          }

          return null;
        })()}

        {clientlist && (
          <>
            <h1 className="text-3xl mb-5">
              Total Clientes: {clientlist.length}
            </h1>
            <div className="w-72 sm:w-1/2 self-center overflow-auto">
              <div className="inline-block h-96 py-2 align-middle sm:px-6 lg:px-8">
                <table className="relative divide-y divide-gray-300">
                  <thead>
                    <tr>
                      <th>Servidor</th>
                      <th>PPPOE</th>
                      <th>callerId</th>
                      <th>IP</th>
                      <th>Uptime</th>
                    </tr>
                  </thead>

                  <tbody>
                    {clientlist
                      .slice()
                      .sort(
                        (a, b) =>
                          parseUptime(a.upTime ?? "") -
                          parseUptime(b.upTime ?? "")
                      )
                      .map((f) => (
                        <tr>
                          <td className="py-3 pl-4 pr-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0">
                            {f.servidor}
                          </td>
                          <td className="py-3 pl-4 pr-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0">
                            {f.pppoe}
                          </td>
                          <td className="py-3 pl-4 pr-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0">
                            {f.callerId}
                          </td>
                          <td className="py-3 pl-4 pr-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0">
                            {f.ip}
                          </td>
                          <td className="py-3 pl-4 pr-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0">
                            {f.upTime}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {loadingClientList ? (
                  // 1. enquanto carrega
                  <Spinner text="Carregando ONU..." />
                ) : errorClientList ? (
                  // 2. se houve erro
                  <ErrorMessage message={errorClientList} />
                ) : (
                  <></>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};
