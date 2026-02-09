import React, { useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { CiSearch } from "react-icons/ci";

import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";

export const BuscarNfe = () => {
  const [searchCpf, setSearchCpf] = useState<string>("");
  const [nfes, setNfes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ambiente, setAmbiente] = useState<string>("homologacao");
  const [status, setStatus] = useState<string>(""); // autorizado, cancelado, etc.
  const [tipoOperacao, setTipoOperacao] = useState<string>(""); // entrada_comodato, saida_comodato
  const [dateFilter, setDateFilter] = useState<{
    start: string;
    end: string;
  } | null>(null);

  const { user } = useAuth();
  const token = user?.token;
  const { showError } = useNotification();

  const handleSearch = async () => {
    setLoading(true);
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/buscarGeradas`,
        {
          cpf: searchCpf,
          dateFilter: dateFilter,
          status: status,
          ambiente: ambiente,
          tipo_operacao: tipoOperacao,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      setNfes(resposta.data);
    } catch (erro) {
      console.error("Erro ao buscar NFEs:", erro);
      showError("Erro ao buscar NFEs.");
    } finally {
      setLoading(false);
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

  const handleGenerateReport = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/generateReportPdf`,
        {
          id: selectedIds.length > 0 ? selectedIds : undefined,
          dateFilter: dateFilter,
          dataInicio: dateFilter?.start
            ? new Date(dateFilter.start).toLocaleDateString("pt-BR")
            : undefined,
          dataFim: dateFilter?.end
            ? new Date(dateFilter.end).toLocaleDateString("pt-BR")
            : undefined,
          tipo_operacao: tipoOperacao,
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
    if (selectedIds.length === 0) {
      showError("Selecione pelo menos uma nota para baixar o ZIP.");
      return;
    }
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/downloadZipXMLs`,
        { id: selectedIds },
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
      setSelectedIds(nfes.map((n) => n.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

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
                </div>
              </div>

              <div className="mt-8 flex flex-col">
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
                                checked={
                                  nfes.length > 0 &&
                                  selectedIds.length === nfes.length
                                }
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
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
