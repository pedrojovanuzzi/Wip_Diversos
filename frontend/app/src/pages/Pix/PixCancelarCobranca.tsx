import React, { useState } from "react";
import axios from "axios";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";

export const PixCancelarCobranca = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tabelaCancelada, setTabelaCancelada] = useState<any>();
  const [txid, setTxId] = useState("");
  const [openModal, setOpenModal] = useState(false);

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

  async function cancelarCobranca() {
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/cancelarCobranca`,
        { txid },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTabelaCancelada(response.data);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function buscarCobranca() {
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/buscarCobranca`,
        { txid },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTabelaCancelada(response.data);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400";

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Cobrança Pix
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Consulte ou cancele uma cobrança recorrente pelo TXID.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <label
            htmlFor="txid"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            TXID
          </label>
          <input
            id="txid"
            type="text"
            placeholder="25df0dfec3464a4690e..."
            className={inputCls}
            value={txid}
            onChange={(e) => setTxId(e.target.value)}
          />

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              onClick={buscarCobranca}
              disabled={!txid || loading}
              className="flex-1 inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-700 transition disabled:opacity-50"
            >
              {loading ? "Buscando…" : "Buscar Cobrança"}
            </button>
            <button
              onClick={() => setOpenModal(true)}
              disabled={!txid || loading}
              className="flex-1 inline-flex items-center justify-center rounded-xl bg-rose-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-rose-500 transition disabled:opacity-50"
            >
              Cancelar Cobrança
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800 break-words">
              {error}
            </div>
          )}
        </div>

        {/* Tabela */}
        {tabelaCancelada && (
          <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                Detalhes da cobrança
              </h2>
            </div>
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="ID Recorrência" value={tabelaCancelada.idRec} />
              <Row
                label="Status"
                value={
                  <StatusPill status={tabelaCancelada.status} />
                }
              />
              <Row
                label="Valor"
                value={`R$ ${tabelaCancelada.valor?.original ?? "—"}`}
              />
              <Row
                label="Informações"
                value={tabelaCancelada.infoAdicional || "—"}
              />
              <Row
                label="Política de Retentativa"
                value={tabelaCancelada.politicaRetentativa || "—"}
              />
              <Row
                label="Data de Criação"
                value={tabelaCancelada.calendario?.criacao || "—"}
              />
              <Row
                label="Data de Vencimento"
                value={tabelaCancelada.calendario?.dataDeVencimento || "—"}
              />
              <Row
                label="Encerramento"
                value={
                  tabelaCancelada.encerramento?.rejeicao ? (
                    <span className="break-all">
                      <span className="font-medium">
                        {tabelaCancelada.encerramento.rejeicao.codigo}
                      </span>{" "}
                      — {tabelaCancelada.encerramento.rejeicao.descricao}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              {tabelaCancelada.recebedor && (
                <Row
                  label="Recebedor"
                  value={
                    <div className="space-y-0.5">
                      <p>
                        <span className="text-slate-500">Nome:</span>{" "}
                        {tabelaCancelada.recebedor.nome}
                      </p>
                      <p>
                        <span className="text-slate-500">CNPJ:</span>{" "}
                        {tabelaCancelada.recebedor.cnpj}
                      </p>
                      <p>
                        <span className="text-slate-500">Agência:</span>{" "}
                        {tabelaCancelada.recebedor.agencia} /{" "}
                        <span className="text-slate-500">Conta:</span>{" "}
                        {tabelaCancelada.recebedor.conta}
                      </p>
                      <p>
                        <span className="text-slate-500">Tipo:</span>{" "}
                        {tabelaCancelada.recebedor.tipoConta}
                      </p>
                    </div>
                  }
                />
              )}
              {Array.isArray(tabelaCancelada.atualizacao) &&
                tabelaCancelada.atualizacao.length > 0 && (
                  <Row
                    label="Atualizações"
                    value={
                      <ul className="space-y-1">
                        {tabelaCancelada.atualizacao.map(
                          (a: any, i: number) => (
                            <li
                              key={i}
                              className="flex justify-between text-xs"
                            >
                              <span className="text-slate-700">{a.status}</span>
                              <span className="text-slate-400">
                                {new Date(a.data).toLocaleString("pt-BR")}
                              </span>
                            </li>
                          ),
                        )}
                      </ul>
                    }
                  />
                )}
              {Array.isArray(tabelaCancelada.tentativas) &&
                tabelaCancelada.tentativas.length > 0 && (
                  <Row
                    label="Tentativas"
                    value={
                      <ul className="space-y-1">
                        {tabelaCancelada.tentativas.map(
                          (t: any, i: number) => (
                            <li key={i} className="text-xs">
                              <span className="font-medium text-slate-700">
                                {t.status}
                              </span>{" "}
                              <span className="text-slate-400">
                                — {new Date(t.data).toLocaleString("pt-BR")}
                              </span>
                            </li>
                          ),
                        )}
                      </ul>
                    }
                  />
                )}
            </dl>
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      <Dialog
        open={openModal}
        onClose={setOpenModal}
        className="relative z-10"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-slate-900/60 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
        />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full justify-center p-4 text-center items-center sm:p-0">
            <DialogPanel
              transition
              className="relative transform overflow-hidden rounded-2xl bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95"
            >
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-rose-100 sm:mx-0 sm:size-10">
                  <ExclamationTriangleIcon
                    aria-hidden="true"
                    className="size-6 text-rose-600"
                  />
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <DialogTitle
                    as="h3"
                    className="text-base font-semibold text-slate-900"
                  >
                    Cancelar cobrança
                  </DialogTitle>
                  <div className="mt-2">
                    <p className="text-sm text-slate-500">
                      Tem certeza que deseja cancelar esta cobrança? Essa ação
                      não pode ser desfeita.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
                <button
                  type="button"
                  onClick={() => {
                    cancelarCobranca();
                    setOpenModal(false);
                  }}
                  className="inline-flex w-full justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 sm:w-auto"
                >
                  Cancelar cobrança
                </button>
                <button
                  type="button"
                  data-autofocus
                  onClick={() => setOpenModal(false)}
                  className="mt-3 inline-flex w-full justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:mt-0 sm:w-auto"
                >
                  Voltar
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="grid grid-cols-3 px-6 py-3 gap-3">
    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">
      {label}
    </dt>
    <dd className="col-span-2 text-slate-800">{value}</dd>
  </div>
);

const StatusPill: React.FC<{ status?: string }> = ({ status }) => {
  const s = (status || "").toUpperCase();
  let cls = "bg-slate-50 text-slate-600 ring-slate-200";
  if (s.includes("ATIV")) cls = "bg-sky-50 text-sky-700 ring-sky-200";
  else if (s.includes("REMOV") || s.includes("CANCEL"))
    cls = "bg-rose-50 text-rose-700 ring-rose-200";
  else if (s.includes("CONCLU"))
    cls = "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {status || "—"}
    </span>
  );
};
