import React, { useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { CiSearch } from "react-icons/ci";

import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";

export const BuscarNfe = () => {
  const [searchCpf, setSearchCpf] = useState<string>("");
  const [searchSerie, setSearchSerie] = useState<string>("");
  const [nfes, setNfes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ambiente, setAmbiente] = useState<string>("homologacao");
  const [status, setStatus] = useState<string>(""); // autorizado, cancelado, etc.
  const [tipoOperacao, setTipoOperacao] = useState<string>(""); // entrada_comodato, saida_comodato
  const [equipamentoPerdidoFilter, setEquipamentoPerdidoFilter] =
    useState<string>(""); // "", "sim", "nao"
  const [dateFilter, setDateFilter] = useState<{
    start: string;
    end: string;
  } | null>(null);

  // Pagination & Selection State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  const { user } = useAuth();
  const token = user?.token;
  const { showError, showSuccess } = useNotification();

  // Cancel State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelPassword, setCancelPassword] = useState("");
  const [cancelJustificativa, setCancelJustificativa] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchNfes = async (pageToFetch: number) => {
    setLoading(true);
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/buscarGeradas`,
        {
          cpf: searchCpf,
          serie: searchSerie,
          dateFilter: dateFilter,
          status: status,
          ambiente: ambiente,
          tipo_operacao: tipoOperacao,
          equipamentoPerdido: equipamentoPerdidoFilter,
          page: pageToFetch,
          limit: limit,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      setNfes(resposta.data.data);
      setTotalPages(resposta.data.totalPages);
      setTotalCount(resposta.data.total);
      setPage(pageToFetch);
    } catch (erro) {
      console.error("Erro ao buscar NFEs:", erro);
      showError("Erro ao buscar NFEs.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    // New search: reset pagination and selection
    setSelectedIds([]);
    setSelectAllMatching(false);
    await fetchNfes(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchNfes(newPage);
    }
  };

  // Carregar ao entrar (opcional, pode ser pesado se não tiver filtro)
  // useEffect(() => {
  //   handleSearch();
  // }, []);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Function to download XML
  const handleDownloadXml = async (chave: string) => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/NFEletronica/xml/${chave}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: "blob", // Important for file download
        },
      );

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${chave}-nfe.xml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (erro) {
      console.error("Erro ao baixar XML:", erro);
      showError("Erro ao baixar o XML.");
    }
  };

  const handleDownloadPdf = async (id: number, nNF: string) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/generateDanfe`,
        { id },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `nfe_${nNF}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Erro ao baixar PDF:", error);
      showError("Erro ao baixar PDF.");
    }
  };

  const handleOpenCancelModal = () => {
    if (selectedIds.length === 0 && !selectAllMatching) {
      showError("Selecione pelo menos uma NFe para cancelar.");
      return;
    }
    setShowCancelModal(true);
  };

  const handleCancelNfes = async () => {
    if (!cancelPassword) {
      showError("A senha do certificado é obrigatória.");
      return;
    }

    if (cancelJustificativa.length < 15) {
      showError("A justificativa deve ter no mínimo 15 caracteres.");
      return;
    }

    setCancelLoading(true);
    try {
      const payload = {
        password: cancelPassword,
        justificativa: cancelJustificativa,
        id: selectAllMatching ? undefined : selectedIds,
        cpf: selectAllMatching ? searchCpf : undefined,
        serie: selectAllMatching ? searchSerie : undefined,
        status: selectAllMatching ? status : undefined,
        ambiente: selectAllMatching ? ambiente : undefined,
        tipo_operacao: selectAllMatching ? tipoOperacao : undefined,
        equipamentoPerdido: selectAllMatching
          ? equipamentoPerdidoFilter
          : undefined,
        dateFilter: selectAllMatching ? dateFilter : undefined,
      };

      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/cancelarNotas`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      showSuccess(response.data.message || "Solicitação processada.");
      setShowCancelModal(false);
      setCancelPassword("");
      setCancelJustificativa("");
      clearSelection();
      fetchNfes(1); // Refresh the list
    } catch (error: any) {
      console.error("Erro ao cancelar NFEs:", error);
      showError(
        error.response?.data?.message || "Erro ao solicitar cancelamento.",
      );
    } finally {
      setCancelLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/generateReportPdf`,
        {
          // If selecting all matching, send filters. Otherwise send IDs.
          id: selectAllMatching
            ? undefined
            : selectedIds.length > 0
              ? selectedIds
              : undefined,
          tipo_operacao: tipoOperacao, // Always send for filtering if needed
          // Full filters for "Select All Matching"
          cpf: selectAllMatching ? searchCpf : undefined,
          serie: selectAllMatching ? searchSerie : undefined,
          status: selectAllMatching ? status : undefined,
          ambiente: selectAllMatching ? ambiente : undefined,
          dateFilter: dateFilter,

          dataInicio: dateFilter?.start
            ? new Date(dateFilter.start).toLocaleDateString("pt-BR")
            : undefined,
          dataFim: dateFilter?.end
            ? new Date(dateFilter.end).toLocaleDateString("pt-BR")
            : undefined,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `relatorio_nfe.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      showError("Erro ao gerar relatório.");
    }
  };

  const handleDownloadZip = async () => {
    if (selectedIds.length === 0 && !selectAllMatching) {
      showError("Selecione pelo menos uma nota para baixar o ZIP.");
      return;
    }
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/downloadZipXMLs`,
        {
          id: selectAllMatching ? undefined : selectedIds,
          // Include filters for "Select All Matching" fallback in backend
          cpf: selectAllMatching ? searchCpf : undefined,
          serie: selectAllMatching ? searchSerie : undefined,
          status: selectAllMatching ? status : undefined,
          ambiente: selectAllMatching ? ambiente : undefined,
          tipo_operacao: selectAllMatching ? tipoOperacao : undefined,
          equipamentoPerdido: selectAllMatching
            ? equipamentoPerdidoFilter
            : undefined,
          dateFilter: selectAllMatching ? dateFilter : undefined,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `nfes_export.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Erro ao baixar ZIP:", error);
      showError("Erro ao baixar ZIP.");
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Select only current page
      const currentIds = nfes.map((n) => n.id);
      // Merge with existing selection
      const newSelection = Array.from(new Set([...selectedIds, ...currentIds]));
      setSelectedIds(newSelection);
    } else {
      // Deselect current page
      const currentIds = nfes.map((n) => n.id);
      setSelectedIds(selectedIds.filter((id) => !currentIds.includes(id)));
      setSelectAllMatching(false);
    }
  };

  const handleSelectMatching = () => {
    setSelectAllMatching(true);
    // Visual feedback: select current page IDs to make checkbox checked
    const currentIds = nfes.map((n) => n.id);
    setSelectedIds(Array.from(new Set([...selectedIds, ...currentIds])));
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setSelectAllMatching(false);
  };

  const handleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
      setSelectAllMatching(false); // Valid assumption: if you deselect one, you aren't selecting all matching anymore
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const allPageSelected =
    nfes.length > 0 && nfes.every((n) => selectedIds.includes(n.id));

  return (
    <div>
      <NavBar />
      <div className="min-h-full">
        <div className=" bg-pink-800 pb-32">
          <header className="py-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Buscar NF-e
              </h1>
            </div>
          </header>
        </div>

        <main className="-mt-32">
          <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
            <div className="rounded-lg bg-white px-5 py-6 shadow sm:px-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
                <div className="col-span-1">
                  <label
                    htmlFor="cpf"
                    className="block text-sm font-medium text-gray-700"
                  >
                    CPF/CNPJ Destinatário
                  </label>
                  <input
                    type="text"
                    name="cpf"
                    id="cpf"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    placeholder="000.000.000-00"
                    value={searchCpf}
                    onChange={(e) => setSearchCpf(e.target.value)}
                  />
                </div>

                <div className="col-span-1">
                  <label
                    htmlFor="serie"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Série
                  </label>
                  <input
                    type="text"
                    name="serie"
                    id="serie"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    placeholder="Ex: 1"
                    value={searchSerie}
                    onChange={(e) => setSearchSerie(e.target.value)}
                  />
                </div>

                <div className="col-span-1">
                  <label
                    htmlFor="date-start"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Data Início
                  </label>
                  <input
                    type="date"
                    name="date-start"
                    id="date-start"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    value={dateFilter?.start || ""}
                    onChange={(e) =>
                      setDateFilter((prev) => ({
                        ...prev,
                        start: e.target.value,
                        end: prev?.end || "",
                      }))
                    }
                  />
                </div>

                <div className="col-span-1">
                  <label
                    htmlFor="date-end"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Data Fim
                  </label>
                  <input
                    type="date"
                    name="date-end"
                    id="date-end"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    value={dateFilter?.end || ""}
                    onChange={(e) =>
                      setDateFilter((prev) => ({
                        ...prev,
                        start: prev?.start || "",
                        end: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="col-span-1">
                  <label
                    htmlFor="status"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Todos</option>
                    <option value="autorizado">Autorizada</option>
                    <option value="erro_autorizacao">Erro Autorização</option>
                    <option value="assinado">Assinado</option>
                    <option value="cancelado">Cancelada</option>
                    <option value="enviado">Enviado (Pendente)</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <label
                    htmlFor="tipoOperacao"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Tipo Operação
                  </label>
                  <select
                    id="tipoOperacao"
                    name="tipoOperacao"
                    value={tipoOperacao}
                    onChange={(e) => setTipoOperacao(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Todos</option>
                    <option value="entrada_comodato">Entrada Comodato</option>
                    <option value="saida_comodato">Saída Comodato</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <label
                    htmlFor="equipamentoPerdido"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Equipamento Perdido?
                  </label>
                  <select
                    id="equipamentoPerdido"
                    name="equipamentoPerdido"
                    value={equipamentoPerdidoFilter}
                    onChange={(e) =>
                      setEquipamentoPerdidoFilter(e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Todos</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <label
                    htmlFor="ambiente"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Ambiente
                  </label>
                  <select
                    id="ambiente"
                    name="ambiente"
                    value={ambiente}
                    onChange={(e) => setAmbiente(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  >
                    <option value="homologacao">Homologação</option>
                    <option value="producao">Produção</option>
                  </select>
                </div>

                <div className="col-span-2 flex items-end space-x-2">
                  <button
                    onClick={handleSearch}
                    className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <CiSearch className="mr-2 h-5 w-5" />
                    Buscar
                  </button>
                  <button
                    onClick={handleGenerateReport}
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Relatório
                  </button>
                  <button
                    onClick={handleDownloadZip}
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    ZIP
                  </button>
                  <button
                    onClick={handleOpenCancelModal}
                    className="inline-flex justify-center rounded-md border border-red-300 bg-white py-2 px-4 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col">
                {/* Selection Banner */}
                {selectedIds.length > 0 && (
                  <div className="bg-indigo-50 border-l-4 border-indigo-400 p-4 mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">{/* Icon */}</div>
                      <div className="ml-3">
                        <p className="text-sm text-indigo-700">
                          {selectAllMatching ? (
                            <>
                              Todas as <strong>{totalCount}</strong> notas dessa
                              busca estão selecionadas.
                              <button
                                onClick={clearSelection}
                                className="ml-2 font-medium underline hover:text-indigo-900"
                              >
                                Limpar seleção
                              </button>
                            </>
                          ) : (
                            <>
                              {selectedIds.length} notas selecionadas.
                              {allPageSelected && totalCount > nfes.length && (
                                <button
                                  onClick={handleSelectMatching}
                                  className="ml-2 font-medium underline hover:text-indigo-900"
                                >
                                  Selecionar todas as {totalCount} notas dessa
                                  busca
                                </button>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                  <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                    <div className="overflow-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg max-h-[500px]">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th
                              scope="col"
                              className="relative px-7 sm:w-12 sm:px-6"
                            >
                              <input
                                type="checkbox"
                                className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                checked={nfes.length > 0 && allPageSelected}
                                onChange={handleSelectAll}
                              />
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Nº / Série
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Tipo
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Ambiente
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Produto
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Emissão
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Destinatário
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Valor
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Chave
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Status
                            </th>
                            <th
                              scope="col"
                              className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                            >
                              <span className="sr-only">Ações</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {loading ? (
                            <tr>
                              <td
                                colSpan={10}
                                className="text-center py-4 text-sm text-gray-500"
                              >
                                Carregando...
                              </td>
                            </tr>
                          ) : nfes.length === 0 ? (
                            <tr>
                              <td
                                colSpan={10}
                                className="text-center py-4 text-sm text-gray-500"
                              >
                                Nenhuma NFe encontrada.
                              </td>
                            </tr>
                          ) : (
                            nfes.map((nfe) => (
                              <tr
                                key={nfe.id}
                                className={
                                  selectedIds.includes(nfe.id)
                                    ? "bg-gray-50"
                                    : undefined
                                }
                              >
                                <td className="relative px-7 sm:w-12 sm:px-6">
                                  <input
                                    type="checkbox"
                                    className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    value={nfe.id}
                                    checked={selectedIds.includes(nfe.id)}
                                    onChange={() => handleSelect(nfe.id)}
                                  />
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {nfe.nNF} / {nfe.serie}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {nfe.tipo_operacao === "entrada_comodato"
                                    ? "Entrada"
                                    : nfe.tipo_operacao === "saida_comodato"
                                      ? "Saída"
                                      : nfe.tipo_operacao}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {nfe.tipo
                                    ? nfe.tipo === "homologacao"
                                      ? "Homologação"
                                      : "Produção"
                                    : nfe.tpAmb === 2
                                      ? "Homologação"
                                      : "Produção"}
                                </td>
                                <td
                                  className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 max-w-xs truncate"
                                  title={nfe.produto_predominante}
                                >
                                  {nfe.produto_predominante}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {new Date(
                                    nfe.data_emissao,
                                  ).toLocaleDateString()}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  <div className="font-medium text-gray-900">
                                    {nfe.destinatario_nome}
                                  </div>
                                  <div className="text-gray-500">
                                    {nfe.destinatario_cpf_cnpj}
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  R$ {Number(nfe.valor_total).toFixed(2)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {nfe.chave}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  <span
                                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                                      nfe.status === "autorizado"
                                        ? "bg-green-50 text-green-700 ring-green-600/20"
                                        : nfe.status === "cancelado" ||
                                            nfe.status === "erro_autorizacao"
                                          ? "bg-red-50 text-red-700 ring-red-600/20"
                                          : nfe.status === "enviado"
                                            ? "bg-blue-50 text-blue-700 ring-blue-600/20"
                                            : nfe.status === "assinado"
                                              ? "bg-cyan-50 text-cyan-700 ring-cyan-600/20"
                                              : "bg-yellow-50 text-yellow-800 ring-yellow-600/20"
                                    }`}
                                  >
                                    {nfe.status}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right space-x-2">
                                  <button
                                    className="text-indigo-600 hover:text-indigo-900 border rounded px-2 py-1 border-indigo-200 hover:bg-indigo-50"
                                    onClick={() => handleDownloadXml(nfe.chave)}
                                  >
                                    XML
                                  </button>
                                  <button
                                    className="text-gray-600 hover:text-gray-900 border rounded px-2 py-1 border-gray-200 hover:bg-gray-50"
                                    onClick={() =>
                                      handleDownloadPdf(nfe.id, nfe.nNF)
                                    }
                                  >
                                    PDF
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Mostrando{" "}
                      <span className="font-medium">
                        {(page - 1) * limit + 1}
                      </span>{" "}
                      a{" "}
                      <span className="font-medium">
                        {Math.min(page * limit, totalCount)}
                      </span>{" "}
                      de <span className="font-medium">{totalCount}</span>{" "}
                      resultados
                    </p>
                  </div>
                  <div>
                    <nav
                      className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                      aria-label="Pagination"
                    >
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                      >
                        <span className="sr-only">Anterior</span>
                        &larr;
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                        Página {page} de {totalPages}
                      </span>
                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                      >
                        <span className="sr-only">Próxima</span>
                        &rarr;
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Cancelar NF-e(s)
            </h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Você está prestes a cancelar as NF-es selecionadas. Esta ação
                requer a senha do Certificado Digital.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Senha do Certificado (PFX)
              </label>
              <input
                type="password"
                className="mt-1 block w-full rounded-md border-gray-300 border shadow-sm p-2 focus:border-red-500 focus:ring-red-500 sm:text-sm"
                value={cancelPassword}
                onChange={(e) => setCancelPassword(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Justificativa (mín. 15 caracteres)
              </label>
              <textarea
                className="mt-1 block w-full rounded-md border-gray-300 border shadow-sm p-2 focus:border-red-500 focus:ring-red-500 sm:text-sm"
                rows={3}
                value={cancelJustificativa}
                onChange={(e) => setCancelJustificativa(e.target.value)}
              />
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelPassword("");
                  setCancelJustificativa("");
                }}
                disabled={cancelLoading}
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelNfes}
                disabled={cancelLoading}
                className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none disabled:opacity-50"
              >
                {cancelLoading ? "Processando..." : "Confirmar Cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
