// PDFNFSE.tsx
import React, { forwardRef } from "react";

interface PDFNFSEProps {
  dados: any[];
}

const PDFNFSE = forwardRef<HTMLDivElement, PDFNFSEProps>(({ dados }, ref) => {
  return (
    <div ref={ref}>
      {dados.map((item, i) => (
        <div key={i}>
          <p>{item.nfse?.numeroNfse}</p>
          <p>{item.nfse?.valor_servico}</p>
          <p>{item.nfse?.aliquota}</p>
        </div>
      ))}
    </div>
  );
});

PDFNFSE.displayName = "PDFNFSE";

export default PDFNFSE;
