import React, { useEffect, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../types";

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

  const [pppoe, setPppoe] = useState("");
  const [clientinfo, setClientInfo] = useState<Cliente>();
  const [desconexoes, setDesconexoes] = useState<Desconexoes[]>([]);
  const [conectado, setConectado] = useState(false);
  const [suspenso, setSuspenso] = useState(false);
  const [testes, setTestes] = useState<Testes>();
  const [tempoReal, setTempoReal] = useState<TempoReal>();
  const [sinalOnu, setSinalOnu] = useState<null>(null);

  //Redux
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;

  useEffect(() => {
    const temConexaoAtiva = desconexoes?.some((d) => !d.acctstoptime);
    setConectado(temConexaoAtiva);
  }, [desconexoes]);

  const fetchClientInfo = async (pppoe: string) => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/info",
        { pppoe },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.status === 200) {
        setClientInfo(response.data.user);
        setSuspenso(response.data.suspensao);
        console.log("Client Info:", response.data);

        await fetchDesconexoes(pppoe);
        await fetchSinal(pppoe);

        if (!conectado) {
          await fetchMikrotik(pppoe);
        }
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
    }
  };

  const fetchDesconexoes = async (pppoe: string) => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/Desconections",
        { pppoe },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.status === 200) {
        setDesconexoes(response.data.desconexoes);
        console.log("Client Info:", response.data.desconexoes);
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
    }
  };

  const fetchTempoReal = async (pppoe: string) => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/TempoReal",
        { pppoe },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.status === 200) {
        setTempoReal(response.data.tmp);
        console.log("TMP Info:", response.data.tmp);
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
    }
  };

  useEffect(() => {
    if (!conectado) {
      fetchTempoReal(pppoe);
    }
  }, [clientinfo, testes]);

  const fetchMikrotik = async (pppoe: string) => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/Mikrotik",
        { pppoe },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.status === 200) {
        setTestes(response.data.tests);
        console.log("Testes Info:", response.data.tests);
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
    }
  };

  const fetchSinal = async (pppoe: string) => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/SinalOnu",
        { pppoe },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.status === 200) {
        setSinalOnu(response.data.respostaTelnet);
        console.log("respostaTelnet Info:", response.data.respostaTelnet);
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
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
            <h2 className="font-semibold mb-2">Analise detalhada:</h2>
            <ul className="space-y-1">
              <li>
                1. Cliente em Suspensão?:{" "}
                <span className="text-green-600 font-semibold">
                  {!suspenso && <>NÃO</>}
                </span>
                <span className="text-red-600 font-semibold">
                  {suspenso && <>SIM</>}
                </span>
              </li>
              <li className="flex">
                2. Dados ONU:{""}
                <br />
                {!sinalOnu ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 ml-5 text-gray-500"
                      viewBox="0 0 24 24"
                    >
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
                  </>
                ) : (
                  <pre className="text-left text-sm ml-3 font-mono whitespace-pre">
                    {sinalOnu}
                  </pre>
                )}
              </li>

              <li>
                3. PPPOE?:{" "}
                <span className="text-green-600 font-semibold">
                  {conectado && <>UP</>}
                </span>
                <span className="text-red-600 font-semibold">
                  {!conectado && <>DOWN</>}
                </span>
              </li>
            </ul>

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
              <p>
                {!testes?.ping ? (
                  <div className="flex">
                    <span>Ping:</span>
                    <svg
                      className="animate-spin h-5 w-5 ml-5 text-gray-500"
                      viewBox="0 0 24 24"
                    >
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
                  </div>
                ) : (
                  <div className="flex">
                    <p>Ping:</p>
                    <span className="text-green-600 ml-3">{testes.ping}</span>
                  </div>
                )}
              </p>
              <p className="flex items-center gap-2">
                Fragmentação:{" "}
                {!testes?.fr ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-gray-500"
                      viewBox="0 0 24 24"
                    >
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
                  </>
                ) : testes.fr !== "Sem Fragmentação" ? (
                  <span className="text-red-500">{testes.fr}</span>
                ) : (
                  <span className="text-green-600">Sem Fragmentação</span>
                )}
              </p>

              <p className="flex">
                Velocidade:{" "}
                {!testes?.ping ? (
                  <div className="flex">
                    <svg
                      className="animate-spin h-5 w-5 ml-5 text-gray-500"
                      viewBox="0 0 24 24"
                    >
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
                  </div>
                ) : (
                  <span className="text-green-600 ml-3">
                    {testes.velocidade}
                  </span>
                )}
              </p>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold mb-2">Consumo em Tempo Real:</h4>
              {tempoReal?.tmp == null ? (
                <div className="flex">
                  <svg
                    className="animate-spin h-5 w-5 ml-5 text-gray-500"
                    viewBox="0 0 24 24"
                  >
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
                </div>
              ) : (
                <span className="text-green-600 ml-3">{tempoReal.tmp}</span>
              )}
            </div>

            <div className="mt-6 flex justify-center">
              <button
                onClick={() => {
                  const ip = desconexoes[0].framedipaddress;
                  const port = process.env.REACT_APP_PORT_ROUTER;
                  window.location.href = `http://${ip}:${port}`;
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
