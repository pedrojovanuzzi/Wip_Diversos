// PDFNFSE.tsx
import React, { forwardRef } from "react";
import logo from "../../../assets/icon.png";

interface PDFNFSEProps {
  dados: any[];
}

const PDFNFSE = forwardRef<HTMLDivElement, PDFNFSEProps>(({ dados }, ref) => {
  return (
    <div  className="hidden print:block" ref={ref}>
      {dados.map((item, i) => (
        <div key={i}>
          <div className="ring-2 ring-black flex justify-evenly items-center">
            <img src={logo} className="w-20" />
            <div className="flex flex-col items-center">
            <p>Operadora: {item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</p>
            <p>CNPJ: {item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</p>
            <p>Endereço: {item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</p>
            <p>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</p>
            <p>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</p>
            <p>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</p>
            <p>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</p>
            <p>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</p>
            </div>
            <div className="flex flex-col items-center">
              <h1>NFS-e</h1>
              <p>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</p>
              <p>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</p>
              <p>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

PDFNFSE.displayName = "PDFNFSE";

export default PDFNFSE;
