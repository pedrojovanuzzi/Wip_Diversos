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
import { PiPrinter } from "react-icons/pi";

export const Nfe = () => {
  const [dadosNFe, setDadosNFe] = useState({});
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [searchCpf, setSearchCpf] = useState<string>("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [clientesSelecionados, setClientesSelecionados] = useState<number[]>(
    []
  );
  const [dateFilter, setDateFilter] = useState<{
    start: string;
    end: string;
  } | null>(null);
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
  const user = useTypedSelector((state: RootState) => state.auth.user);
  const token = user.token;

  const handleCheckboxChange = (clienteId: number) => {
    if (clientesSelecionados.includes(clienteId)) {
      setClientesSelecionados(
        clientesSelecionados.filter((id) => id !== clienteId)
      );
    } else {
      setClientesSelecionados([...clientesSelecionados, clienteId]);
    }
  };

  const handleSelectAll = () => {
    if (clientesSelecionados.length === clientes.length) {
      setClientesSelecionados([]);
    } else {
      setClientesSelecionados(clientes.map((cliente) => cliente.id));
    }
  };

  const emitirNFe = async () => {
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/`,
        { password, clientesSelecionados },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("NF-e emitida:", resposta.data);
      console.log(clientesSelecionados);

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
    const searchCpfRegex = searchCpf.replace(/\D/g, "");

    console.log("Buscando por:", searchCpfRegex, activeFilters);

    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/BuscarClientes`,
        {
          cpf: searchCpfRegex,
          filters: activeFilters,
          dateFilter: dateFilter,
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
      <Filter setActiveFilters={setActiveFilters} setDate={setDateFilter} />
      {clientes.length > 0 && (
        <h1 className="text-center mt-5 self-center text-2xl font-semibold text-gray-900">
          Total de Faturas:{" "}{clientes.length}
        </h1>
      )}
      {clientes.length > 0 ? (
        <div className="mt-10 px-4 sm:px-6 lg:px-8">
          <div className="overflow-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y bg-gray-50 divide-gray-300 ">
              <thead className="bg-gray-50 w-full text-center">
                <th className="px-4 py-4">
                  <input className="cursor-pointer"
                    type="checkbox"
                    checked={clientesSelecionados.length === clientes.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  ></th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    Titulo
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    Login
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    Vencimento
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    Tipo
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    Valor
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {clientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        checked={clientesSelecionados.includes(cliente.id)}
                        onChange={() => handleCheckboxChange(cliente.id)}
                      />
                    </td>
                    <td
                      key={cliente.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {cliente.fatura.titulo}
                    </td>
                    <td
                      key={cliente.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {cliente.login}
                    </td>
                    <td
                      key={cliente.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                    >
                      {cliente.fatura.datavenc}
                    </td>
                    <td
                      key={cliente.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                    >
                      {cliente.fatura.tipo}
                    </td>
                    <td
                      key={cliente.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                    >
                      {cliente.fatura.valor}
                    </td>
                    <td
                      key={cliente.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                    >
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
          <label className="relative ring-1 ring-black ring-opacity-5 bg-slate-500 text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-400 transition-all cursor-pointer">
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
              className="bg-indigo-500 ring-1 ring-black ring-opacity-5 text-white py-3 px-16 m-5 rounded hover:bg-indigo-400 transition-all"
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
          className="bg-slate-500 ring-1 ring-black ring-opacity-5 text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-400 transition-all"
          onClick={() => setShowPopUp(true)}
        >
          Emitir NF-e
        </button>
        <span className="absolute translate-x-8 top-1/2 text-gray-200 -translate-y-1/2 text-4xl">
          <PiPrinter />
        </span>
        <button
          className="bg-slate-500 ring-1 ring-black ring-opacity-5 text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-400 transition-all"
          onClick={() => setShowPopUp(true)}
        >
          Imprimir Nota
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
