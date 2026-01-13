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
        className="p-8 font-mono text-black bg-white w-[80mm] mx-auto"
      >
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold uppercase">
            Recibo {dataPagamento}
          </h1>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            Emitente: <strong>WIP TELECOM MULTIMIDIA EIRELI ME</strong>{" "}
            CPF/CNPJ: 20.843.290/0001-42
            <p className="font-bold text-gray-500 text-xs uppercase">
              RUA EMILIO CARRARO - AREALVA Recebi(emos) de {clientName}
            </p>
            <p>
              CPF/CNPJ: {cpfCnpj} a importância de {valor}
            </p>
            <p>ref. ao pag. titulo de numero {faturaId}</p>
            <p>na data de {dataPagamento}</p>
          </div>

          <div>
            <p className="font-bold text-gray-500 text-xs uppercase">
              Detalhes da Fatura
            </p>
            <div className="flex justify-between">
              <span>Fatura ID:</span>
              <span>#{faturaId}</span>
            </div>
            <div className="flex justify-between">
              <span>Data de Vencimento:</span>
              {/* Assuming dataPagamento is the due date or payment date string */}
              <span>
                {dataPagamento
                  ? format(new Date(dataPagamento), "dd/MM/yyyy")
                  : "-"}
              </span>
            </div>
          </div>

          <div className="border-b-2 border-dashed border-gray-300 my-4"></div>

          <div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total Pago:</span>
              <span>
                {parseFloat(valor || "0").toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="border-b-2 border-dashed border-gray-300 my-6"></div>

        <div className="text-center text-xs space-y-2">
          <p>Data/Hora da Emissão:</p>
          <p>{format(new Date(), "dd/MM/yyyy HH:mm:ss")}</p>
          <br />
          <p className="font-bold">Obrigado pela preferência!</p>
          <p>Volte sempre.</p>
        </div>
      </div>
    );
  }
);
