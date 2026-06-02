import React, { useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { CiSettings } from "react-icons/ci";

export const PixAdmin = () => {
  const [urlWebhook, setUrlWebhook] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();
  const token = user?.token;

  function stringifySafe(x: any): string {
    if (typeof x === "string") return x;
    try {
      return JSON.stringify(x);
    } catch {
      return String(x);
    }
  }

  function extractErrorMessage(err: any): string {
    if (err && err.response) {
      const d = err.response.data;
      if (typeof d === "string") return d;
      if (d == null) return `HTTP ${err.response.status || ""}`;
      return stringifySafe(d);
    }
    if (err && err.request) return "Falha de rede ou servidor indisponível.";
    if (err instanceof Error && err.message) return err.message;
    return stringifySafe(err);
  }

  async function criarWebhookPix(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!urlWebhook) return;
    setLoading(true);
    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/Pix/criarWebhookPix`,
        { urlWebhook },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSuccess(true);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="inline-flex rounded-xl p-2.5 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <CiSettings className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Configurações Pix
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Gerencie integrações e webhooks da conta Pix.
            </p>
          </div>
        </div>

        <form
          onSubmit={criarWebhookPix}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
        >
          <h2 className="text-base font-semibold text-slate-900">
            Webhook Pix
          </h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            URL que receberá as notificações de pagamento.
          </p>

          <label
            htmlFor="urlWebhook"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            URL do Webhook
          </label>
          <input
            id="urlWebhook"
            type="url"
            value={urlWebhook}
            onChange={(e) => setUrlWebhook(e.target.value)}
            placeholder="https://exemplo.com/webhook/pix"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
          />

          <button
            type="submit"
            disabled={loading || !urlWebhook}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            {loading ? "Enviando…" : "Salvar Webhook"}
          </button>

          {success && (
            <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
              Webhook configurado com sucesso.
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800 break-words">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
