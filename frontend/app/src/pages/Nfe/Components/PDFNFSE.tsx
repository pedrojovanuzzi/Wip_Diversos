// PDFNFSE.tsx
import React, { forwardRef } from "react";

interface PDFNFSEProps {
  dados: any[];
}

const PDFNFSE = forwardRef<HTMLDivElement, PDFNFSEProps>(({ dados }, ref) => {
  return (
    <div  className="hidden print:block" ref={ref}>
      {dados.map((item, i) => (
        <div key={i}>
          <p>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</p>
        </div>
      ))}
    </div>
  );
});

PDFNFSE.displayName = "PDFNFSE";

export default PDFNFSE;
