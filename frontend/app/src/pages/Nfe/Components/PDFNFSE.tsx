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
          <div className="ring-1 text-sm ring-black grid grid-cols-6">
            <div className="flex justify-start items-center col-span-1 border-black">
            <img src={logo} className="w-72 h-32"/>
            </div>
            <div className="flex flex-col justify-center relative border-x p-5 col-span-3 border-black">
            <p className="text-center self-center absolute top-2">Operadora: <strong>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</strong></p>
            <p className="mt-5">CNPJ: <strong>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</strong></p>
            <p>Endereço: <strong>ddddddddddddddd</strong></p>
            <p>Bairro: <strong>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</strong></p>
            <p>Cidade: <strong>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</strong></p>
            <p>E-mail: <strong>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</strong></p>
            <p>Site: <strong>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</strong></p>
            <p>SAC: <strong>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</strong></p>
            </div>
            <div className="flex flex-col justify-center col-span-2 px-5 relative">
              <h1 className="text-center self-center absolute top-2">NFS-e</h1>
              <p>Nº: <strong>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</strong></p>
              <p>CFOP: <strong>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</strong></p>
              <p>Data Emissão: <strong>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</strong></p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

PDFNFSE.displayName = "PDFNFSE";

export default PDFNFSE;
