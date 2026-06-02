import React, { useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { ClockIcon } from "@heroicons/react/24/outline";
import { IoDocuments } from "react-icons/io5";
import { FaBoxOpen, FaUsers } from "react-icons/fa";
import { FiCopy, FiCheckCircle } from "react-icons/fi";

type ModoKey = "ultimo" | "todos" | "aberto" | "varias";

const MODOS: Record<
  ModoKey,
  {
    titulo: string;
    descricao: string;
    url: string;
    icon: React.ReactNode;
    cor: string;
  }
> = {
  ultimo: {
    titulo: "Pix do Último Vencimento",
    descricao:
      "Gera o Pix referente à última mensalidade vencida do cliente.",
    url: `${process.env.REACT_APP_URL}/Pix/gerador`,
    icon: <ClockIcon className="size-6" />,
    cor: "bg-teal-50 text-teal-700 ring-teal-200",
  },
  todos: {
    titulo: "Pix de Todos os Vencimentos",
    descricao: "Gera um único Pix contendo todas as mensalidades vencidas.",
    url: `${process.env.REACT_APP_URL}/Pix/geradorAll`,
    icon: <IoDocuments className="size-6" />,
    cor: "bg-purple-50 text-purple-700 ring-purple-200",
  },
  aberto: {
    titulo: "Pix Mensalidade em Aberto",
    descricao: "Gera o Pix da mensalidade que ainda está em aberto.",
    url: `${process.env.REACT_APP_URL}/Pix/geradorAberto`,
    icon: <FaBoxOpen className="size-6" />,
    cor: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  varias: {
    titulo: "Pix de Várias Contas",
    descricao:
      "Combina várias mensalidades ou várias contas em um único Pix.",
    url: `${process.env.REACT_APP_URL}/Pix/geradorTitulos`,
    icon: <FaUsers className="size-6" />,
    cor: "bg-amber-50 text-amber-700 ring-amber-200",
  },
};

export const PixDetalhe = () => {
  const { tipo } = useParams<{ tipo: ModoKey }>();
  const { user: authUser } = useAuth();
  const token = authUser?.token;

  const [user, setUser] = useState("");
  const [cpf, setCpf] = useState("");
  const [titulos, setTitulos] = useState("");
  const [perdoarjuros, setPerdoarJuros] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pixUrl, setPixUrl] = useState("");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [cliente, setCliente] = useState("");
  const [copied, setCopied] = useState(false);

  const modo =
    (tipo && MODOS[tipo]) || {
      titulo: "Tipo de Pix inválido",
      descricao: "Verifique a URL.",
      url: "",
      icon: null,
      cor: "bg-slate-100 text-slate-600 ring-slate-200",
    };

  const isVarias = tipo === "varias";
  const mostraPerdoarJuros = tipo === "ultimo" || tipo === "aberto";

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

  async function gerarPix(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPixUrl("");
    setCliente("");
    setDataVencimento("");
    setValor("");
    setLoading(true);

    try {
      const payload = isVarias
        ? { nome_completo: user, cpf, titulos }
        : { pppoe: user, cpf, perdoarjuros };

      const response = await axios.post(modo.url, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPixUrl(response.data.link);
      setCliente(response.data.pppoe);
      setDataVencimento(response.data.formattedDate);
      setValor(response.data.valor);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function copiarLink() {
    navigator.clipboard.writeText(pixUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400";

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {modo.icon && (
            <div
              className={`inline-flex rounded-xl p-2.5 ring-1 ring-inset ${modo.cor}`}
            >
              {modo.icon}
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {modo.titulo}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{modo.descricao}</p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={gerarPix}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"
        >
          {!isVarias ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                PPPOE
              </label>
              <input
                type="text"
                autoComplete="name"
                placeholder="Login PPPOE"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className={inputCls}
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nome completo
                </label>
                <input
                  type="text"
                  placeholder="Nome completo do cliente"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Títulos
                </label>
                <input
                  type="text"
                  placeholder="182790, 123456, 678902"
                  value={titulos}
                  onChange={(e) => setTitulos(e.target.value)}
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Separe múltiplos títulos por vírgula.
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              CPF
            </label>
            <input
              type="text"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              className={inputCls}
            />
          </div>

          {mostraPerdoarJuros && (
            <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
              <input
                type="checkbox"
                checked={perdoarjuros}
                onChange={(e) => setPerdoarJuros(e.target.checked)}
                className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
              />
              Perdoar juros da parcela
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Gerando…" : "Gerar Pix"}
          </button>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800 break-words">
              {error}
            </div>
          )}
        </form>

        {/* Resultado */}
        {pixUrl && (
          <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <FiCheckCircle className="text-emerald-500 size-5" />
              <h2 className="text-base font-semibold text-slate-900">
                Pix gerado
              </h2>
            </div>

            <dl className="grid sm:grid-cols-2 gap-4">
              {valor && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                  <dt className="text-xs font-medium text-emerald-700">
                    Valor
                  </dt>
                  <dd className="mt-0.5 text-xl font-bold text-emerald-700">
                    R$ {Number(valor).toFixed(2)}
                  </dd>
                </div>
              )}
              {dataVencimento && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <dt className="text-xs font-medium text-slate-500">
                    Vencimento
                  </dt>
                  <dd className="mt-0.5 text-base font-semibold text-slate-800">
                    {dataVencimento}
                  </dd>
                </div>
              )}
              {cliente && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 sm:col-span-2">
                  <dt className="text-xs font-medium text-slate-500">
                    Cliente
                  </dt>
                  <dd className="mt-0.5 text-base font-semibold text-slate-800">
                    {cliente}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-5">
              <p className="text-xs font-medium text-slate-700 mb-1.5">
                Link do Pix
              </p>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 break-all">
                  {pixUrl}
                </div>
                <button
                  type="button"
                  onClick={copiarLink}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  <FiCopy />
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
