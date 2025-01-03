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
import PopUpButton from "./Components/PopUpButton";

export const Nfe = () => {
  const [dadosNFe, setDadosNFe] = useState({});
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [searchCpf, setSearchCpf] = useState<string>("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [activeFilters, setActiveFilters] = useState<{
    plano: string[];
    vencimento: string[];
    cli_ativado: string[];
    nova_nfe: string[];
  }>({
    plano: [],
    vencimento: [],
    cli_ativado: [],
    nova_nfe: [],
  });
  const [showPopUp, setShowPopUp] = useState(false);
  const [password, setPassword] = useState<string>("");
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const { user } = useTypedSelector((state: RootState) => state.auth);
  const token = user.token;

  const emitirNFe = async () => {
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/`,
        { password },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("NF-e emitida:", resposta.data);
      setDadosNFe(resposta.data);
      setShowPopUp(false); // Fecha o PopUp ao concluir
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

  const handleSearch = async () => {
    console.log("Buscando por:", searchCpf, activeFilters);
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/BuscarClientes`,
        {
          cpf: searchCpf,
          filters: activeFilters,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Clientes encontrados:", resposta.data);
      setClientes(resposta.data); // Armazena os clientes no estado
    } catch (erro) {
      console.error("Erro ao Buscar Clientes:", erro);
    }
  };

  return (
    <div>
      <NavBar />
      <Stacked setSearchCpf={setSearchCpf} onSearch={handleSearch} />
      <Filter setActiveFilters={setActiveFilters} />
      {clientes.length > 0 ? (
        <div className="mt-10 px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                  >
                    ID
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                  >
                    Nome
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                  >
                    CPF/CNPJ
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                  >
                    Plano
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                  >
                    Vencimento
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {clientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cliente.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cliente.nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cliente.cpf_cnpj}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cliente.plano}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cliente.venc}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cliente.cli_ativado === "s" ? "Ativo" : "Inativo"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-center mt-10 text-gray-500">
          Nenhum cliente encontrado
        </p>
      )}

      <main className="flex justify-center mt-20">
        <div className="flex flex-col sm:flex-row items-center">
          <label className="relative ring-2 ring-black ring-opacity-5 bg-slate-500 text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-400 transition-all cursor-pointer">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-4xl">
              <CiCirclePlus />
            </span>
            <span>Adicionar Novo Certificado</span>
            <input
              type="file"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
          <div className="relative">
            <span className="absolute left-8 top-1/2 text-gray-200 -translate-y-1/2 text-4xl">
              <IoArrowUpCircleOutline />
            </span>
            <button
              className="bg-indigo-500 ring-2 ring-black ring-opacity-5 text-white py-3 px-16 m-5 rounded hover:bg-indigo-400 transition-all"
              onClick={enviarCertificado}
            >
              Enviar Certificado
            </button>
          </div>
        </div>
      </main>
      <div className="relative">
        <span className="absolute translate-x-8 top-1/2 text-gray-200 -translate-y-1/2 text-4xl">
          <BsFiletypeDoc />
        </span>
        <button
          className="bg-slate-500 ring-2 ring-black ring-opacity-5 text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-400 transition-all"
          onClick={() => setShowPopUp(true)}
        >
          Emitir NF-e
        </button>
      </div>
      {arquivo && (
        <p className="text-sm text-gray-500 m-5">
          Arquivo selecionado:{" "}
          <span className="font-semibold">{arquivo.name}</span>
        </p>
      )}
      {showPopUp && (
        <PopUpButton
          setShowPopUp={setShowPopUp}
          showPopUp={showPopUp}
          setPassword={setPassword}
          password={password}
          emitirNFe={emitirNFe}
        />
      )}
    </div>
  );
};
