import React, { FormEvent, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { MdPaid } from "react-icons/md";
import { FiCopy, FiExternalLink, FiDownload, FiRefreshCw } from "react-icons/fi";

interface InfoAdicional {
  nome: string;
  valor: string;
}

interface PixDetalhe {
  endToEndId: string;
  txid: string;
  valor: string;
  chave: string;
  horario: string;
}

interface StatusPix {
  calendario?: { criacao: string; expiracao: number };
  txid?: string;
  revisao?: number;
  status?: string;
  valor?: { original: string };
  chave?: string;
  devedor?: { cpf: string; nome: string };
  solicitacaoPagador?: string;
  infoAdicionais?: InfoAdicional[];
  loc?: { id: number; location: string; tipoCob: string; criacao: string };
  pix?: PixDetalhe[];
  pixCopiaECola?: string;
  location?: string;
}

const statusBadge = (status?: string) => {
  const s = (status || "").toUpperCase();
  if (s.includes("CONCLU"))
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (s.includes("ATIV")) return "bg-sky-50 text-sky-700 ring-sky-200";
  if (s.includes("REMOV") || s.includes("CANCEL"))
    return "bg-rose-50 text-rose-700 ring-rose-200";
  if (s.includes("EXPIR")) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-50 text-slate-600 ring-slate-200";
};

export const PixfindPaid: React.FC = () => {
  const [chargeId, setChargeId] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [porData, setPorData] = useState(false);
  const [status, setStatus] = useState<StatusPix | StatusPix[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const token = user?.token;
  const permission = user?.permission;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const url = porData
        ? `${process.env.REACT_APP_URL}/Pix/BuscarPixPagoData`
        : `${process.env.REACT_APP_URL}/Pix/BuscarPixPago`;

      const formatToUTC = (d: string) => (d ? new Date(d).toISOString() : "");
      const payload = porData
        ? { inicio: formatToUTC(inicio), fim: formatToUTC(fim) }
        : { chargeId };

      const response = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (porData) {
        const data = response.data?.cobs || response.data;
        setStatus(Array.isArray(data) ? data : []);
      } else {
        setStatus(response.data);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao buscar status");
    } finally {
      setLoading(false);
    }
  };

  const handleReenviarNotificacoes = async () => {
    if (!inicio || !fim) {
      alert("Informe o intervalo de datas antes de reenviar!");
      return;
    }
    try {
      setLoading(true);
      const formatToUTC = (d: string) => new Date(d).toISOString();
      await axios.post(
        `${process.env.REACT_APP_URL}/Pix/ReenviarNotificacoes`,
        { inicio: formatToUTC(inicio), fim: formatToUTC(fim) },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      alert("✅ Notificações reenviadas com sucesso!");
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao reenviar notificações!");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (texto: string) => {
    navigator.clipboard.writeText(texto);
    alert("Pix Copia e Cola copiado!");
  };

  const handleExportExcel = () => {
    if (!status || !Array.isArray(status) || status.length === 0) {
      alert("Não há dados para exportar.");
      return;
    }
    const linhas = status.map((pix) => ({
      Status: pix.status || "",
      "Valor (R$)": pix.valor?.original || "",
      TXID: pix.txid || "",
      "Pagador (PPPOE)": pix.devedor?.nome || "",
      Título: pix.infoAdicionais?.[0]?.valor || "",
      "Data do Pix": pix.calendario?.criacao
        ? new Date(pix.calendario.criacao).toLocaleString("pt-BR")
        : "",
      EndToEndId: pix.pix?.[0]?.endToEndId || "",
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagamentos PIX");
    XLSX.writeFile(
      wb,
      `Relatorio_Pix_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  const inputCls =
    "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400";

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="inline-flex rounded-xl p-2.5 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <MdPaid className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Consultar Pagamentos Pix
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Busque cobranças por ID de transação ou intervalo de datas.
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"
        >
          <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
            <input
              type="checkbox"
              checked={porData}
              onChange={() => setPorData(!porData)}
              className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
            />
            Buscar por intervalo de datas
          </label>

          {!porData ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                ID da cobrança (TXID)
              </label>
              <input
                type="text"
                placeholder="Digite o TXID"
                value={chargeId}
                onChange={(e) => setChargeId(e.target.value)}
                className={inputCls}
                required
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Início
                </label>
                <input
                  type="datetime-local"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Fim
                </label>
                <input
                  type="datetime-local"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50"
            >
              {loading
                ? "Consultando…"
                : porData
                ? "Buscar por Data"
                : "Consultar por ID"}
            </button>

            {porData && permission! >= 5 && (
              <button
                type="button"
                onClick={handleReenviarNotificacoes}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition disabled:opacity-50"
              >
                <FiRefreshCw />
                Reenviar Webhooks
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800 break-words">
              {error}
            </div>
          )}
        </form>

        {/* Resultado único */}
        {status && !Array.isArray(status) && (
          <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Detalhes da cobrança
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  TXID: {status.txid || "—"}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${statusBadge(status.status)}`}
              >
                {status.status || "—"}
              </span>
            </div>

            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              <Info label="Valor" value={`R$ ${status.valor?.original || "—"}`} />
              <Info
                label="Pagador"
                value={`${status.devedor?.nome || "—"} (${status.devedor?.cpf || "—"})`}
              />
              <Info
                label="Data"
                value={
                  status.calendario?.criacao
                    ? new Date(status.calendario.criacao).toLocaleString()
                    : "—"
                }
              />
              <Info
                label="Expira em"
                value={`${status.calendario?.expiracao ?? "—"} s`}
              />
              <Info label="Chave" value={status.chave || "—"} />
              <Info
                label="Solicitação"
                value={status.solicitacaoPagador || "—"}
              />
            </dl>

            {status.infoAdicionais?.length ? (
              <div className="mt-5">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  Informações adicionais
                </h4>
                <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {status.infoAdicionais.map((item, i) => (
                    <li
                      key={i}
                      className="flex justify-between px-3 py-2 text-sm"
                    >
                      <span className="text-slate-500">{item.nome}</span>
                      <span className="text-slate-800 font-medium">
                        {item.valor}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {status.pix?.length ? (
              <div className="mt-5">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  Detalhes do Pix
                </h4>
                <div className="space-y-2">
                  {status.pix.map((p, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                    >
                      <Info label="EndToEnd ID" value={p.endToEndId} mono />
                      <Info label="Valor" value={`R$ ${p.valor}`} />
                      <Info
                        label="Data/Hora"
                        value={new Date(p.horario).toLocaleString()}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {status.pixCopiaECola && (
              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => handleCopy(status.pixCopiaECola!)}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-700 transition"
                >
                  <FiCopy /> Copiar Pix Copia e Cola
                </button>
                {status.location && (
                  <a
                    href={`https://${status.location}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    <FiExternalLink /> Ver QR Code
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Resultado lista */}
        {Array.isArray(status) && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Resultados
                </h2>
                <p className="text-xs text-slate-500">
                  {status.length} cobrança(s) encontrada(s)
                </p>
              </div>
              <button
                onClick={handleExportExcel}
                disabled={status.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-500 transition disabled:opacity-50"
              >
                <FiDownload /> Exportar Excel
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {status.map((pix, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs text-slate-400">
                      #{index + 1}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ring-inset ${statusBadge(pix.status)}`}
                    >
                      {pix.status}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-slate-900">
                    R$ {pix.valor?.original}
                  </p>
                  <div className="mt-2 space-y-0.5 text-xs">
                    <Info label="TXID" value={pix.txid || "—"} mono small />
                    <Info
                      label="PPPOE"
                      value={pix.devedor?.nome || "—"}
                      small
                    />
                    <Info
                      label="Título"
                      value={pix.infoAdicionais?.[0]?.valor || "—"}
                      small
                    />
                    <Info
                      label="Data"
                      value={
                        pix.calendario?.criacao
                          ? new Date(pix.calendario.criacao).toLocaleString()
                          : "—"
                      }
                      small
                    />
                  </div>

                  {pix.pixCopiaECola && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleCopy(pix.pixCopiaECola!)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 text-white px-2.5 py-1.5 text-xs font-medium hover:bg-slate-700 transition"
                      >
                        <FiCopy /> Copiar
                      </button>
                      {pix.location && (
                        <a
                          href={`https://${pix.location}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                        >
                          <FiExternalLink /> QR
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Info: React.FC<{
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  small?: boolean;
}> = ({ label, value, mono, small }) => (
  <div className={`flex ${small ? "" : "flex-col"} gap-1`}>
    <span
      className={`text-slate-500 ${small ? "text-[11px] min-w-[60px]" : "text-xs"}`}
    >
      {label}
    </span>
    <span
      className={`text-slate-800 ${mono ? "font-mono" : "font-medium"} ${small ? "text-[11px] break-all" : "text-sm"}`}
    >
      {value}
    </span>
  </div>
);
