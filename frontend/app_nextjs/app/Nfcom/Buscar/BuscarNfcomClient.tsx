"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import NavBar from "@/components/NavBar";
import { CiSearch } from "react-icons/ci";
import { BiCalendar, BiUser, BiReceipt, BiChevronLeft, BiChevronRight } from "react-icons/bi";
import { GoNumber } from "react-icons/go";
import { VscSymbolBoolean } from "react-icons/vsc";
import { MdMergeType, MdOutlineConfirmationNumber } from "react-icons/md";
import { AiOutlineUser } from "react-icons/ai";
import { BsDownload, BsFiletypePdf, BsFiletypeXml } from "react-icons/bs";
import { useNotification } from "@/lib/NotificationContext";
import PopUpCancelNFSE from "../../NFSE/components/PopUpCancelNFSE";
import type { User } from "@/lib/auth";

export default function BuscarNfcomClient({ user }: { user: User }) {
  const [pppoe, setPppoe] = useState<string>("");
  const [titulo, setTitulo] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [nfcomList, setNfcomList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tpAmb, settpAmb] = useState<number>(1);
  const [showPopUp, setShowPopUp] = useState(false);
  const [password, setPassword] = useState<string>("");
  const [showReportPopUp, setShowReportPopUp] = useState(false);
  const [reportPassword, setReportPassword] = useState<string>("");
  const [selectedNfcom, setSelectedNfcom] = useState<any | null>(null);
  const [serie, setSerie] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSelectAllMode, setIsSelectAllMode] = useState<boolean>(false);
  const [excludedIds, setExcludedIds] = useState<number[]>([]);
  const [pagination, setPagination] = useState({ page: 1, take: 50, totalPages: 0 });
  const [cpf_cnpj, setCpfCnpj] = useState<string>("");
  const [clientType, setClientType] = useState<string>("");
  const [totalClients, setTotalClients] = useState<number>(0);

  const { addJob, showError, showSuccess } = useNotification();

  const handleSearch = async (pageOverride?: number) => {
    setLoading(true);
    const pageToUse = pageOverride || pagination.page;
    try {
      const searchParams: any = { pppoe, titulo, dataInicio, dataFim, tpAmb, serie, status, cpf_cnpj, clientType };
      const res = await axios.post(
        `${process.env.REACT_APP_URL}/Nfcom/buscarNFCom`,
        { searchParams, pagination: { ...pagination, page: pageToUse } },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      setNfcomList(res.data);
      
      const pagesRes = await axios.post(
        `${process.env.REACT_APP_URL}/Nfcom/NfComPages`,
        { searchParams },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      setPagination((p) => ({ ...p, page: pageToUse, totalPages: Number(pagesRes.data) }));
    } catch (err) {
      showError("Erro ao buscar NFCom.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadXml = (xmlContent: string, nNF: string) => {
    const blob = new Blob([xmlContent], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nfcom_${nNF}.xml`;
    a.click();
  };

  const generateDanfe = async (nfcom: any) => {
    try {
      setLoading(true);
      const res = await axios.post(
        `${process.env.REACT_APP_URL}/NFCom/generatePdfFromNfXML`,
        { id: nfcom.id },
        { headers: { Authorization: `Bearer ${user.token}` }, responseType: "blob" }
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
      showSuccess("DANFE gerada com sucesso!");
    } catch (err) {
      showError("Erro ao gerar DANFE.");
    } finally {
      setLoading(false);
    }
  };

  const confirmCancellation = async () => {
    setLoading(true);
    try {
      const payload = {
        password,
        id: selectedNfcom ? selectedNfcom.id : selectedIds,
        pppoe: selectedNfcom ? selectedNfcom.pppoe : undefined,
        tpAmb: selectedNfcom ? selectedNfcom.tpAmb : undefined,
      };
      const res = await axios.post(
        `${process.env.REACT_APP_URL}/NFCom/cancelarNFCom`,
        payload,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      addJob(res.data.id, "cancelamento");
      showSuccess("Cancelamento solicitado! Processando em segundo plano.");
      setShowPopUp(false);
      setSelectedIds([]);
    } catch (err) {
      showError("Erro ao cancelar NFCom.");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      handleSearch(newPage);
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-10">
      <NavBar user={user} />
      
      <div className="bg-blue-800 pb-32">
        <header className="py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-white">Buscar NFCom</h1>
            <p className="mt-2 text-blue-100">Consulte notas fiscais de comunicação geradas</p>
          </div>
        </header>
      </div>

      <main className="-mt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
             <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">PPPOE</label>
                  <input type="text" className="w-full h-10 border rounded px-3" value={pppoe} onChange={e => setPppoe(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título</label>
                  <input type="text" className="w-full h-10 border rounded px-3" value={titulo} onChange={e => setTitulo(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Série</label>
                  <input type="text" className="w-full h-10 border rounded px-3" value={serie} onChange={e => setSerie(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                  <select className="w-full h-10 border rounded px-3" value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="autorizada">Autorizada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ambiente</label>
                   <select className="w-full h-10 border rounded px-3" value={tpAmb} onChange={e => settpAmb(Number(e.target.value))}>
                      <option value={1}>Produção</option>
                      <option value={2}>Homologação</option>
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Início</label>
                   <input type="date" className="w-full h-10 border rounded px-3" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Fim</label>
                   <input type="date" className="w-full h-10 border rounded px-3" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
             </div>
             
             <div className="mt-6 flex flex-wrap gap-3 pt-6 border-t">
                <button onClick={() => handleSearch(1)} className="bg-blue-600 text-white h-11 px-8 rounded-lg font-bold flex items-center gap-2">
                  <CiSearch className="text-xl" />
                  Buscar
                </button>
                <button onClick={() => { setPppoe(""); setTitulo(""); handleSearch(1); }} className="bg-gray-100 text-gray-700 h-11 px-6 rounded-lg font-bold">Limpar</button>
                {selectedIds.length > 0 && (
                   <button onClick={() => { setSelectedNfcom(null); setShowPopUp(true); }} className="bg-red-100 text-red-700 h-11 px-6 rounded-lg font-bold">Cancelar Selecionados ({selectedIds.length})</button>
                )}
             </div>
          </div>

          <div className="mt-8 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3"></th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nº / Série</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Login</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Emissão</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Valor</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                   {nfcomList.map(n => (
                     <tr key={n.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="px-6 py-4">
                          <input type="checkbox" className="size-4 rounded text-blue-600" checked={selectedIds.includes(n.id)} onChange={() => handleSelectOne(n.id)} />
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{n.nNF} / {n.serie}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{n.pppoe}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(n.data_emissao).toLocaleDateString("pt-BR")}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-700">R$ {Number(n.value).toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm font-bold">
                           <span className={`px-2 py-1 rounded text-[10px] uppercase ${n.status === 'autorizada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {n.status}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                           <button onClick={() => handleDownloadXml(n.xml, n.nNF)} className="text-gray-400 hover:text-blue-600" title="Baixar XML"><BsFiletypeXml className="text-xl" /></button>
                           <button onClick={() => generateDanfe(n)} className="text-gray-400 hover:text-red-600" title="DANFE PDF"><BsFiletypePdf className="text-xl" /></button>
                        </td>
                     </tr>
                   ))}
                </tbody>
              </table>
            </div>
            
            <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
               <span className="text-sm text-gray-600">Página <strong>{pagination.page}</strong> de {pagination.totalPages}</span>
               <div className="flex gap-2">
                  <button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 1} className="p-2 border rounded disabled:opacity-30 bg-white"><BiChevronLeft className="text-xl"/></button>
                  <button onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page === pagination.totalPages} className="p-2 border rounded disabled:opacity-30 bg-white"><BiChevronRight className="text-xl"/></button>
               </div>
            </div>
          </div>
        </div>
      </main>

      {showPopUp && (
        <PopUpCancelNFSE
          setShowPopUp={setShowPopUp}
          showPopUp={showPopUp}
          setPassword={setPassword}
          password={password}
          cancelNFSE={confirmCancellation}
        />
      )}
    </div>
  );
}
