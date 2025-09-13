import { useLocation, useNavigate } from 'react-router-dom';

export const LogViewer = () => {
   const location = useLocation();
  const { fileName, content, path } = location.state || {};
    const navigate = useNavigate();
  
    function goBack() {
    navigate("/ServerLogs", {
          state: {
            path: path
          }
        });
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Arquivo: {fileName}</h1>
      <button className='bg-slate-700 text-gray-200 rounded-sm w-32 p-2' onClick={goBack}>Voltar</button>
      <pre className="bg-gray-900 text-left text-white p-4 rounded mt-4 max-h-[70vh] overflow-auto">
        {content || "Sem conteúdo"}
      </pre>
    </div>
  );
}
