import React, { useEffect, useMemo, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { WifiData } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  HiArrowLeft,
  HiCheckCircle,
  HiExclamationTriangle,
} from "react-icons/hi2";
import { FaWifi, FaNetworkWired } from "react-icons/fa";

/** Extrai a mensagem que o backend mandou, sem nunca devolver um objeto. */
export function mensagemDeErro(erro: any): string {
  const dado = erro?.response?.data;
  if (typeof dado === "string" && dado.trim()) return dado;
  if (dado?.message) return String(dado.message);
  if (erro?.code === "ECONNABORTED")
    return "A OLT demorou demais para responder (tempo esgotado).";
  return String(erro?.message || "Erro inesperado.");
}

/** SNs digitados/colados, separados por vírgula, sem vazios nem repetidos. */
export function listaDeSns(texto: string): string[] {
  return Array.from(
    new Set(
      texto
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

const CAMPO =
  "block w-full rounded-md bg-stone-900 border border-stone-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50";
const ROTULO = "block text-xs font-semibold uppercase tracking-wide text-gray-400";

interface ChaveProps {
  ligado: boolean;
  onChange: (valor: boolean) => void;
  desabilitado?: boolean;
  titulo: string;
  descricao: string;
  icone?: React.ReactNode;
}

/** Interruptor com rótulo e explicação — antes era só um botão sem contexto. */
const Chave = ({
  ligado,
  onChange,
  desabilitado,
  titulo,
  descricao,
  icone,
}: ChaveProps) => (
  <label
    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
      desabilitado
        ? "border-stone-800 bg-stone-900/40 cursor-not-allowed opacity-60"
        : "border-stone-700 bg-stone-900/60 hover:border-stone-600 cursor-pointer"
    }`}
  >
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      disabled={desabilitado}
      onClick={() => !desabilitado && onChange(!ligado)}
      className={`mt-0.5 relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
        ligado ? "bg-indigo-600" : "bg-stone-600"
      } ${desabilitado ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
          ligado ? "translate-x-5" : ""
        }`}
      />
    </button>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-white flex items-center gap-2">
        {icone}
        {titulo}
      </p>
      <p className="text-xs text-gray-400 leading-snug">{descricao}</p>
    </div>
  </label>
);

export const AutorizarOnu = () => {
  const { user } = useAuth();
  const token = user?.token;
  const navigate = useNavigate();

  const [bridge, setBridge] = useState(true);
  const [variasOnus, setVariasOnus] = useState(true);
  const [sn, setSn] = useState("");
  const [vlan, setVlan] = useState("");
  const [cos, setCos] = useState("");
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [error, setError] = useState("");
  const [wifiData, setWifiData] = useState<WifiData>({
    pppoe: "",
    senha_pppoe: "",
    canal: "",
    wifi_2ghz: "",
    wifi_5ghz: "",
    senha_wifi: "",
  });

  /**
   * Traz os SNs marcados na listagem. Era feito dentro de um `useState(fn)`,
   * que chama `setSn` durante a renderização, e o localStorage era lido a cada
   * render.
   */
  useEffect(() => {
    try {
      const salvo = localStorage.getItem("sn");
      if (!salvo) return;
      const lista = JSON.parse(salvo) as string[];
      if (Array.isArray(lista) && lista.length) setSn(lista.join(", "));
    } catch (e) {
      console.error("Seleção de ONUs salva inválida:", e);
    }
  }, []);

  const sns = useMemo(() => listaDeSns(sn), [sn]);

  // O modo Wifi autoriza uma ONU por vez: o backend não separa a lista.
  useEffect(() => {
    if (!bridge) setVariasOnus(false);
  }, [bridge]);

  const excessoDeSns = !bridge && sns.length > 1;
  const cosInvalido = cos !== "" && !/^[0-7]$/.test(cos.trim());
  const vlanInvalida =
    vlan !== "" && !(/^\d+$/.test(vlan.trim()) && Number(vlan) >= 1 && Number(vlan) <= 4094);

  const podeEnviar =
    !loading && sns.length > 0 && !!vlan && !!cos && !excessoDeSns && !cosInvalido && !vlanInvalida;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;

    setLoading(true);
    setSucesso("");
    setError("");

    const rota = bridge ? "OnuAuthenticationBridge" : "OnuAuthenticationWifi";
    const corpo = bridge
      ? { sn: sns.join(", "), vlan, cos }
      : { sn: sns[0], vlan, cos, wifiData };

    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/${rota}`,
        corpo,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 120000,
        },
      );
      setSucesso(
        typeof resposta.data === "string"
          ? resposta.data
          : "Onu autorizada com sucesso!",
      );
      // A seleção já foi usada; deixá-la salva reaparecia na próxima tela.
      localStorage.removeItem("sn");
    } catch (erro: any) {
      console.error(erro);
      // Guardar o objeto de erro aqui quebrava a tela ao renderizá-lo.
      setError(mensagemDeErro(erro));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950">
      <NavBar />
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <button
          type="button"
          onClick={() => navigate("/Onu")}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <HiArrowLeft /> Voltar para as ONUs
        </button>

        <div className="rounded-xl border border-stone-800 bg-stone-900 shadow-xl">
          <div className="border-b border-stone-800 px-6 py-4">
            <h1 className="text-xl font-bold text-white">Autorizar ONU</h1>
            <p className="mt-1 text-sm text-gray-400">
              Provisiona a ONU na OLT com a VLAN e o CoS informados.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Chave
                ligado={bridge}
                onChange={setBridge}
                titulo={bridge ? "Bridge" : "Wifi"}
                icone={
                  bridge ? (
                    <FaNetworkWired className="text-indigo-400" />
                  ) : (
                    <FaWifi className="text-indigo-400" />
                  )
                }
                descricao={
                  bridge
                    ? "Só entrega a VLAN; o roteador do cliente faz a conexão."
                    : "A própria ONU conecta o PPPoE e publica o Wi-Fi."
                }
              />
              <Chave
                ligado={variasOnus}
                onChange={setVariasOnus}
                desabilitado={!bridge}
                titulo={variasOnus ? "Várias ONUs" : "Uma ONU"}
                descricao={
                  bridge
                    ? "Aceita vários SNs separados por vírgula."
                    : "No modo Wifi só é possível uma ONU por vez."
                }
              />
            </div>

            <div>
              <label className={ROTULO} htmlFor="sn">
                SN {sns.length > 1 && `(${sns.length} selecionados)`}
              </label>
              {variasOnus ? (
                <textarea
                  id="sn"
                  value={sn}
                  onChange={(e) => setSn(e.target.value)}
                  rows={2}
                  placeholder="FHTT0726a260, FHTTfe1aca8b"
                  className={`${CAMPO} mt-1 resize-y`}
                />
              ) : (
                <input
                  id="sn"
                  value={sn}
                  onChange={(e) => setSn(e.target.value)}
                  placeholder="FHTT0726a260"
                  className={`${CAMPO} mt-1`}
                />
              )}
              {excessoDeSns && (
                <p className="mt-1 text-xs text-amber-400">
                  O modo Wifi autoriza uma ONU por vez — deixe apenas um SN.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={ROTULO} htmlFor="vlan">
                  VLAN
                </label>
                <input
                  id="vlan"
                  value={vlan}
                  onChange={(e) => setVlan(e.target.value)}
                  inputMode="numeric"
                  placeholder="Ex: 1008"
                  className={`${CAMPO} mt-1`}
                />
                {vlanInvalida && (
                  <p className="mt-1 text-xs text-amber-400">
                    A VLAN deve ser um número entre 1 e 4094.
                  </p>
                )}
              </div>
              <div>
                <label className={ROTULO} htmlFor="cos">
                  CoS
                </label>
                <input
                  id="cos"
                  value={cos}
                  onChange={(e) => setCos(e.target.value)}
                  inputMode="numeric"
                  placeholder="0 a 7"
                  className={`${CAMPO} mt-1`}
                />
                {cosInvalido && (
                  <p className="mt-1 text-xs text-amber-400">
                    O CoS vai de 0 a 7.
                  </p>
                )}
              </div>
            </div>

            {!bridge && (
              <div className="rounded-lg border border-stone-700 bg-stone-900/60 p-4 space-y-4">
                <h2 className="text-sm font-semibold text-white">
                  Configuração do Wi-Fi e PPPoE
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={ROTULO}>PPPoE</label>
                    <input
                      value={wifiData.pppoe}
                      placeholder="PEDROJOVANUZZI"
                      onChange={(e) =>
                        setWifiData({ ...wifiData, pppoe: e.target.value })
                      }
                      required
                      className={`${CAMPO} mt-1`}
                    />
                  </div>
                  <div>
                    <label className={ROTULO}>Senha PPPoE</label>
                    <input
                      value={wifiData.senha_pppoe}
                      onChange={(e) =>
                        setWifiData({ ...wifiData, senha_pppoe: e.target.value })
                      }
                      placeholder="270604"
                      required
                      className={`${CAMPO} mt-1`}
                    />
                  </div>
                  <div>
                    <label className={ROTULO}>Canal</label>
                    <input
                      value={wifiData.canal}
                      placeholder="3"
                      onChange={(e) =>
                        setWifiData({ ...wifiData, canal: e.target.value })
                      }
                      required
                      className={`${CAMPO} mt-1`}
                    />
                  </div>
                  <div>
                    <label className={ROTULO}>Senha do Wi-Fi</label>
                    <input
                      value={wifiData.senha_wifi}
                      onChange={(e) =>
                        setWifiData({ ...wifiData, senha_wifi: e.target.value })
                      }
                      placeholder="mínimo 7 caracteres"
                      minLength={7}
                      required
                      className={`${CAMPO} mt-1`}
                    />
                  </div>
                  <div>
                    <label className={ROTULO}>Rede Wi-Fi 2.4 GHz</label>
                    <input
                      value={wifiData.wifi_2ghz}
                      onChange={(e) =>
                        setWifiData({ ...wifiData, wifi_2ghz: e.target.value })
                      }
                      placeholder="Wifi_Test"
                      required
                      className={`${CAMPO} mt-1`}
                    />
                  </div>
                  <div>
                    <label className={ROTULO}>Rede Wi-Fi 5 GHz</label>
                    <input
                      value={wifiData.wifi_5ghz}
                      onChange={(e) =>
                        setWifiData({ ...wifiData, wifi_5ghz: e.target.value })
                      }
                      placeholder="Wifi_Test_5G"
                      required
                      className={`${CAMPO} mt-1`}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={!podeEnviar}
                className="flex-1 rounded-md bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-500 disabled:bg-stone-700 disabled:text-gray-400"
              >
                {loading
                  ? "Autorizando na OLT…"
                  : sns.length > 1
                    ? `Autorizar ${sns.length} ONUs`
                    : "Autorizar"}
              </button>
              {/* type="button": sem isso o clique aqui SUBMETIA o formulário
                  (autorizando) antes de navegar para a desautorização. */}
              <button
                type="button"
                onClick={() => navigate("/Onu/DesautorizarOnu")}
                disabled={loading}
                className="rounded-md border border-red-800 bg-red-900/30 px-4 py-2.5 font-semibold text-red-300 transition-colors hover:bg-red-900/60 disabled:opacity-50"
              >
                Desautorizar
              </button>
            </div>

            {loading && (
              <p className="text-sm text-gray-400">
                Falando com a OLT — pode levar até 2 minutos com vários SNs.
              </p>
            )}
            {error && (
              <p className="flex items-start gap-2 rounded-md border border-red-900 bg-red-950/60 p-3 text-sm text-red-300">
                <HiExclamationTriangle className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}
            {sucesso && (
              <p className="flex items-start gap-2 rounded-md border border-green-900 bg-green-950/60 p-3 text-sm text-green-300">
                <HiCheckCircle className="mt-0.5 shrink-0" />
                {sucesso}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
