import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavBar } from '../../components/navbar/NavBar';

export const LogsClient = () => {

    const [content, setContent] = useState('');

  return (
    <><NavBar color='green-500'></NavBar><div className="p-4 flex flex-col justify-center">
          <pre className="bg-gray-900 text-left text-white p-4 rounded mt-4 max-h-[70vh] overflow-auto">
              {content || "Sem conteúdo"}
          </pre>
      </div></>
  );
}
