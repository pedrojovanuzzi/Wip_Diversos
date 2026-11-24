import { Detalhe, Titulo } from "./api";
import { dataCurta, numeroTitulo, reais } from "./mkauthEstilo";

const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );

function abrirParaImprimir(titulo: string, corpo: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(titulo)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#222;margin:24px;font-size:14px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:18px 0 6px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#000;color:#fff;text-align:left;padding:4px 6px;font-size:13px;text-transform:uppercase}
  td{padding:4px 6px;border-bottom:1px solid #ddd}
  .recibo{border:2px solid #000;padding:18px;margin-bottom:24px;page-break-inside:avoid}
  .linha{display:flex;justify-content:space-between;gap:16px}
  .ass{margin-top:48px;border-top:1px solid #000;width:320px;text-align:center;padding-top:4px}
  .dir{text-align:right}
  @media print{button{display:none}}
</style></head><body>${corpo}
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
  return true;
}

function cabecalho(d: Detalhe) {
  const p = d.provedor;
  if (!p) return "";
  return `<div><h1>${esc(p.razao || p.nome)}</h1>
<div>${p.cnpj ? `CNPJ ${esc(p.cnpj)} · ` : ""}${esc([p.endereco, p.bairro, p.cidade, p.estado].filter(Boolean).join(", "))}${p.fone ? ` · ${esc(p.fone)}` : ""}</div></div>`;
}

/** Recibo de um título pago (o MK-Auth tem o recibo.hhvm). */
export function imprimirRecibo(d: Detalhe, t: Titulo) {
  const corpo = `<div class="recibo">
${cabecalho(d)}
<div class="linha" style="margin-top:16px"><h2>RECIBO ${numeroTitulo(t.id)}</h2><h2>${reais(t.valorpag)}</h2></div>
<p>Recebemos de <b>${esc(d.cliente.nome)}</b> (${esc(d.cliente.login)}) a importância de
<b>${reais(t.valorpag)}</b>, referente ao título ${numeroTitulo(t.id)}
(${esc(t.tipo)}${t.referencia ? ` ${esc(t.referencia)}` : ""}) com vencimento em ${dataCurta(t.datavenc)}.</p>
<p>Pago em ${t.datapag ? new Date(t.datapag).toLocaleString("pt-BR") : ""} · forma: ${esc(t.formapag)}${t.coletor ? ` · recebido por ${esc(t.coletor)}` : ""}</p>
${t.recibo ? `<p style="font-size:11px;color:#666">Autenticação: ${esc(t.recibo)}</p>` : ""}
<div class="ass">${esc(d.provedor?.nome || "")}</div>
</div>`;
  return abrirParaImprimir(`Recibo ${numeroTitulo(t.id)}`, corpo);
}

/** Exportar para excel: CSV com ; e BOM, que o Excel abre direto. */
export function exportarCsv(d: Detalhe, titulos: Titulo[]) {
  const cab = [
    "titulo",
    "tipo",
    "status",
    "vencimento",
    "nossonumero",
    "linha digitavel",
    "valor",
    "pagamento",
    "valor pago",
    "forma",
  ];
  const linhas = titulos.map((t) =>
    [
      numeroTitulo(t.id),
      t.tipo,
      t.status,
      dataCurta(t.datavenc),
      t.nossonum,
      t.linhadig,
      t.valorTotal.toFixed(2).replace(".", ","),
      dataCurta(t.datapag),
      t.valorpag ? Number(t.valorpag).toFixed(2).replace(".", ",") : "",
      t.formapag,
    ]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(";"),
  );
  const blob = new Blob(["﻿" + [cab.join(";"), ...linhas].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `titulos-${d.cliente.login}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
