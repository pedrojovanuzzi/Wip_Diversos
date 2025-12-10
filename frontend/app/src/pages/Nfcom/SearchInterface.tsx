import React, { useEffect, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { CiSearch } from "react-icons/ci";
import { BiCalendar, BiUser, BiReceipt } from "react-icons/bi";
import { useAuth } from "../../context/AuthContext";
import PopUpCancelNFCom from "./Components/PopUpCancelNFCom";
import { GoNumber } from "react-icons/go";
import { VscSymbolBoolean } from "react-icons/vsc";
import { MdMergeType, MdOutlineConfirmationNumber } from "react-icons/md";
import { useNotification } from "../../context/NotificationContext";
import { FaFileSignature } from "react-icons/fa";

import SelectAllPopUp from "./Components/SelectAllPopUp";
import { Pagination } from "@mui/material";
import { AiOutlineUser } from "react-icons/ai";
import saveAs from "file-saver";
import { BsDownload } from "react-icons/bs";

interface NFComResult {
  // Dados primários
  id: number;
  fatura_id: number;
  // Dados da NFCom
  chave: string;
  nNF: string;
  serie: string;
  value: string;
  numeracao: number;
  // Dados do Cliente/Serviço
  cliente_id: number;
  pppoe: string;
  // Datas e Status
  data_emissao: string;
  status: "autorizada" | "rejeitada" | "pendente" | string;
  tpAmb: number;
  // Informações de Consulta e Protocolo
  protocolo: string;
  qrcodeLink: string;
  xml: string;
}

export default function SearchInterface() {
  const [pppoe, setPppoe] = useState<string>("");
  const [titulo, setTitulo] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [nfcomList, setNfcomList] = useState<NFComResult[]>([]);
  // const [pdfList, setPdfList] = useState<string[]>([]); // Unused
  const [loading, setLoading] = useState(false);
  const [tpAmb, settpAmb] = useState<number>(1); // Fixed default to number
  const [showPopUp, setShowPopUp] = useState(false);
  const [password, setPassword] = useState<string>("");
  const [selectedNfcom, setSelectedNfcom] = useState<NFComResult | null>(null);
  const [serie, setSerie] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSelectAllMode, setIsSelectAllMode] = useState<boolean>(false);
  const [excludedIds, setExcludedIds] = useState<number[]>([]);
  const [selectAllPopUp, setSelectAllPopUp] = useState<boolean>(false);
  const [chaveDeOlhoNoImposto, setChaveDeOlhoNoImposto] = useState<string>("");
  const [pagination, setPagination] = useState({
    page: 1,
    take: 50,
    totalPages: 0,
  });
  const [cpf_cnpj, setCpfCnpj] = useState<string>("");
  const [clientType, setClientType] = useState<"SVA" | "SCM" | "" | string>("");
  let [value, setValue] = useState<number>(0);

  const { user } = useAuth();
  const token = user?.token;
  const { addJob, showError, showSuccess } = useNotification();

  const createXmlDownloadUrl = (xmlContent: string): string => {
    const blob = new Blob([xmlContent], { type: "text/xml" });
    return URL.createObjectURL(blob);
  };

  const cancelarNFCom = async (
    nnf: string,
    pppoe: string,
    password: string,
    ambiente: number
  ) => {
    try {
      setLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFCom/cancelarNFCom`,
        {
          nNF: nnf,
          pppoe: pppoe,
          password: password,
          tpAmb: ambiente,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Resposta da API:", response.data);
      addJob(response.data.id, "cancelamento");
      showSuccess(
        "Solicitação de cancelamento enviada! Processando em segundo plano."
      );
      setShowPopUp(false);
      setLoading(false);
    } catch (error) {
      console.error("Erro ao cancelar NFCom:", error);
      showError(
        "Erro ao cancelar NFCom. Verifique os dados e tente novamente."
      );
      setLoading(false);
      setShowPopUp(false);
    }
  };

  function handleCancelar(cliente: any): void {
    setSelectedNfcom(cliente);
    setShowPopUp(true);
  }

  const downloadZipXMLs = async () => {
    try {
      setLoading(true);
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/NFCom/downloadZipXMLs`,
        {
          nfcomIds: selectedIds,
        },
        {
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const blob = new Blob([resposta.data], { type: "application/zip" });
      saveAs(blob, "notas_exportadas.zip");
      console.log("Resposta da API:", resposta.data);
      showSuccess("XMLs baixados com sucesso!");
    } catch (erro) {
      console.error("Erro ao baixar XMLs:", erro);
      showError("Erro desconhecido ao baixar XMLs.");
    } finally {
      setLoading(false);
    }
  };

  const confirmCancellation = async () => {
    if (selectedNfcom) {
      await cancelarNFCom(
        selectedNfcom.nNF,
        selectedNfcom.pppoe,
        password,
        selectedNfcom.tpAmb
      );
      setSelectedNfcom(null);
      setShowPopUp(false);
    } else if (selectedIds.length > 0) {
      setLoading(true);
      setShowPopUp(false);

      let idsToSend = selectedIds;
      if (isSelectAllMode && excludedIds.length > 0) {
        idsToSend = selectedIds.filter((id) => !excludedIds.includes(id));
      }

      try {
        const response = await axios.post(
          `${process.env.REACT_APP_URL}/NFCom/cancelarNFCom`,
          {
            nNF: idsToSend,
            password: password,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              timeout: 3600000,
            },
          }
        );
        console.log("Resposta da API:", response.data);
        addJob(response.data.id, "cancelamento");
        showSuccess(
          "Solicitação de cancelamento em lote enviada! Processando em segundo plano."
        );
      } catch (error) {
        console.error(`Erro ao cancelar NFCom ${selectedIds}:`, error);
        showError(
          "Erro ao cancelar NFCom. Verifique os dados e tente novamente."
        );
      }
      setLoading(false);
      setSelectedIds([]);
      setExcludedIds([]);
      setIsSelectAllMode(false);
    }
  };

  const generateReportPdf = async () => {
    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.write("Aguarde, gerando relatório...");
    }

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFCom/generateReportPdf`,
        {
          nNF: selectedIds,
          dataInicio: new Date(dataInicio || new Date()).toLocaleDateString(
            "pt-BR",
            {
              timeZone: "America/Sao_Paulo",
            }
          ),
          dataFim: new Date(dataFim || new Date()).toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          }),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          responseType: "blob",
        }
      );

      const file = new Blob([response.data], { type: "application/pdf" });
      const fileURL = URL.createObjectURL(file);

      if (newWindow) {
        newWindow.location.href = fileURL;
      } else {
        window.open(fileURL, "_blank");
      }

      showSuccess("Relatório gerado com sucesso!");
      setLoading(false);
      setSelectedIds([]);
    } catch (error) {
      console.error(`Erro ao gerar relatório:`, error);
      if (newWindow) newWindow.close();
      showError("Erro ao gerar relatório.");
      setLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectAllPopUp(true);
      setSelectedIds(nfcomList.map((n) => n.numeracao));
    } else {
      setSelectedIds([]);
      setExcludedIds([]);
      setIsSelectAllMode(false);
      setSelectAllPopUp(false);
    }
  };

  // Função para gerar PDF diretamente sem popup
  const handleOpenPdfPopUp = async (nfcom: NFComResult) => {
    try {
      const newWindow = window.open("", "_blank");
      // Optional: Give user feedback in the new tab
      if (newWindow) newWindow.document.write("Gerando PDF...");

      setLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFCom/generatePdfFromNfXML`,
        {
          nNF: nfcom.nNF,
          obs: chaveDeOlhoNoImposto,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          responseType: "blob",
        }
      );
      const file = new Blob([response.data], { type: "application/pdf" });
      const fileURL = URL.createObjectURL(file);
      if (newWindow) {
        newWindow.location.href = fileURL;
      } else {
        window.open(fileURL, "_blank");
      }
      showSuccess("PDF gerado com sucesso!");
      setLoading(false);
    } catch (error) {
      console.error(`Erro ao gerar PDF:`, error);
      showError("Erro ao gerar PDF.");
      setLoading(false);
    }
  };

  const handleSelectOne = (number: number) => {
    if (isSelectAllMode) {
      setExcludedIds((prev) => {
        const newExcluded = prev.includes(number)
          ? prev.filter((i) => i !== number)
          : [...prev, number];

        if (newExcluded.length === selectedIds.length) {
          setIsSelectAllMode(false);
          setSelectedIds([]);
          return [];
        }

        return newExcluded;
      });
    } else {
      setSelectedIds((prev) =>
        prev.includes(number)
          ? prev.filter((i) => i !== number)
          : [...prev, number]
      );
    }
  };

  const handleBulkCancel = () => {
    if (selectedIds.length === 0) return;
    setSelectedNfcom(null);
    setShowPopUp(true);
  };

  const handleSearch = async (pageOverride?: number | any) => {
    try {
      setLoading(true);

      const pageToUse =
        typeof pageOverride === "number" ? pageOverride : pagination.page;
      const paginationToSend = { ...pagination, page: pageToUse };

      const searchParams: any = {};
      if (pppoe.trim()) searchParams.pppoe = pppoe.trim();
      if (titulo.trim()) searchParams.titulo = titulo.trim();
      if (dataInicio.trim()) searchParams.dataInicio = dataInicio.trim();
      if (dataFim.trim()) searchParams.dataFim = dataFim.trim();
      if (tpAmb) searchParams.tpAmb = tpAmb;
      if (serie.trim()) searchParams.serie = serie.trim();
      if (status.trim()) searchParams.status = status.trim();
      if (cpf_cnpj.trim()) searchParams.cpf_cnpj = cpf_cnpj.trim();
      if (clientType.trim()) searchParams.clientType = clientType.trim();

      console.log(searchParams);

      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfcom/buscarNFCom`,
        { searchParams: searchParams, pagination: paginationToSend },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setNfcomList(resposta.data);
      setSelectedIds([]);
      handlePages();
      console.log(resposta.data);
    } catch (erro) {
      console.error("Erro ao buscar NFCom:", erro);
      if (axios.isAxiosError(erro) && erro.response) {
        showError(
          `Erro ao buscar NFCom: ${
            erro.response.data.erro || "Erro desconhecido."
          }`
        );
      } else {
        showError("Erro de rede. Verifique sua conexão e tente novamente.");
      }
      setNfcomList([]);
    } finally {
      setLoading(false);
    }
  };

  const changePage = (page: number) => {
    setPagination({ ...pagination, page });
    handleSearch(page);
  };

  const handlePages = async () => {
    try {
      const searchParams: any = {};
      if (pppoe.trim()) searchParams.pppoe = pppoe.trim();
      if (titulo.trim()) searchParams.titulo = titulo.trim();
      if (dataInicio.trim()) searchParams.dataInicio = dataInicio.trim();
      if (dataFim.trim()) searchParams.dataFim = dataFim.trim();
      if (tpAmb) searchParams.tpAmb = tpAmb;
      if (serie.trim()) searchParams.serie = serie.trim();
      if (status.trim()) searchParams.status = status.trim();
      if (cpf_cnpj.trim()) searchParams.cpf_cnpj = cpf_cnpj.trim();
      if (clientType.trim()) searchParams.clientType = clientType.trim();

      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Nfcom/NfComPages`,
        { searchParams: searchParams },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      setPagination((prev) => ({ ...prev, totalPages: Number(response.data) }));
      console.log(response.data);
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar NFCom:", error);
      if (axios.isAxiosError(error) && error.response) {
        showError(
          `Erro ao buscar NFCom: ${
            error.response.data.erro || "Erro desconhecido."
          }`
        );
      } else {
        showError("Erro de rede. Verifique sua conexão e tente novamente.");
      }
      return [];
    }
  };

  useEffect(() => {
    const exec = async () => {
      const searchParams: any = {};
      if (pppoe.trim()) searchParams.pppoe = pppoe.trim();
      if (titulo.trim()) searchParams.titulo = titulo.trim();
      if (dataInicio.trim()) searchParams.dataInicio = dataInicio.trim();
      if (dataFim.trim()) searchParams.dataFim = dataFim.trim();
      if (tpAmb) searchParams.tpAmb = tpAmb;
      if (serie.trim()) searchParams.serie = serie.trim();
      if (status.trim()) searchParams.status = status.trim();
      if (cpf_cnpj.trim()) searchParams.cpf_cnpj = cpf_cnpj.trim();
      if (clientType.trim()) searchParams.clientType = clientType.trim();

      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Nfcom/buscarNFComAll`,
        {
          searchParams: searchParams,
          pagination: pagination,
          excludedIds: excludedIds,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log(response.data);
      setSelectedIds(
        response.data.map((item: { numeracao: any }) => item.numeracao)
      );
    };

    if (isSelectAllMode) {
      exec();
    }
  }, [isSelectAllMode]);

  const handleClear = () => {
    setPppoe("");
    setTitulo("");
    setDataInicio("");
    setDataFim("");
    setNfcomList([]);
    setSelectedIds([]);
    setIsSelectAllMode(false);
    setShowPopUp(false);
    setExcludedIds([]);
    setSelectAllPopUp(false);
    setLoading(false);
  };

  useEffect(() => {
    const exec = async () => {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/NFCom/getNfcomByChaveDeOlhoNoImposto`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      setChaveDeOlhoNoImposto(response.data.Chave);
    };
    exec();
  }, []);

  return (
    <div>
      <NavBar />

      {/* Header Section */}
      <div className="min-h-full">
        <div className="sm:bg-blue-700 bg-blue-900 pb-32">
          <header className="py-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Buscar NFCom Geradas
              </h1>
              <p className="mt-2 text-sm text-blue-100">
                Busque notas fiscais NFCom já geradas e homologadas
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
                {/* Inputs ... (Code omitted for brevity, logic unchanged) */}
                {/* Campo PPPOE */}
                <div className="relative">
                  <label
                    htmlFor="pppoe"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    PPPOE (Login)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <BiUser />
                    </span>
                    <input
                      id="pppoe"
                      type="text"
                      value={pppoe}
                      onChange={(e) => setPppoe(e.target.value)}
                      placeholder="Ex: cliente@pppoe"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Campo Número do Título */}
                <div className="relative">
                  <label
                    htmlFor="titulo"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Número do Título
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <BiReceipt />
                    </span>
                    <input
                      id="titulo"
                      type="text"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex: 12345"
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

                <div className="relative">
                  <label
                    htmlFor="tpAmb"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Ambiente
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <VscSymbolBoolean />
                    </span>
                    <input
                      id="tpAmb"
                      type="number"
                      min={0}
                      max={2}
                      value={tpAmb}
                      onChange={(e) => settpAmb(Number(e.target.value))}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label
                    htmlFor="serie"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Série
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <GoNumber />
                    </span>
                    <input
                      id="serie"
                      type="number"
                      placeholder="Ex: 3"
                      value={serie}
                      onChange={(e) => setSerie(String(e.target.value))}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label
                    htmlFor="status"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Status
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <MdOutlineConfirmationNumber />
                    </span>
                    <select
                      id="status"
                      value={status}
                      onChange={(e) => setStatus(String(e.target.value))}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione</option>
                      <option value="autorizada">Autorizada</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <label
                    htmlFor="cpf_cnpj"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    CPF/CNPJ
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <AiOutlineUser />
                    </span>
                    <input
                      id="cpf_cnpj"
                      type="text"
                      placeholder="CPF/CNPJ"
                      value={cpf_cnpj}
                      onChange={(e) => setCpfCnpj(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label
                    htmlFor="clientType"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Tipo de Cliente
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <MdMergeType />
                    </span>
                    <select
                      id="clientType"
                      value={clientType}
                      onChange={(e) => setClientType(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione</option>
                      <option value="SVA">SVA</option>
                      <option value="SCM">SCM</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3">
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
                <button
                  onClick={generateReportPdf}
                  disabled={loading}
                  className="px-5 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-700 transition-all font-medium flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <FaFileSignature className="text-xl" />
                  {loading ? "Gerando..." : "Gerar Relatorio"}
                </button>
              </div>

              {/* Botão de Cancelamento em Lote */}
              {selectedIds.length - (isSelectAllMode ? excludedIds.length : 0) >
                0 && (
                <div className="mt-4 flex gap-5 justify-end">
                  <button
                    onClick={handleBulkCancel}
                    className="px-5 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all font-medium flex items-center gap-2"
                  >
                    Cancelar Selecionadas (
                    {selectedIds.length -
                      (isSelectAllMode ? excludedIds.length : 0)}
                    )
                  </button>
                  <button
                    onClick={downloadZipXMLs}
                    disabled={loading}
                    className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all font-medium flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <BsDownload className="text-xl" />
                    {loading ? "Baixar XMLs..." : "Baixar XMLs"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <PopUpCancelNFCom
            setShowPopUp={setShowPopUp}
            showPopUp={showPopUp}
            setPassword={setPassword}
            password={password}
            cancelNFCom={confirmCancellation}
          />

          <SelectAllPopUp
            showPopUp={selectAllPopUp}
            setShowPopUp={setSelectAllPopUp}
            selectedIds={selectedIds}
            setIsSelectAllMode={setIsSelectAllMode}
          />

          {/* Results Table */}
          {nfcomList.length > 0 && (
            <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
              <h2 className="text-center mt-4 mb-4 text-2xl font-semibold text-gray-900">
                Resultados: {nfcomList.length} NFCom(s)
              </h2>
              <div className="overflow-auto max-h-[40vh] rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          onChange={handleSelectAll}
                          checked={
                            isSelectAllMode ||
                            (nfcomList.length > 0 &&
                              selectedIds.length === nfcomList.length)
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produção/Homologação
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Número
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Titulo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Série
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        PPPOE
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data Emissão
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Chave
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nota Fiscal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Download XML
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      {/* Empty Headers for Action Buttons */}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {nfcomList.map((nfcom) => (
                      <tr key={nfcom.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isSelectAllMode ? (
                            <input
                              type="checkbox"
                              checked={
                                !excludedIds.includes(Number(nfcom.numeracao))
                              }
                              onChange={() =>
                                handleSelectOne(Number(nfcom.numeracao))
                              }
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(
                                Number(nfcom.numeracao)
                              )}
                              onChange={() =>
                                handleSelectOne(Number(nfcom.numeracao))
                              }
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {nfcom.tpAmb === 1 ? "Produção" : "Homologação"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {nfcom.numeracao}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {nfcom.fatura_id}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-500">
                          {nfcom.serie}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-900">
                          {nfcom.cliente_id}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-500">
                          {nfcom.pppoe}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-500">
                          {nfcom.data_emissao}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-900">
                          {nfcom.chave}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-900">
                          <a
                            href={nfcom.qrcodeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Ver Nota Fiscal
                          </a>
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-900">
                          {nfcom.value}
                        </td>
                        <td className="px-6 py-4 text-left hidden whitespace-nowrap text-sm text-gray-900">
                          {(value += Number(nfcom.value))}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-900">
                          <a
                            href={createXmlDownloadUrl(nfcom.xml)}
                            download={`nfcom_${nfcom.nNF}_${nfcom.serie}.xml`}
                            className="text-indigo-600 hover:text-indigo-900 font-medium underline"
                          >
                            Baixar XML ({nfcom.nNF})
                          </a>
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              nfcom.status === "autorizada"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {nfcom.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap">
                          <button
                            onClick={() => handleCancelar(nfcom)}
                            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-all"
                          >
                            Cancelar
                          </button>
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap">
                          <button
                            onClick={() => handleOpenPdfPopUp(nfcom)}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-all"
                          >
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between mt-2">
                {(pagination.totalPages > 1 && (
                  <>
                    <h1>Pagina: {pagination.page}</h1>
                    <h1>
                      Valor total das faturas:{" "}
                      <span className="font-bold text-green-600">
                        R$ {value.toFixed(2)}
                      </span>
                    </h1>
                    <Pagination
                      count={pagination.totalPages}
                      page={pagination.page}
                      onChange={(event, value) => changePage(value)}
                    />
                  </>
                )) || (
                  <h1>
                    Valor total das faturas:{" "}
                    <span className="font-bold text-green-600">
                      R$ {value.toFixed(2)}
                    </span>
                  </h1>
                )}
              </div>
            </div>
          )}

          {!loading && nfcomList.length === 0 && (
            <p className="text-center mt-10 text-gray-500">
              Use os filtros acima para buscar NFCom geradas e homologadas
            </p>
          )}

          {/* Removed the raw <div> PopUp that was here causing errors */}
        </main>
      </div>
    </div>
  );
}
