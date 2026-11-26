export const metadata = {
  title: "Documento — Wip Diversos",
};

/**
 * Origem: frontend/app/src/pages/PdfViewer/PdfViewer.tsx (público)
 * Não tem estado nem interação: é um Server Component puro. Os PDFs ficam em
 * public/pdfs (ex.: /doc/contrato abre /pdfs/contrato.pdf).
 */
export default async function PdfViewerPage({ params }: { params: Promise<{ fileName: string }> }) {
  const fileName = decodeURIComponent((await params).fileName);
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
        <iframe src={pdfPath} title={`PDF: ${fileName}`} className="w-full h-full border-none" />
      </div>
    </div>
  );
}
