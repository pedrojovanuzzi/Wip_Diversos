import type React from "react";

// Visual copiado do MK-Auth (admin/clientes.hhvm e cliente_det.hhvm), que usa
// Bulma: fonte do sistema, texto #4a4a4a, cabeçalho de tabela preto e linhas
// alternando com #f5f5f5.
export const FONTE_MK =
  'BlinkMacSystemFont, -apple-system, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';

export const paginaMk: React.CSSProperties = {
  fontFamily: FONTE_MK,
  color: "#4a4a4a",
  fontSize: 16,
  background: "#fff",
  textAlign: "left",
  minHeight: "100vh",
};

export const cabecalhoTabela =
  "bg-black text-white font-bold uppercase text-left text-[15px]";

export const linhaZebra = (i: number) =>
  i % 2 === 1 ? "bg-[#f5f5f5]" : "bg-white";

export function dataCurta(valor: string | null | undefined) {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function reais(valor: string | number | null | undefined) {
  const n = Number(valor || 0);
  return `R$ ${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const numeroTitulo = (id: number) => String(id).padStart(5, "0");

const dois = (n: number) => String(n).padStart(2, "0");

/** Data local "YYYY-MM-DD" (para <input type="date">). */
export function dataIso(valor: string | Date | null | undefined) {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

/** Agora em "YYYY-MM-DDTHH:MM" (para <input type="datetime-local">). */
export function agoraLocal() {
  const d = new Date();
  return `${dataIso(d)}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** 79.9 -> "79,90" (como os campos de valor do MK-Auth). */
export const valorCampo = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** "1.234,56" -> 1234.56 */
export function numeroDe(s: string) {
  const t = String(s || "").trim();
  if (!t) return 0;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
}

/** Dias entre hoje e o vencimento, como o "[ 4 ]" do MK-Auth (sem sinal). */
export function diasDoVencimento(venc: string | null) {
  if (!venc) return 0;
  const v = new Date(venc);
  v.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.abs(Math.round((hoje.getTime() - v.getTime()) / 86_400_000));
}

/** Multa e mora de hoje pelos percentuais do título (mesma conta do backend). */
export function multaMora(t: {
  valor: string | null;
  datavenc: string | null;
  percmulta: string | null;
  percmora: string | null;
}) {
  if (!t.datavenc) return { multa: 0, mora: 0 };
  const v = new Date(t.datavenc);
  v.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.max(0, Math.round((hoje.getTime() - v.getTime()) / 86_400_000));
  if (!dias) return { multa: 0, mora: 0 };
  const valor = Number(t.valor || 0);
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    multa: r((valor * Number(t.percmulta || 0)) / 100),
    mora: r(((valor * Number(t.percmora || 0)) / 100 / 30) * dias),
  };
}
