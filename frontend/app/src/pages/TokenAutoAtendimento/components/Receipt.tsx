import React from "react";
import { format } from "date-fns";

interface ReceiptProps {
  clientName: string;
  cpfCnpj: string;
  faturaId: number | string | null;
  valor: string;
  dataPagamento: string;
  plano: string;
}

export const Receipt = React.forwardRef<HTMLDivElement, ReceiptProps>(
  ({ clientName, cpfCnpj, faturaId, valor, dataPagamento, plano }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-white text-black mx-auto printing-container font-mono"
        style={{
          width: "72mm", // Reduced from 80mm to allow margins
          padding: "0",
          fontFamily: '"Courier Prime", "Courier New", monospace',
          fontSize: "12px",
          lineHeight: "1.3",
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

        {/* Header */}
        <div className="text-center mb-4 pb-2 border-b-2 border-black">
          <h1 className="text-xl font-black uppercase tracking-wider mb-1">
            WIP TELECOM
          </h1>
          <div className="text-[10px] grid gap-0.5 leading-tight">
            <p className="font-bold">WIP TELECOM MULTIMIDIA EIRELI</p>
            <p>CNPJ: 20.843.290/0001-42</p>
            <p>RUA EMILIO CARRARO - AREALVA</p>
          </div>
        </div>

        {/* Receipt Title Box */}
        <div className="text-center mb-6">
          <div className="inline-block bg-black text-white px-6 py-1 rounded-sm">
            <h2 className="text-sm font-bold uppercase tracking-widest">
              RECIBO DE PAGAMENTO
            </h2>
          </div>
          <p className="text-xs mt-1 font-bold">
            {format(new Date(), "dd/MM/yyyy")}
          </p>
        </div>

        {/* Body Content */}
        <div className="text-justify text-xs uppercase leading-relaxed space-y-4">
          {/* Payer Section */}
          <div>
            <p className="text-[10px] font-bold border-b border-black inline-block mb-1">
              PAGADOR
            </p>
            <p className="font-bold text-sm block">{clientName}</p>
            <p>CPF/CNPJ: {cpfCnpj}</p>
          </div>

          <div className="border-t border-dashed border-black/50 my-2"></div>

          {/* Details Section */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold border-b border-black inline-block mb-1">
              DETALHES
            </p>
            <p>
              Recebemos a importância de:
              <br />
              <span className="text-lg font-black block mt-1 border border-black p-1 text-center bg-gray-100">
                {parseFloat(valor || "0").toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </p>

            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dotted border-black">
              <div>
                <span className="text-[10px] block font-bold">REFERÊNCIA</span>
                <span>Fatura #{faturaId}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] block font-bold">VENCIMENTO</span>
                <span>
                  {dataPagamento
                    ? format(new Date(dataPagamento), "dd/MM/yy")
                    : "-"}
                </span>
              </div>
            </div>

            <div className="mt-1">
              <span className="text-[10px]">PLANO:</span>{" "}
              <span className="font-bold">{plano}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-2 mt-8 pt-4 border-t-2 border-black">
          <p className="text-xs font-black uppercase">
            *** Obrigado pela preferência! ***
          </p>
          <div className="text-[10px] space-y-0.5">
            <p>Emissão: {format(new Date(), "dd/MM/yyyy HH:mm:ss")}</p>
            <p className="font-bold">www.wiptelecom.net.br</p>
          </div>
          <div className="pb-4 border-b border-black w-1/2 mx-auto"></div>
        </div>
      </div>
    );
  },
);
