import React, { useEffect, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../types";
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

export const ClientAnalytics = () => {
  type Cliente = {
    suspensao: boolean;
    sinal_onu: string;
    pppoe_up: boolean;
    ip_duplicado: boolean;
  };

  type Desconexoes = {
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
    tmp: number;
  };

  const [pppoe, setPppoe] = useState<string>("");
  const [clientinfo, setClientInfo] = useState<Cliente>();
  const [desconexoes, setDesconexoes] = useState<Desconexoes[]>([]);
  const [conectado, setConectado] = useState<string | boolean>("Não Conectado");
  const [suspenso, setSuspenso] = useState(false);
  const [testes, setTestes] = useState<Testes>();
  const [tempoReal, setTempoReal] = useState<TempoReal[]>([]);
  const [sinalOnu, setSinalOnu] = useState<null>(null);

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

  //Redux
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;

  const fetchClientInfo = async (pppoe: string) => {
    setLoadingInfo(true);
    setClientInfo(undefined);
    setSuspenso(false);
    setDesconexoes([]);
    setSinalOnu(null);
    setTempoReal([]);
    setConectado("Sem Conexao");
    setTestes(undefined);
    setLoadingTempoReal(true);

    setErrorConectado(null);
    setErrorDescon(null);
    setErrorInfo(null);
    setErrorMikrotik(null);
    setErrorSinal(null);
    setErrorTempoReal(null);

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
    } catch (e: any) {
      setErrorInfo("Erro ao buscar informações do cliente");
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
      setTempoReal((prev) => [...prev, response.data]);
    } catch {
      setErrorTempoReal("Erro ao buscar consumo em tempo real");
    } finally {
      setLoadingTempoReal(false);
    }
  };

  useEffect(() => {
    setLoadingTempoReal(true);
    if (testes && !errorMikrotik) {
      const intervalo = setInterval(() => fetchTempoReal(pppoe), 2000);
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
        {clientinfo && (
          <div className="bg-white shadow-md m-3 p-4 w-full text-left max-w-2xl">
            <div className="mt-5">
              <h2 className="font-semibold mb-2">Analise detalhada:</h2>
              <ul className="space-y-1">
                <li className="mt-5">
                  1. Cliente em Suspensão?:{" "}
                  <span className="text-green-600 font-semibold">
                    {!suspenso && <>NÃO</>}
                  </span>
                  <span className="text-red-600 font-semibold">
                    {suspenso && <>SIM</>}
                  </span>
                </li>
                <li className="mt-5">
                  <li className="mt-5">
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
                        className={`text-left text-sm ml-3 font-mono whitespace-pre text-green-500`}
                      >
                        {sinalOnu}
                      </pre>
                    )}
                  </li>
                </li>

                {!loadingSinal ||
                  (errorSinal && (
                    <button
                      onClick={() => {
                        fetchSinal(pppoe);
                      }}
                      className="bg-red-700 text-white mt-5 px-6 py-2 rounded hover:bg-red-400 transition-all"
                    >
                      Testar Onu Novamente
                    </button>
                  ))}

                <li className="flex mt-5">
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
                      <td className="p-2">{pppoe}</td>

                      <td className="p-2">
                        {new Date(d.acctstarttime).toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
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
                            {new Date(d.acctstoptime).toLocaleString("pt-BR", {
                              timeZone: "America/Sao_Paulo",
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
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
                  <span className="text-green-600 ml-3">{testes?.ping}</span>
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
              ) : tempoReal.length > 0 && !errorTempoReal ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={tempoReal}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <YAxis
                      domain={[0, (dataMax: number) => Math.max(5, dataMax)]}
                    />
                    <YAxis domain={["dataMin", "dataMax"]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="tmp"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={false}
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
                className="bg-red-700 text-white px-6 py-2 rounded"
              >
                Acessar Roteador
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
