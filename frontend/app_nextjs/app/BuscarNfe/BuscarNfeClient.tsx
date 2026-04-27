"use client";

import React, { useState } from "react";
import axios from "axios";
import NavBar from "@/components/NavBar";
import { CiSearch } from "react-icons/ci";
import { useNotification } from "@/lib/NotificationContext";
import type { User } from "@/lib/auth";

export default function BuscarNfeClient({ user }: { user: User }) {
  const [searchCpf, setSearchCpf] = useState<string>("");
  const [searchNome, setSearchNome] = useState<string>("");
  const [searchSerie, setSearchSerie] = useState<string>("");
  const [nfes, setNfes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ambiente, setAmbiente] = useState<string>("homologacao");
  const [status, setStatus] = useState<string>("");
  const [tipoOperacao, setTipoOperacao] = useState<string>("");
  const [equipamentoPerdidoFilter, setEquipamentoPerdidoFilter] = useState<string>("");
  const [inconsistenciaValor, setInconsistenciaValor] = useState<boolean>(false);
  const [semPar, setSemPar] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string } | null>(null);

  // Pagination & Selection State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { showError, showSuccess, addJob } = useNotification();

  // Modal States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelPassword, setCancelPassword] = useState("");
  const [cancelJustificativa, setCancelJustificativa] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const [showDevolucaoModal, setShowDevolucaoModal] = useState(false);
  const [devolucaoPassword, setDevolucaoPassword] = useState("");
  const [devolucaoEquipamentoPerdido, setDevolucaoEquipamentoPerdido] = useState(false);
  const [devolucaoObservacao, setDevolucaoObservacao] = useState("");
  const [devolucaoLoading, setDevolucaoLoading] = useState(false);

  const fetchNfes = async (pageToFetch: number) => {
    setLoading(true);
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/buscarGeradas`,
        {
          cpf: searchCpf,
          nome: searchNome,
          serie: searchSerie,
          dateFilter: dateFilter,
          status: status,
          ambiente: ambiente,
          tipo_operacao: tipoOperacao,
          equipamentoPerdido: equipamentoPerdidoFilter,
          inconsistenciaValor: inconsistenciaValor,
          semPar: semPar || undefined,
          page: pageToFetch,
          limit: limit,
        },
        { headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" } }
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
    setSelectedIds([]);
    setSelectAllMatching(false);
    await fetchNfes(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchNfes(newPage);
    }
  };

  const handleDownloadXml = async (chave: string) => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/NFEletronica/xml/${chave}`,
        { headers: { Authorization: `Bearer ${user.token}` }, responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${chave}-nfe.xml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (erro) {
      showError("Erro ao baixar o XML.");
    }
  };

  const handleDownloadPdf = async (id: number, nNF: string) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/generateDanfe`,
        { id },
        { headers: { Authorization: `Bearer ${user.token}` }, responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `nfe_${nNF}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      showError("Erro ao baixar PDF.");
    }
  };

  const handleCancelNfes = async () => {
    if (!cancelPassword || cancelJustificativa.length < 15) {
      showError("Verifique a senha e a justificativa (mín. 15 carac.).");
      return;
    }
    setCancelLoading(true);
    try {
      const payload = {
        password: cancelPassword,
        justificativa: cancelJustificativa,
        id: selectAllMatching ? undefined : selectedIds,
        cpf: selectAllMatching ? searchCpf : undefined,
        nome: selectAllMatching ? searchNome : undefined,
        serie: selectAllMatching ? searchSerie : undefined,
        status: selectAllMatching ? status : undefined,
        ambiente: selectAllMatching ? ambiente : undefined,
        tipo_operacao: selectAllMatching ? tipoOperacao : undefined,
        equipamentoPerdido: selectAllMatching ? equipamentoPerdidoFilter : undefined,
        inconsistenciaValor: selectAllMatching ? inconsistenciaValor : undefined,
        semPar: selectAllMatching ? semPar || undefined : undefined,
        dateFilter: selectAllMatching ? dateFilter : undefined,
      };

      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/cancelarNotas`,
        payload,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      showSuccess(response.data.message || "Solicitação enviada.");
      setShowCancelModal(false);
      setCancelPassword("");
      setCancelJustificativa("");
      setSelectedIds([]);
      setSelectAllMatching(false);
      fetchNfes(1);
    } catch (error: any) {
      showError(error.response?.data?.message || "Erro ao solicitar cancelamento.");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleDevolucaoNfes = async () => {
    if (!devolucaoPassword) {
      showError("A senha do certificado é obrigatória.");
      return;
    }
    setDevolucaoLoading(true);
    try {
      const payload = {
        password: devolucaoPassword,
        nfeIds: selectAllMatching ? undefined : selectedIds,
        cpf: selectAllMatching ? searchCpf : undefined,
        nome: selectAllMatching ? searchNome : undefined,
        serie: selectAllMatching ? searchSerie : undefined,
        status: selectAllMatching ? status : undefined,
        ambiente: selectAllMatching ? ambiente : undefined,
        tipo_operacao: selectAllMatching ? tipoOperacao : undefined,
        equipamentoPerdidoFilter: selectAllMatching ? equipamentoPerdidoFilter : undefined,
        inconsistenciaValor: selectAllMatching ? inconsistenciaValor : undefined,
        semPar: selectAllMatching ? semPar || undefined : undefined,
        dateFilter: selectAllMatching ? dateFilter : undefined,
        equipamentoPerdido: devolucaoEquipamentoPerdido,
        observacao: devolucaoEquipamentoPerdido ? devolucaoObservacao : undefined,
      };

      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/comodato/devolucao`,
        payload,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      if (response.data.job) {
        addJob(response.data.job, "emissao");
        showSuccess("Devolução iniciada em segundo plano!");
      } else {
        showSuccess("Processamento iniciado.");
      }

      setShowDevolucaoModal(false);
      setDevolucaoPassword("");
      setSelectedIds([]);
      setSelectAllMatching(false);
    } catch (error: any) {
      showError(error.response?.data?.message || "Erro ao solicitar devolução.");
    } finally {
      setDevolucaoLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/generateReportPdf`,
        {
          id: selectAllMatching ? undefined : (selectedIds.length > 0 ? selectedIds : undefined),
          tipo_operacao: tipoOperacao,
          cpf: selectAllMatching ? searchCpf : undefined,
          nome: selectAllMatching ? searchNome : undefined,
          serie: selectAllMatching ? searchSerie : undefined,
          status: selectAllMatching ? status : undefined,
          ambiente: selectAllMatching ? ambiente : undefined,
          inconsistenciaValor: selectAllMatching ? inconsistenciaValor : undefined,
          semPar: selectAllMatching ? semPar || undefined : undefined,
          dateFilter: dateFilter,
          dataInicio: dateFilter?.start ? new Date(dateFilter.start).toLocaleDateString("pt-BR") : undefined,
          dataFim: dateFilter?.end ? new Date(dateFilter.end).toLocaleDateString("pt-BR") : undefined,
        },
        { headers: { Authorization: `Bearer ${user.token}` }, responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `relatorio_nfe.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      showError("Erro ao gerar relatório.");
    }
  };

  const handleGenerateExcel = async () => {
    if (selectedIds.length === 0 && !selectAllMatching) {
      showError("Selecione pelo menos uma nota.");
      return;
    }
    showSuccess("Gerando Excel...");
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/generateExcel`,
        {
          id: selectAllMatching ? undefined : selectedIds,
          tipo_operacao: tipoOperacao,
          cpf: selectAllMatching ? searchCpf : undefined,
          nome: selectAllMatching ? searchNome : undefined,
          serie: selectAllMatching ? searchSerie : undefined,
          status: selectAllMatching ? status : undefined,
          ambiente: selectAllMatching ? ambiente : undefined,
          inconsistenciaValor: selectAllMatching ? inconsistenciaValor : undefined,
          semPar: selectAllMatching ? semPar || undefined : undefined,
          dateFilter: dateFilter,
        },
        { headers: { Authorization: `Bearer ${user.token}` }, responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Exportacao_NFe.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      showError("Erro ao gerar Excel.");
    }
  };

  const handleDownloadZip = async () => {
    if (selectedIds.length === 0 && !selectAllMatching) {
      showError("Selecione pelo menos uma nota.");
      return;
    }
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/downloadZipXMLs`,
        {
          id: selectAllMatching ? undefined : selectedIds,
          cpf: selectAllMatching ? searchCpf : undefined,
          nome: selectAllMatching ? searchNome : undefined,
          serie: selectAllMatching ? searchSerie : undefined,
          status: selectAllMatching ? status : undefined,
          ambiente: selectAllMatching ? ambiente : undefined,
          tipo_operacao: selectAllMatching ? tipoOperacao : undefined,
          dateFilter: selectAllMatching ? dateFilter : undefined,
        },
        { headers: { Authorization: `Bearer ${user.token}` }, responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `nfes_export.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      showError("Erro ao baixar ZIP.");
    }
  };

  const handleSelectAllOnPage = (checked: boolean) => {
    if (checked) {
      const currentIds = nfes.map((n) => n.id);
      setSelectedIds(Array.from(new Set([...selectedIds, ...currentIds])));
    } else {
      const currentIds = nfes.map((n) => n.id);
      setSelectedIds(selectedIds.filter((id) => !currentIds.includes(id)));
      setSelectAllMatching(false);
    }
  };

  const handleSelect = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
    setSelectAllMatching(false);
  };

  const allPageSelected = nfes.length > 0 && nfes.every((n) => selectedIds.includes(n.id));

  return (
    <div className="bg-gray-50 min-h-screen pb-10">
      <NavBar user={user} />

      <div className="bg-pink-800 pb-32">
        <header className="py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-white">Buscar NF-e</h1>
            <p className="mt-2 text-pink-100">Consulte e gerencie notas fiscais eletrônicas</p>
          </div>
        </header>
      </div>

      <main className="-mt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">CPF/CNPJ Destinatário</label>
                <input
                  type="text"
                  className="w-full h-10 px-3 border rounded-md focus:ring-2 focus:ring-pink-500 outline-none"
                  placeholder="000.000.000-00"
                  value={searchCpf}
                  onChange={(e) => setSearchCpf(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nome Cliente</label>
                <input
                  type="text"
                  className="w-full h-10 px-3 border rounded-md focus:ring-2 focus:ring-pink-500 outline-none"
                  placeholder="Nome do cliente"
                  value={searchNome}
                  onChange={(e) => setSearchNome(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Série</label>
                <input
                  type="text"
                  className="w-full h-10 px-3 border rounded-md focus:ring-2 focus:ring-pink-500 outline-none"
                  placeholder="Ex: 1"
                  value={searchSerie}
                  onChange={(e) => setSearchSerie(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Ambiente</label>
                <select
                  className="w-full h-10 px-3 border rounded-md"
                  value={ambiente}
                  onChange={(e) => setAmbiente(e.target.value)}
                >
                  <option value="homologacao">Homologação</option>
                  <option value="producao">Produção</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Data Início</label>
                <input
                  type="date"
                  className="w-full h-10 px-3 border rounded-md"
                  value={dateFilter?.start || ""}
                  onChange={(e) => setDateFilter((p) => ({ start: e.target.value, end: p?.end || "" }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Data Fim</label>
                <input
                  type="date"
                  className="w-full h-10 px-3 border rounded-md"
                  value={dateFilter?.end || ""}
                  onChange={(e) => setDateFilter((p) => ({ start: p?.start || "", end: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Status</label>
                <select
                  className="w-full h-10 px-3 border rounded-md"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="autorizado">Autorizada</option>
                  <option value="erro_autorizacao">Erro Autorização</option>
                  <option value="assinado">Assinado</option>
                  <option value="cancelado">Cancelada</option>
                  <option value="enviado">Enviado (Pendente)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tipo Operação</label>
                <select
                  className="w-full h-10 px-3 border rounded-md"
                  value={tipoOperacao}
                  onChange={(e) => setTipoOperacao(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="entrada_comodato">Entrada Comodato</option>
                  <option value="saida_comodato">Saída Comodato</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 pt-6 border-t">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="bg-indigo-600 text-white h-11 px-8 rounded-lg hover:bg-indigo-700 font-bold flex items-center gap-2"
              >
                <CiSearch className="text-xl" />
                {loading ? "Buscando..." : "Buscar"}
              </button>
              <button onClick={handleGenerateReport} className="bg-gray-100 text-gray-700 h-11 px-4 rounded-lg hover:bg-gray-200 font-bold">Relatório PDF</button>
              <button onClick={handleGenerateExcel} className="bg-green-100 text-green-700 h-11 px-4 rounded-lg hover:bg-green-200 font-bold">Exportar Excel</button>
              <button onClick={handleDownloadZip} className="bg-blue-100 text-blue-700 h-11 px-4 rounded-lg hover:bg-blue-200 font-bold">Baixar ZIP</button>
              {user.permission >= 5 && (
                <button onClick={() => setShowCancelModal(true)} className="bg-red-100 text-red-700 h-11 px-4 rounded-lg hover:bg-red-200 font-bold">Cancelar</button>
              )}
              <button onClick={() => setShowDevolucaoModal(true)} className="bg-yellow-100 text-yellow-800 h-11 px-4 rounded-lg hover:bg-yellow-200 font-bold">Devolver</button>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex justify-between items-center animate-pulse">
              <span className="text-indigo-800 font-medium">
                {selectAllMatching ? `Todas as ${totalCount} notas selecionadas.` : `${selectedIds.length} notas selecionadas nesta página.`}
              </span>
              <div className="flex gap-4">
                {!selectAllMatching && totalCount > nfes.length && (
                  <button onClick={() => setSelectAllMatching(true)} className="text-indigo-600 font-bold underline">Selecionar as {totalCount}</button>
                )}
                <button onClick={() => { setSelectedIds([]); setSelectAllMatching(false); }} className="text-gray-500 font-bold">Limpar</button>
              </div>
            </div>
          )}

          <div className="mt-6 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-20">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        className="size-4 rounded text-pink-600"
                        checked={allPageSelected}
                        onChange={(e) => handleSelectAllOnPage(e.target.checked)}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nº / Série</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Ambiente</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Emissão</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Destinatário</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {nfes.map((n) => (
                    <tr key={n.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          className="size-4 rounded text-pink-600"
                          checked={selectedIds.includes(n.id)}
                          onChange={() => handleSelect(n.id)}
                        />
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-gray-900">{n.nNF} / {n.serie}</td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {n.tipo_operacao === "entrada_comodato" ? "Entrada" : "Saída"}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {n.tpAmb === 2 ? "Homologação" : "Produção"}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">{new Date(n.data_emissao).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-4 text-sm">
                        <div className="font-bold text-gray-900">{n.destinatario_nome}</div>
                        <div className="text-gray-500 text-xs">{n.destinatario_cpf_cnpj}</div>
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-gray-700">R$ {Number(n.valor_total).toFixed(2)}</td>
                      <td className="px-4 py-4">
                         <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                           n.status === 'autorizado' ? 'bg-green-100 text-green-700' :
                           n.status === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                         }`}>
                           {n.status}
                         </span>
                      </td>
                      <td className="px-4 py-4 text-right space-x-2">
                        <button onClick={() => handleDownloadXml(n.chave)} className="text-indigo-600 hover:underline text-xs font-bold">XML</button>
                        <button onClick={() => handleDownloadPdf(n.id, n.nNF)} className="text-pink-600 hover:underline text-xs font-bold">DANFE</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
               <span className="text-sm text-gray-600">Página <strong>{page}</strong> de {totalPages}</span>
               <div className="flex gap-2">
                 <button onClick={() => handlePageChange(page - 1)} disabled={page === 1} className="px-4 py-2 bg-white border rounded disabled:opacity-50 font-bold text-sm shadow-sm">Anterior</button>
                 <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages} className="px-4 py-2 bg-white border rounded disabled:opacity-50 font-bold text-sm shadow-sm">Próxima</button>
               </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md border border-red-100">
            <h3 className="text-xl font-bold text-red-700 mb-4 uppercase tracking-tight">Cancelar Notas</h3>
            <p className="text-sm text-gray-600 mb-6 font-medium">Esta ação é irreversível e exige a senha do certificado digital.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Senha PFX</label>
                <input
                  type="password"
                  className="w-full h-11 border rounded-lg px-3 focus:ring-2 focus:ring-red-500"
                  value={cancelPassword}
                  onChange={(e) => setCancelPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Justificativa (mín. 15 carac.)</label>
                <textarea
                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-red-500"
                  rows={3}
                  value={cancelJustificativa}
                  onChange={(e) => setCancelJustificativa(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setShowCancelModal(false)} className="px-6 text-gray-500 font-bold hover:text-gray-700 transition-all">Sair</button>
              <button
                onClick={handleCancelNfes}
                disabled={cancelLoading}
                className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-red-700 transition-all"
              >
                {cancelLoading ? "Cancelando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDevolucaoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md border border-yellow-100">
            <h3 className="text-xl font-bold text-yellow-700 mb-4 uppercase tracking-tight">Devolução de Comodato</h3>
            <p className="text-sm text-gray-600 mb-6 font-medium">Emissão de notas de entrada referenciadas.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Senha PFX</label>
                <input
                  type="password"
                  className="w-full h-11 border rounded-lg px-3 focus:ring-2 focus:ring-yellow-500"
                  value={devolucaoPassword}
                  onChange={(e) => setDevolucaoPassword(e.target.value)}
                />
              </div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-5 rounded text-red-600"
                    checked={devolucaoEquipamentoPerdido}
                    onChange={(e) => setDevolucaoEquipamentoPerdido(e.target.checked)}
                  />
                  <span className="text-sm font-bold text-red-700 uppercase">Equipamento Perdido / Queimado</span>
                </label>
                {devolucaoEquipamentoPerdido && (
                  <textarea
                    className="w-full mt-3 border rounded-lg p-2 text-sm"
                    rows={2}
                    placeholder="Obs sobre a perda..."
                    value={devolucaoObservacao}
                    onChange={(e) => setDevolucaoObservacao(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setShowDevolucaoModal(false)} className="px-6 text-gray-500 font-bold hover:text-gray-700">Sair</button>
              <button
                onClick={handleDevolucaoNfes}
                disabled={devolucaoLoading}
                className="bg-yellow-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-yellow-700 transition-all"
              >
                {devolucaoLoading ? "Enviando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
