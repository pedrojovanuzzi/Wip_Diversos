import React, { useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import Stacked from "./Components/Stacked";
import Filter from "./Components/Filter";
import { CiCirclePlus } from "react-icons/ci";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../types";
import { BsFiletypeDoc } from "react-icons/bs";
import { IoArrowUpCircleOutline } from "react-icons/io5";


export const Nfe = () => {
  const [dadosNFe, setDadosNFe] = useState({});
  const [arquivo, setArquivo] = useState<File | null>(null);
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const { user } = useTypedSelector((state) => state.auth);
  const token = user.token;


  const emitirNFe = async () => {
    try {
      const token = "seu-token-aqui"; // Substitua pelo token correto (ex.: armazenado no estado ou localStorage)
  
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/`,
        dadosNFe,
        {
          headers: {
            Authorization: `Bearer ${token}`, // Inclui o Bearer Token
            "Content-Type": "application/json", // Define o tipo de conteúdo (se necessário)
          },
        }
      );
      console.log("NF-e emitida:", resposta.data);
      setDadosNFe(resposta.data);
    } catch (erro) {
      console.error("Erro ao emitir NF-e:", erro);
    }
  };
  

  const enviarCertificado = async () => {
    if (!arquivo) {
      alert("Selecione um arquivo para enviar.");
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", arquivo);

    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      console.log("Certificado enviado:", resposta.data);
    } catch (erro) {
      console.error("Erro ao enviar o certificado:", erro);
    }
  };

  return (
    <div>
      <NavBar />
      <Stacked />
      <Filter />
      <main className="flex justify-center mt-20">
        <div className="flex flex-col sm:flex-row items-center">
        <label className="relative ring-2 ring-black bg-slate-500  text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-400 transition-all cursor-pointer">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-4xl"><CiCirclePlus/></span>
            <span>Adicionar Novo Certificado</span>
            <input
              type="file"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>   
          <div className="relative">
            <span className="absolute left-8 top-1/2 text-gray-200 -translate-y-1/2 text-4xl"><IoArrowUpCircleOutline/></span>
          <button
            className="bg-indigo-500 ring-2 ring-black text-white py-3 px-16 m-5 rounded hover:bg-indigo-400 transition-all"
            onClick={enviarCertificado}
          >
            Enviar Certificado
          </button>
          </div>
        </div>
      </main>
      <div className="relative">
            <span className="absolute translate-x-8 top-1/2 text-gray-200 -translate-y-1/2 text-4xl"><BsFiletypeDoc/></span>
          <button
            className="bg-slate-500 ring-2 ring-black text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-400 transition-all"
            onClick={emitirNFe}
          >
            Emitir NF-e
          </button>
        </div>
      {arquivo && (
            <p className="text-sm text-gray-500 m-5">
              Arquivo selecionado: <span className="font-semibold">{arquivo.name}</span>
            </p>
          )}
    </div>
  );
};
