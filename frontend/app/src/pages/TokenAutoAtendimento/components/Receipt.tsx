import React from "react";
import { format } from "date-fns";

interface ReceiptProps {
  clientName: string;
  cpfCnpj: string;
  faturaId: number | null;
  valor: string;
  dataPagamento: string;
  plano: string;
}

export const Receipt = React.forwardRef<HTMLDivElement, ReceiptProps>(
  ({ clientName, cpfCnpj, faturaId, valor, dataPagamento, plano }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-white text-black mx-auto printing-container"
        style={{
          width: "72mm", // Reduced from 80mm to allow margins
          padding: "0",
          fontFamily: '"Courier Prime", "Courier New", monospace',
          fontSize: "12px",
          lineHeight: "1.2",
        }}
      >
        <style type="text/css" media="print">
          {`
            @page {
              size: 80mm auto;
              margin: 0;
            }
            @media print {
              html, body {
                width: 80mm;
                margin: 0 !important;
                padding: 0 !important;
              }
              .printing-container {
                width: 72mm !important;
                margin: 0 auto !important; /* Centers the 72mm content on 80mm page */
                padding: 2mm 0 !important;
              }
            }
          `}
        </style>

        {/* Content matching the user's image */}
        <div className="text-left font-bold text-xs uppercase leading-relaxed font-mono">
          <div className="mb-4">
            <span className="text-sm">
              Recibo: {format(new Date(), "dd/MM/yy")}
            </span>
          </div>

          <div className="mb-2">
            <span className="block">
              EMITENTE: WIP TELECOM MULTIMIDIA EIRELI ME
            </span>
            <span className="block">CPF/CNPJ: 20.843.290/0001-42</span>
            <span className="block">RUA EMILIO CARRARO - AREALVA</span>
          </div>

          <div className="mt-4 text-justify">
            Recebi(emos) de{" "}
            <span className="underline decoration-dotted">{clientName}</span>
            <br />
            CPF/CNPJ: {cpfCnpj} a importância de{" "}
            <span className="text-sm">
              {parseFloat(valor || "0").toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
            <br />
            ref. ao pag. titulo de numero: {faturaId} vencido em{" "}
            {dataPagamento ? format(new Date(dataPagamento), "dd/MM/yy") : "-"}{" "}
            /Plano: {plano}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] space-y-1 mt-8 pt-4 border-t border-dashed border-black">
          <p className="font-bold">*** Obrigado pela preferência! ***</p>
          <p>www.wiptelecom.com.br</p>
        </div>
      </div>
    );
  }
);
