import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiRefreshCw } from "react-icons/fi";

/**
 * Endereços que este backend atende. A Efí acrescenta "/rec" e "/cobr" ao fim
 * da URL cadastrada; terminar em "?ignorar=" é o que impede esse acréscimo e
 * faz a notificação cair exatamente na rota abaixo.
 */
const ROTA_REC = "/Pix/PixAutomatico/webhookRec";
const ROTA_COBR = "/Pix/PixAutomatico/webhookCobr";

function enderecoSugerido(rota: string) {
  const base = (process.env.REACT_APP_URL || "").replace(/\/+$/, "");
  return `${base}${rota}?ignorar=`;
}

const entrada =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

/** Texto seguro para qualquer formato de erro devolvido pela Efí. */
function stringifySafe(x: any): string {
  if (typeof x === "string") return x;
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

/** Compara o endereço cadastrado na Efí com a rota que este sistema atende. */
function conferir(cadastrado: any, rota: string) {
  const url: string = cadastrado?.webhookUrl || "";
  if (!url) return null;
  // O Express não diferencia maiúscula de minúscula na rota.
  const alvo = rota.toLowerCase();
  const atual = url.toLowerCase();
  const sufixo = rota === ROTA_REC ? "/rec" : "/cobr";
  if (atual.includes("?ignorar=") && atual.includes(alvo)) return "ok";
  if (atual.endsWith(alvo)) return `A Efí vai chamar ${url}${sufixo}`;
  return "diferente";
}

/**
 * Um webhook (recorrências ou cobranças): o que está cadastrado hoje e o
 * campo para cadastrar outro endereço.
 *
 * Fica fora do componente de propósito: declarado dentro, o React recria o
 * campo a cada tecla e o cursor sai de dentro dele.
 */
const Bloco = ({
  titulo,
  descricao,
  rota,
  valor,
  aoMudar,
  aoEnviar,
  cadastrado,
  erro,
  loading,
  jaConsultou,
}: {
  titulo: string;
  descricao: string;
  rota: string;
  valor: string;
  aoMudar: (v: string) => void;
  aoEnviar: (e: React.FormEvent) => void;
  cadastrado: any;
  erro: any;
  loading: boolean;
  jaConsultou: boolean;
}) => {
  const situacao = conferir(cadastrado, rota);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
      <p className="mt-1 text-sm text-slate-500">{descricao}</p>

      <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
        <p className="font-medium text-slate-700">Cadastrado hoje na Efí</p>
        {cadastrado?.webhookUrl ? (
          <>
            <p className="mt-1 break-all text-slate-900">
              {cadastrado.webhookUrl}
            </p>
            {situacao === "ok" && (
              <p className="mt-1 text-emerald-700">
                Bate com a rota deste sistema.
              </p>
            )}
            {situacao === "diferente" && (
              <p className="mt-1 text-amber-700">
                Esse endereço não é o deste sistema. Confira se as notificações
                estão chegando.
              </p>
            )}
            {situacao && situacao !== "ok" && situacao !== "diferente" && (
              <p className="mt-1 text-amber-700">{situacao}</p>
            )}
          </>
        ) : erro ? (
          <p className="mt-1 break-all text-slate-500">
            Não foi possível consultar: {stringifySafe(erro).slice(0, 200)}
          </p>
        ) : (
          <p className="mt-1 text-slate-500">
            {jaConsultou
              ? "Nenhum webhook cadastrado."
              : "Ainda não consultado."}
          </p>
        )}
      </div>

      <form onSubmit={aoEnviar} className="mt-4 flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700">
          Endereço a cadastrar
        </label>
        <input
          className={entrada}
          type="text"
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? "Enviando..." : "Cadastrar"}
          </button>
          <button
            type="button"
            onClick={() => aoMudar(enderecoSugerido(rota))}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Usar o endereço deste sistema
          </button>
        </div>
      </form>
    </section>
  );
};

export const PixAutomaticoAdmin = () => {
  const [urlWebhook, setUrlWebhook] = useState(enderecoSugerido(ROTA_COBR));
  const [urlWebhookRecurrency, setUrlWebhookRecurrency] = useState(
    enderecoSugerido(ROTA_REC),
  );
  const [error, setError] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [loading, setLoading] = useState(false);
  const [cadastrados, setCadastrados] = useState<any>(null);

  const navigate = useNavigate();
  const { user } = useAuth();
  const token = user?.token;

  /** Webhook das cobranças (/v2/webhookcobr). */
  async function criarWebhookPixAutomatico(e: React.FormEvent) {
    e.preventDefault();
    if (!urlWebhook) {
      setError("Informe o endereço do webhook de cobranças.");
      return;
    }
    try {
      setError("");
      setSucesso("");
      setLoading(true);
      await axios.post(
        `${process.env.REACT_APP_URL}/Pix/criarWebhookPixAutomatico`,
        { urlWebhook },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSucesso("Webhook de cobranças cadastrado.");
      await consultarWebhooks();
    } catch (error: any) {
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  /** Webhook das recorrências (/v2/webhookrec). */
  async function criarWebhookPixRecorrenciaAutomatico(e: React.FormEvent) {
    e.preventDefault();
    if (!urlWebhookRecurrency) {
      setError("Informe o endereço do webhook de recorrências.");
      return;
    }
    try {
      setError("");
      setSucesso("");
      setLoading(true);
      await axios.post(
        `${process.env.REACT_APP_URL}/Pix/criarWebhookPixAutomaticoRecurrency`,
        { urlWebhookRecurrency },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSucesso("Webhook de recorrências cadastrado.");
      await consultarWebhooks();
    } catch (error: any) {
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  /** Mostra o que está cadastrado hoje na Efí. */
  async function consultarWebhooks() {
    try {
      setError("");
      setLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/consultarWebhooksPixAutomatico`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setCadastrados(response.data ?? null);
    } catch (error: any) {
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  // 🔧 Função que captura qualquer tipo de erro (string, objeto, AxiosError, etc.)
  function extractErrorMessage(err: any): string {
    if (err && err.response) {
      const d = err.response.data;
      if (typeof d === "string") return d;
      if (d == null) return `HTTP ${err.response.status || ""}`;
      return d.error || d.erro || d.message || stringifySafe(d);
    }
    if (err && err.request) {
      return "Falha de rede ou servidor indisponível.";
    }
    if (err instanceof Error && err.message) return err.message;
    return stringifySafe(err);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Webhooks do Pix Automático
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              É por aqui que a Efí avisa quando o cliente autoriza a recorrência
              e quando uma cobrança é paga.
            </p>
          </div>

          <button
            onClick={() => navigate("/Pix/automatico")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <FiArrowLeft className="size-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          A Efí acrescenta <strong>/rec</strong> e <strong>/cobr</strong> ao fim
          do endereço cadastrado. Para a notificação cair na rota deste sistema,
          o endereço precisa terminar em <strong>?ignorar=</strong> — é assim
          que os campos abaixo já vêm preenchidos.
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span className="font-semibold">Erro: </span>
            <span className="break-words">{error}</span>
          </div>
        )}
        {sucesso && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {sucesso}
          </div>
        )}

        <div className="mb-4">
          <button
            onClick={consultarWebhooks}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <FiRefreshCw className="size-4" />
            {loading ? "Consultando..." : "Consultar o que está cadastrado"}
          </button>
        </div>

        <div className="flex flex-col gap-6">
          <Bloco
            titulo="Recorrências"
            descricao="Avisa quando o cliente autoriza ou cancela a recorrência no banco dele."
            rota={ROTA_REC}
            valor={urlWebhookRecurrency}
            aoMudar={setUrlWebhookRecurrency}
            aoEnviar={criarWebhookPixRecorrenciaAutomatico}
            cadastrado={cadastrados?.recorrencia}
            erro={cadastrados?.erroRecorrencia}
            loading={loading}
            jaConsultou={!!cadastrados}
          />

          <Bloco
            titulo="Cobranças"
            descricao="Avisa quando uma cobrança da recorrência é paga, e é o que baixa a mensalidade no sistema."
            rota={ROTA_COBR}
            valor={urlWebhook}
            aoMudar={setUrlWebhook}
            aoEnviar={criarWebhookPixAutomatico}
            cadastrado={cadastrados?.cobranca}
            erro={cadastrados?.erroCobranca}
            loading={loading}
            jaConsultou={!!cadastrados}
          />
        </div>
      </div>
    </div>
  );
};
