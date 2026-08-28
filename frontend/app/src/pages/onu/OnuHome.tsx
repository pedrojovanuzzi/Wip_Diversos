import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { OnuData } from "../../types";
import OnuList from "./components/OnuList";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { HiCog6Tooth, HiExclamationTriangle } from "react-icons/hi2";
import { FaPlugCirclePlus } from "react-icons/fa6";
import { FaSearch, FaListUl } from "react-icons/fa";
import { mensagemDeErro } from "./AutorizarOnu";

type Aba = "autorizar" | "online" | "sn";

const CAMPO =
  "block w-full rounded-md border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export const OnuHome = () => {
  const { user } = useAuth();
  const token = user?.token;
  const permission = user?.permission ?? 0;
  const navigate = useNavigate();

  const [aba, setAba] = useState<Aba>("autorizar");
  const [onus, setOnus] = useState<OnuData[]>([]);
  const [slot, setSlot] = useState("");
  const [pon, setPon] = useState("");
  const [sn, setSn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const cabecalho = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    timeout: 60000,
  };

  function limpar() {
    setOnus([]);
    setError("");
    setSelecionados([]);
  }

  /** Chama a OLT e devolve sempre uma lista — a rota do SN retorna um objeto. */
  async function consultar(rota: string, corpo: Record<string, unknown>) {
    limpar();
    setLoading(true);
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/${rota}`,
        corpo,
        cabecalho,
      );
      const dados = resposta.data;
      setOnus(Array.isArray(dados) ? dados : dados ? [dados] : []);
    } catch (erro: any) {
      console.error(erro);
      // Antes um erro em "Verificar Onu's para Autorizar" era só console.error:
      // a tela ficava parada, sem dizer nada.
      setError(mensagemDeErro(erro));
    } finally {
      setLoading(false);
    }
  }

  const trocarAba = (nova: Aba) => {
    setAba(nova);
    limpar();
  };

  const abas: { id: Aba; rotulo: string; icone: React.ReactNode }[] = [
    { id: "autorizar", rotulo: "Aguardando autorização", icone: <FaListUl /> },
    { id: "online", rotulo: "Online por PON", icone: <FaPlugCirclePlus /> },
    { id: "sn", rotulo: "Buscar por SN", icone: <FaSearch /> },
  ];

  return (
    <div className="min-h-screen bg-stone-950">
      <NavBar />
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">ONUs</h1>
            <p className="mt-1 text-sm text-gray-400">
              Consulte a OLT, selecione as ONUs e autorize ou desautorize.
            </p>
          </div>
          {permission >= 5 && (
            <button
              type="button"
              onClick={() => navigate("/Onu/Settings")}
              title="Configurações da OLT"
              className="rounded-md border border-stone-700 p-2 text-gray-400 hover:bg-stone-800 hover:text-white"
            >
              <HiCog6Tooth className="size-6" />
            </button>
          )}
        </div>

        {/* Abas: antes eram dois botões que trocavam telas inteiras sem
            indicar qual estava ativa. */}
        <div className="mb-4 flex flex-wrap gap-2">
          {abas.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => trocarAba(item.id)}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                aba === item.id
                  ? "bg-indigo-600 text-white"
                  : "border border-stone-700 bg-stone-900 text-gray-300 hover:bg-stone-800"
              }`}
            >
              {item.icone}
              {item.rotulo}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-stone-800 bg-stone-900 p-4">
          {aba === "online" && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-28">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Slot
                </label>
                <input
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  placeholder="11"
                  inputMode="numeric"
                  className={`${CAMPO} mt-1`}
                />
              </div>
              <div className="w-28">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  PON
                </label>
                <input
                  value={pon}
                  onChange={(e) => setPon(e.target.value)}
                  placeholder="04"
                  inputMode="numeric"
                  className={`${CAMPO} mt-1`}
                />
              </div>
              <button
                type="button"
                disabled={loading || !slot.trim() || !pon.trim()}
                onClick={() => consultar("OnuShowOnline", { slot, pon })}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:bg-stone-700 disabled:text-gray-400"
              >
                {loading ? "Consultando…" : "Consultar"}
              </button>
            </div>
          )}

          {aba === "sn" && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  SN
                </label>
                <input
                  value={sn}
                  onChange={(e) => setSn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && sn.trim())
                      consultar("querySn", { sn });
                  }}
                  placeholder="ITBS8bab7c72"
                  className={`${CAMPO} mt-1`}
                />
              </div>
              <button
                type="button"
                disabled={loading || !sn.trim()}
                onClick={() => consultar("querySn", { sn })}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:bg-stone-700 disabled:text-gray-400"
              >
                {loading ? "Buscando…" : "Buscar"}
              </button>
            </div>
          )}

          {aba === "autorizar" && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-400">
                ONUs vistas pela OLT que ainda não estão na whitelist.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => consultar("OnuShowAuth", {})}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:bg-stone-700 disabled:text-gray-400"
              >
                {loading ? "Consultando…" : "Buscar ONUs"}
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-md border border-red-900 bg-red-950/60 p-3 text-sm text-red-300">
            <HiExclamationTriangle className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {loading && (
          <p className="mt-4 text-sm text-gray-400">Consultando a OLT…</p>
        )}

        {!loading && !error && onus.length === 0 && (
          <p className="mt-4 rounded-md border border-stone-800 bg-stone-900 p-6 text-center text-sm text-gray-500">
            Nenhuma ONU listada ainda. Use a consulta acima.
          </p>
        )}

        {onus.length > 0 && (
          <div className="mt-4 space-y-4">
            <OnuList
              list={onus}
              title={aba === "sn" ? "Informações da ONU" : undefined}
              onSelecaoChange={setSelecionados}
            />

            {/* As ações ficam ao lado da lista, com a contagem do que foi
                marcado — antes era preciso adivinhar se a seleção pegou. */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate("/Onu/AutorizarOnu")}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Autorizar
                {selecionados.length > 0 && ` (${selecionados.length})`}
              </button>
              <button
                type="button"
                onClick={() => navigate("/Onu/DesautorizarOnu")}
                className="rounded-md border border-red-800 bg-red-900/30 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/60"
              >
                Desautorizar
                {selecionados.length > 0 && ` (${selecionados.length})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
