import React from "react";
import { useParams } from "react-router-dom";

export const PdfViewer = () => {
  const { fileName } = useParams();

  // Construct the path to the PDF in the public folder
  // Assuming the dynamic param "fileName" matches the file name without .pdf
  // or we can just append .pdf if it's not provided.
  const pdfPath = `/pdfs/${fileName}.pdf`;

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="flex justify-center p-2 bg-gray-800">
        <a
          href={pdfPath}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Abrir/Baixar PDF
        </a>
      </div>
      <div className="flex-1 w-full h-full">
        <iframe
          src={pdfPath}
          title={`PDF: ${fileName}`}
          className="w-full h-full border-none"
        />
        {/* Fallback using object if iframe has issues, but iframe usually works for PDFs */}
        {/* <object data={pdfPath} type="application/pdf" className="w-full h-full">
                <p>Seu navegador não tem um plugin para PDF.
                Você pode <a href={pdfPath} download>baixar o arquivo PDF.</a></p>
            </object> */}
      </div>
    </div>
  );
};
