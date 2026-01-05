import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import Filter from "./Components/Filter";
import { CiNoWaitingSign, CiSearch, CiCirclePlus } from "react-icons/ci";
import { BsFiletypeDoc } from "react-icons/bs";
import { BiCalendar, BiUser } from "react-icons/bi";
import { IoArrowUpCircleOutline } from "react-icons/io5";

import PopUpCancelNFSE from "./Components/PopUpCancelNFSE";
import PDFNFSE from "./Components/PDFNFSE";
import { useReactToPrint } from "react-to-print";
import Success from "./Components/Success";
import Error from "./Components/Error";
import SetPassword from "./Components/SetPassword";
import { useAuth } from "../../context/AuthContext";

import { useNotification } from "../../context/NotificationContext";

export const BuscarNfeGerada = () => {
  const [dadosNFe, setDadosNFe] = useState({});
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [ambiente, setAmbiente] = useState<string>("homologacao");
  const [showCertPasswordPopUp, setShowCertPasswordPopUp] = useState(false);
  const [certPassword, setCertPassword] = useState<string>("");
  const [searchCpf, setSearchCpf] = useState<string>("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");
  const [pdfDados, setPdfDados] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const componentRef = React.useRef(null);
  const reactToPrintContent = () => {
    return componentRef.current;
  };

  const [clientesSelecionados, setClientesSelecionados] = useState<number[]>(
    []
  );
  const [dateFilter, setDateFilter] = useState<{
    start: string;
    end: string;
  } | null>(null);

  // States for individual date inputs to match SearchInterface style
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [activeFilters, setActiveFilters] = useState<{
    plano: string[];
    vencimento: string[];
    cli_ativado: string[];
    nova_nfe: string[];
    servicos: string[];
  }>({
    plano: [],
    vencimento: [],
    cli_ativado: [],
    nova_nfe: [],
    servicos: [],
  });
  const [showCancelPopUp, setShowCancelPopUp] = useState(false);
  const [showPasswordPopUp, setShowPasswordPopUp] = useState(false);
  const [password, setPassword] = useState<string>("");

  const [loading, setLoading] = useState(false);

  const { user } = useAuth();
  const token = user?.token;
  const { addJob, showError, showSuccess } = useNotification();

  // Update dateFilter object when individual inputs change
  useEffect(() => {
    if (dataInicio || dataFim) {
      setDateFilter({
        start: dataInicio,
        end: dataFim,
      });
    } else {
      setDateFilter(null);
    }
  }, [dataInicio, dataFim]);

  const handleCheckboxChange = (clienteId: number) => {
    setClientesSelecionados((prevSelecionados) => {
      if (prevSelecionados.includes(clienteId)) {
        return prevSelecionados.filter((id) => id !== clienteId);
      } else {
        return [...prevSelecionados, clienteId];
      }
    });
  };

  const handleSelectAll = () => {
    if (clientesSelecionados.length === clientes.length) {
      setClientesSelecionados([]);
    } else {
      const idsValidos = clientes
        .filter((cliente) => cliente.nfse && cliente.nfse.id)
        .map((cliente) => cliente.nfse.id);

      setClientesSelecionados(idsValidos);
    }
  };

  const imprimir = async (reactToPrintContent: any) => {
    try {
      setLoading(true);
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/imprimirNFSE`,
        {
          id: clientesSelecionados,
          ambiente: ambiente || "homologacao",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Notas Canceladas:", resposta.data);

      const dados = resposta.data;
      setPdfDados(dados);

      setTimeout(() => {
        handlePrint && handlePrint(reactToPrintContent);
      }, 0);

      setClientesSelecionados([]);
      setLoading(false);
    } catch (erro) {
      console.error("Erro ao Buscar Clientes:", erro);
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    documentTitle: "NFSE",
  });

  const setSessionPassword = async () => {
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/setSessionPassword`,
        {
          password: password,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      setSuccess("Senha atualizada");
      handleSearch();
    } catch (erro) {
      console.error(erro);
    } finally {
      setShowPasswordPopUp(false);
    }
  };

  const cancelNFSE = async () => {
    try {
      setLoading(true);
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/cancelarNfse`,
        {
          id: clientesSelecionados,
          password: password,
          ambiente: ambiente || "homologacao",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Notas Canceladas:", resposta.data);

      if (resposta.data.job) {
        addJob(resposta.data.job, "cancelamento");
        showSuccess(
          "Solicitação de cancelamento enviada! Processando em segundo plano."
        );
      } else {
        showSuccess("Notas Canceladas com Sucesso!");
        window.location.reload();
      }
    } catch (erro) {
      showError("Erro ao Cancelar Notas!");
      console.error("Erro ao Buscar Clientes:", erro);
    } finally {
      setShowCancelPopUp(false);
      setLoading(false);
    }
  };

  const handleEnviarCertificado = () => {
    if (!arquivo) {
      alert("Selecione um arquivo para enviar.");
      return;
    }
    setShowCertPasswordPopUp(true);
  };

  const enviarCertificado = async () => {
    if (!arquivo || !certPassword) {
      alert("É necessário arquivo e senha.");
      return;
    }
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("certificado", arquivo);
      formData.append("password", certPassword);

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
      setSuccess("Certificado enviado com sucesso!");
      setShowCertPasswordPopUp(false);
      setCertPassword("");
      setArquivo(null);
    } catch (erro) {
      console.error("Erro ao enviar o certificado:", erro);
      setError("Não foi possível enviar o certificado.");
      setShowCertPasswordPopUp(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    const searchCpfRegex = searchCpf.replace(/\D/g, "");

    console.log("Buscando por:", searchCpfRegex, activeFilters);
    setLoading(true);

    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/BuscarNSFE`,
        {
          cpf: searchCpfRegex,
          filters: activeFilters,
          dateFilter: dateFilter,
          ambiente: ambiente || "homologacao",
          status: status || null,
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
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearchCpf("");
    setDataInicio("");
    setDataFim("");
    setClientes([]);
    setClientesSelecionados([]);
    setArquivo(null);
  };

  useEffect(() => {
    // handleSearch();
    setShowPasswordPopUp(true);
  }, []);

  return (
    <div>
      <NavBar />

      {/* Header Section */}
      <div className="min-h-full">
        <div className="sm:bg-green-700 bg-green-900 pb-32">
          <header className="py-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Buscar NFS-e Geradas
              </h1>
              <p className="mt-2 text-sm text-blue-100">
                Busque notas fiscais de serviço (NFS-e) geradas
              </p>
            </div>
          </header>
        </div>

        {/* Search Form */}
        <main className="-mt-32">
          <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
              <div className="flex items-center mb-4">
                <CiSearch className="text-gray-600 text-2xl mr-2" />
                <h2 className="text-xl font-semibold text-gray-800">
                  Busca Avançada
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Campo CPF */}
                <div className="relative">
                  <label
                    htmlFor="cpf"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    CPF/CNPJ
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <BiUser />
                    </span>
                    <input
                      id="cpf"
                      type="text"
                      value={searchCpf}
                      onChange={(e) => setSearchCpf(e.target.value)}
                      placeholder="Ex: 000.000.000-00"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Campo Data Inicial */}
                <div className="relative">
                  <label
                    htmlFor="dataInicio"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Data Inicial
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <BiCalendar />
                    </span>
                    <input
                      id="dataInicio"
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Campo Data Final */}
                <div className="relative">
                  <label
                    htmlFor="dataFim"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Data Final
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <BiCalendar />
                    </span>
                    <input
                      id="dataFim"
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Arquivo Certificado */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Certificado
                  </label>
                  <label className="flex items-center w-full px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 bg-white">
                    <CiCirclePlus className="mr-2 text-xl text-gray-500" />
                    <span className="text-gray-500 text-sm truncate">
                      {arquivo ? arquivo.name : "Selecionar PFX..."}
                    </span>
                    <input
                      type="file"
                      onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>
                {/* Ambiente */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ambiente
                  </label>
                  <select
                    value={ambiente}
                    onChange={(e) => setAmbiente(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="producao">Produção</option>
                    <option value="homologacao">Homologação</option>
                  </select>
                </div>
                {/* Status */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    <option value="Ativa">Ativa</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              {/* Botões de Ação do Form */}
              <div className="flex justify-end gap-3 flex-wrap">
                <button
                  className="bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-500 transition-all flex items-center gap-2"
                  onClick={() => setShowPasswordPopUp(true)}
                >
                  <IoArrowUpCircleOutline className="text-xl" />
                  Senha Certificado
                </button>
                <button
                  className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-500 transition-all flex items-center gap-2"
                  onClick={handleEnviarCertificado}
                  disabled={!arquivo}
                >
                  <IoArrowUpCircleOutline className="text-xl" />
                  Enviar Certificado
                </button>
                <button
                  onClick={handleClear}
                  className="px-5 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-all font-medium"
                >
                  Limpar
                </button>
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all font-medium flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <CiSearch className="text-xl" />
                  {loading ? "Buscando..." : "Buscar"}
                </button>
              </div>
            </div>

            {/* ERROR / SUCCESS MESSAGES */}
            {error && (
              <div className="mt-4">
                <Error message={error} />
              </div>
            )}
            {success && (
              <div className="mt-4">
                <Success message={success} />
              </div>
            )}

            {/* Tabela de Resultados */}
            {clientes.length > 0 && (
              <div className="mt-8 bg-white shadow-lg rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <h2 className="text-lg font-medium text-gray-900">
                    Resultados encontrados: {clientes.length}
                  </h2>
                  {/* Ações em Lote */}
                  <div className="flex gap-2">
                    <button
                      className="bg-slate-500 text-white py-2 px-4 rounded hover:bg-slate-400 transition-all flex items-center gap-2 text-sm"
                      onClick={() => {
                        imprimir(reactToPrintContent);
                      }}
                      disabled={
                        clientesSelecionados.length === 0 ||
                        clientesSelecionados.length >= 2
                      }
                    >
                      <BsFiletypeDoc />
                      Imprimir ({clientesSelecionados.length})
                    </button>
                    <button
                      className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-500 transition-all flex items-center gap-2 text-sm"
                      onClick={() => setShowCancelPopUp(true)}
                      disabled={clientesSelecionados.length === 0}
                    >
                      <CiNoWaitingSign />
                      Cancelar ({clientesSelecionados.length})
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto h-[calc(100vh-400px)]">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                        >
                          <input
                            type="checkbox"
                            className="cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={
                              clientes.length > 0 &&
                              clientesSelecionados.length === clientes.length
                            }
                            onChange={handleSelectAll}
                          />
                        </th>
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
                          Nº NFSE
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                        >
                          Login
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                        >
                          Competência
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                        >
                          Gerado
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                        >
                          Alíquota
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                        >
                          Valor
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
                      {clientes
                        .sort((a, b) => b.nfse.id - a.nfse.id)
                        .map((cliente) => (
                          <tr
                            key={cliente.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4 text-left text-sm text-gray-500">
                              <input
                                type="checkbox"
                                className="cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={clientesSelecionados.includes(
                                  cliente.nfse.id
                                )}
                                onChange={() =>
                                  handleCheckboxChange(cliente.nfse.id)
                                }
                              />
                            </td>
                            <td className="px-6 py-4 text-left text-sm text-gray-500">
                              {cliente.nfse.id}
                            </td>
                            <td className="px-6 py-4 text-left text-sm text-gray-900">
                              {cliente.nfse.numeroNfse}
                            </td>
                            <td className="px-6 py-4 text-left text-sm text-gray-500">
                              {cliente.login}
                            </td>
                            <td className="px-6 py-4 text-left text-sm text-gray-500">
                              {cliente.nfse.competencia}
                            </td>
                            <td className="px-6 py-4 text-left text-sm text-gray-500">
                              {new Date(
                                cliente.nfse.timestamp
                              ).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="px-6 py-4 text-left text-sm text-gray-500">
                              {cliente.nfse.aliquota}
                            </td>
                            <td className="px-6 py-4 text-left text-sm text-gray-500">
                              {cliente.nfse.valor_servico}
                            </td>
                            <td className="px-6 py-4 text-left text-sm">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                                  cliente.nfse.status === "Ativa"
                                    ? "bg-green-50 text-green-700 ring-green-600/20"
                                    : cliente.nfse.status === "Cancelada"
                                    ? "bg-red-50 text-red-700 ring-red-600/20"
                                    : "bg-yellow-50 text-yellow-800 ring-yellow-600/20"
                                }`}
                              >
                                {cliente.nfse.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {clientes.length === 0 && !loading && (
              <div className="text-center mt-10 text-gray-500 py-10">
                <p className="text-lg">Nenhum cliente encontrado</p>
                <p className="text-sm">Tente ajustar os filtros de busca</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {showCancelPopUp && (
        <PopUpCancelNFSE
          setShowPopUp={setShowCancelPopUp}
          showPopUp={showCancelPopUp}
          setPassword={setPassword}
          password={password}
          cancelNFSE={cancelNFSE}
        />
      )}

      {showPasswordPopUp && (
        <SetPassword
          setShowPopUp={setShowPasswordPopUp}
          showPopUp={showPasswordPopUp}
          setPassword={setPassword}
          password={password}
          setSessionPassword={setSessionPassword}
        />
      )}
      {showCertPasswordPopUp && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
          <div className="bg-white p-6 rounded-md shadow-lg">
            <h2 className="text-lg font-semibold">
              Digite a senha do Certificado:
            </h2>
            <input
              type="password"
              value={certPassword}
              onChange={(e) => setCertPassword(e.target.value)}
              className="block w-full border p-2 my-4 rounded"
              placeholder="Senha do PFX"
            />
            <div className="flex justify-end mt-4">
              <button
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded mr-2"
                onClick={() => {
                  setShowCertPasswordPopUp(false);
                  setCertPassword("");
                }}
              >
                Cancelar
              </button>
              <button
                className="bg-indigo-500 text-white px-4 py-2 rounded"
                onClick={enviarCertificado}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "none" }}>
        <PDFNFSE ref={componentRef} dados={pdfDados} />
      </div>
    </div>
  );
};
