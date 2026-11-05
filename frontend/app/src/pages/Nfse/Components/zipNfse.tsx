// Monta, no navegador, o ZIP das NFS-e selecionadas: xmls/, pdfs/ e um
// relatório em PDF. O PDF de cada nota sai do mesmo layout da impressão
// (PDFNFSE / DanfseNacional), capturado com html2canvas.
import React from "react";
import axios from "axios";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import PDFNFSE from "./PDFNFSE";

export interface NotaParaZip {
  id: number;
  numeroNfse?: string | number | null;
  numeroRps?: string | number | null;
}

interface Opcoes {
  notas: NotaParaZip[];
  ambiente: string;
  token?: string;
  dateFilter?: { start: string; end: string } | null;
  onProgresso?: (feitas: number, total: number) => void;
}

export interface ResultadoZip {
  blob: Blob;
  falhas: number;
  semRelatorio: boolean;
}

// Quantas notas consultar por chamada (cada uma vai à prefeitura/API nacional).
const LOTE = 5;

const nomeDaNota = (n: NotaParaZip) =>
  n.numeroNfse
    ? `NFSe_${n.numeroNfse}`
    : n.numeroRps
      ? `RPS_${n.numeroRps}`
      : `NFSe_id_${n.id}`;

async function esperarImagens(el: HTMLElement) {
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((ok) => {
            img.onload = () => ok();
            img.onerror = () => ok();
          }),
    ),
  );
}

async function notaEmPdf(item: any): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  // Fora da área visível, com largura de uma A4 (96 dpi).
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;background:#fff;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => {
      root.render(<PDFNFSE dados={[item]} naTela />);
    });
    await esperarImagens(host);

    const canvas = await html2canvas(host, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const margem = 5;
    const larguraPagina = 210;
    const alturaPagina = 297;
    const largura = larguraPagina - margem * 2;
    const altura = (canvas.height * largura) / canvas.width;
    const util = alturaPagina - margem * 2;
    const imagem = canvas.toDataURL("image/jpeg", 0.92);

    // Nota maior que uma página: repete a imagem deslocada em cada folha.
    let desenhado = 0;
    while (desenhado < altura) {
      if (desenhado > 0) pdf.addPage();
      pdf.addImage(imagem, "JPEG", margem, margem - desenhado, largura, altura);
      desenhado += util;
    }
    return pdf.output("blob");
  } finally {
    root.unmount();
    host.remove();
  }
}

export async function montarZipNfse({
  notas,
  ambiente,
  token,
  dateFilter,
  onProgresso,
}: Opcoes): Promise<ResultadoZip> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const pastaXml = zip.folder("xmls")!;
  const pastaPdf = zip.folder("pdfs")!;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  let feitas = 0;
  let falhas = 0;
  onProgresso?.(0, notas.length);

  for (let i = 0; i < notas.length; i += LOTE) {
    const lote = notas.slice(i, i + LOTE);
    let dados: any[] = [];
    try {
      const resp = await axios.post(
        `${process.env.REACT_APP_URL}/nfse/imprimirNFSE`,
        { id: lote.map((n) => n.id), ambiente },
        { headers },
      );
      dados = Array.isArray(resp.data) ? resp.data : [];
    } catch (err: any) {
      const motivo =
        err?.response?.data?.error || err?.message || "falha na consulta";
      dados = lote.map(() => ({ status: "error", message: motivo }));
    }

    for (let j = 0; j < lote.length; j++) {
      const nota = lote[j];
      const item = dados[j];
      const nome = nomeDaNota(nota);

      if (!item || item.status === "error" || item.error) {
        falhas++;
        const motivo = [item?.message, item?.error && String(item.error)]
          .filter(Boolean)
          .join(" - ");
        zip.file(
          `erros/${nome}.txt`,
          `Não foi possível consultar a nota (id ${nota.id}): ${motivo || "sem resposta"}`,
        );
      } else {
        const xml = item.xml || item.xmlAbrasf;
        if (xml) pastaXml.file(`${nome}.xml`, xml);
        try {
          pastaPdf.file(`${nome}.pdf`, await notaEmPdf(item));
        } catch (err) {
          console.error(`Erro ao gerar PDF da NFS-e ${nome}:`, err);
          falhas++;
          pastaPdf.file(`ERRO_${nome}.txt`, `Falha ao gerar PDF: ${err}`);
        }
      }

      feitas++;
      onProgresso?.(feitas, notas.length);
    }
  }

  let semRelatorio = false;
  try {
    const rel = await axios.post(
      `${process.env.REACT_APP_URL}/nfse/gerarRelatorioPdf`,
      { id: notas.map((n) => n.id), ambiente, dateFilter },
      { headers, responseType: "blob" },
    );
    zip.file("relatorio_nfse.pdf", rel.data);
  } catch (err) {
    console.error("Erro ao gerar relatório de NFS-e:", err);
    semRelatorio = true;
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, falhas, semRelatorio };
}
