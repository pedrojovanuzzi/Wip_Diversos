import React, { useEffect, useMemo, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  HiArrowLeft,
  HiCheckCircle,
  HiExclamationTriangle,
} from "react-icons/hi2";
import { mensagemDeErro, listaDeSns } from "./AutorizarOnu";

export const DesautorizaOnu = () => {
  const { user } = useAuth();
  const token = user?.token;
  const navigate = useNavigate();

  const [sn, setSn] = useState("");
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [error, setError] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  // Traz o que foi marcado na listagem (antes isso rodava dentro de um
  // useState(fn), chamando setSn durante a renderização).
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

  async function desautorizar() {
    setLoading(true);
    setSucesso("");
    setError("");
    setConfirmando(false);

    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/Desautorize`,
        { sn: sns.join(", ") },
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
          : "ONU desautorizada com sucesso!",
      );
      localStorage.removeItem("sn");
      setSn("");
    } catch (erro: any) {
      console.error(erro);
      setError(mensagemDeErro(erro));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950">
      <NavBar />
      <div className="mx-auto w-full max-w-xl px-4 py-8">
        <button
          type="button"
          onClick={() => navigate("/Onu")}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <HiArrowLeft /> Voltar para as ONUs
        </button>

        <div className="rounded-xl border border-stone-800 bg-stone-900 shadow-xl">
          <div className="border-b border-stone-800 px-6 py-4">
            <h1 className="text-xl font-bold text-white">Desautorizar ONU</h1>
            <p className="mt-1 text-sm text-gray-400">
              Remove a ONU da whitelist da OLT. O cliente perde a conexão na hora.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (sns.length > 0 && !loading) setConfirmando(true);
            }}
            className="px-6 py-5 space-y-4"
          >
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wide text-gray-400"
                htmlFor="sn"
              >
                SN {sns.length > 1 && `(${sns.length} selecionados)`}
              </label>
              <textarea
                id="sn"
                value={sn}
                onChange={(e) => setSn(e.target.value)}
                rows={2}
                placeholder="FHTT0726a260, FHTTfe1aca8b"
                className="mt-1 block w-full resize-y rounded-md border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Vários SNs podem ser separados por vírgula.
              </p>
            </div>

            {confirmando ? (
              <div className="rounded-md border border-red-800 bg-red-950/60 p-4">
                <p className="text-sm text-red-200">
                  Confirmar a desautorização de{" "}
                  <b>
                    {sns.length} ONU{sns.length > 1 ? "s" : ""}
                  </b>
                  ? A conexão cai imediatamente.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={desautorizar}
                    className="flex-1 rounded-md bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-500"
                  >
                    Sim, desautorizar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    className="rounded-md border border-stone-600 px-4 py-2 text-sm text-gray-300 hover:bg-stone-800"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading || sns.length === 0}
                className="w-full rounded-md bg-red-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-red-500 disabled:bg-stone-700 disabled:text-gray-400"
              >
                {loading
                  ? "Desautorizando na OLT…"
                  : sns.length > 1
                    ? `Desautorizar ${sns.length} ONUs`
                    : "Desautorizar"}
              </button>
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
