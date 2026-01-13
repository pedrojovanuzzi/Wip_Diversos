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
        className="bg-white text-black p-2 mx-auto printing-container"
        style={{
          width: "80mm",
          fontFamily: '"Courier Prime", "Courier New", monospace',
          fontSize: "12px",
          lineHeight: "1.2",
        }}
      >
        {/* Header */}
        <div className="text-center mb-2 pb-2 border-b border-dashed border-black">
          <h1 className="text-base font-bold uppercase tracking-wide">
            WIP TELECOM
          </h1>
          <p className="text-[10px]">WIP TELECOM MULTIMIDIA EIRELI ME</p>
          <p className="text-[10px]">CNPJ: 20.843.290/0001-42</p>
          <p className="text-[10px]">RUA EMILIO CARRARO - AREALVA</p>
        </div>

        {/* Title */}
        <div className="text-center my-3">
          <h2 className="text-sm font-bold uppercase border border-black inline-block px-4 py-1 rounded-sm">
            Recibo de Pagamento
          </h2>
        </div>

        {/* Client Info */}
        <div className="mb-3">
          <p className="font-bold text-xs uppercase mb-1 border-b border-black inline-block">
            Pagador
          </p>
          <p className="uppercase truncate font-bold">{clientName}</p>
          <p>CPF/CNPJ: {cpfCnpj}</p>
        </div>

        {/* Payment Details */}
        <div className="mb-3">
          <p className="font-bold text-xs uppercase mb-1 border-b border-black inline-block">
            Detalhes
          </p>
          <div className="flex justify-between">
            <span>Fatura:</span>
            <span className="font-bold">#{faturaId}</span>
          </div>
          <div className="flex justify-between">
            <span>Vencimento:</span>
            <span>
              {dataPagamento
                ? format(new Date(dataPagamento), "dd/MM/yyyy")
                : "-"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Plano:</span>
            <span className="truncate max-w-[120px] text-right">{plano}</span>
          </div>
        </div>

        {/* Totals */}
        <div className="my-4 border-t border-b border-dashed border-black py-2">
          <div className="flex justify-between items-center text-base font-bold">
            <span>TOTAL PAGO</span>
            <span>
              {parseFloat(valor || "0").toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] space-y-1 mt-4">
          <p>Emissão: {format(new Date(), "dd/MM/yyyy HH:mm:ss")}</p>
          <p className="mt-2 text-xs font-bold uppercase">
            *** Obrigado pela preferência! ***
          </p>
          <p>www.wiptelecom.com.br</p>
        </div>
      </div>
    );
  }
);
