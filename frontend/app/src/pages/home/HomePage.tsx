import React, { useEffect } from "react";
import { HiCheckCircle } from "react-icons/hi2";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

export const HomePage = () => {
  const { user } = useAuth();
  const permission = user?.permission;
  const token = user?.token;

  useEffect(() => {
    document.title = "Home";
  }, []);

  const backup = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/Backup/Backup`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <NavBar />
      <div className="grid grid-cols-1 grid-rows-[150px_150px_300px] justify-items-center items-center h-screen gap-5">
        <h1 className="col-span-1 font-semibold sm:place-self-start sm:ml-40 sm:mt-10 text-2xl">
          Home
        </h1>
        <h2 className="col-span-1">Por Enquanto Não Temos Nada Aqui</h2>
        <HiCheckCircle className="size-40 col-span-1 self-start text-green-500" />
        <div className="flex justify-center flex-col items-center gap-5">
          {permission! >= 2 && (
            <>
              <h1>Gerar Backup das outras Paginas</h1>
              <button
                onClick={backup}
                className="bg-orange-500 text-black border-black transition-colors hover:bg-orange-300 w-full rounded-md  p-2"
              >
                Gerar Backup
              </button>
              <h2>Links da nossas outras Paginas</h2>
              <a
                className="bg-green-500 text-black border-black transition-colors hover:bg-green-300 w-full rounded-md  p-2"
                href="https://apimk.wiptelecomunicacoes.com.br/"
              >
                Pix
              </a>
              <a
                className="bg-green-500 text-black border-black transition-colors hover:bg-green-300 w-full rounded-md  p-2"
                href="https://wippainel.wiptelecomunicacoes.com.br/"
              >
                Wip Painel
              </a>
              <a
                className="bg-green-500 text-black border-black transition-colors hover:bg-green-300 w-full rounded-md  p-2 mb-10"
                href="https://whatsemail.wiptelecomunicacoes.com.br/"
              >
                Mensagens Whatsapp
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
