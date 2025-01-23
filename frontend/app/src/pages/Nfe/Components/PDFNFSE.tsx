import React from 'react'

interface PDFNFSEProps {
  dados: string;
}

export const PDFNFSE = ({dados}: PDFNFSEProps) => {
  return (
    <div>{dados}</div>
  )
}
