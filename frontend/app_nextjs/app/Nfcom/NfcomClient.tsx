"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import NavBar from "@/components/NavBar";
import Stacked from "./components/Stacked";
import Filter from "./components/Filter";
import Link from "next/link";
import { CiSearch } from "react-icons/ci";
import { BsFiletypeDoc } from "react-icons/bs";
import { useNotification } from "@/lib/NotificationContext";
import PopUpCancelNFSE from "../NFSE/components/PopUpCancelNFSE"; // Reusing popup
import type { User } from "@/lib/auth";

export default function NfcomClient({ user }: { user: User }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [ambiente, setAmbiente] = useState("homologacao");
  const [showCertPasswordPopUp, setShowCertPasswordPopUp] = useState(false);
  const [certPassword, setCertPassword] = useState<string>("");
  const [lastNfcomId, setLastNfcomId] = useState<string>("");
  const [searchCpf, setSearchCpf] = useState<string>("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [reducao, setReducao] = useState("");
  const [isReducaoActive, setIsReducaoActive] = useState(false);
  const [clientesSelecionados, setClientesSelecionados] = useState<number[]>([]);
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string } | null>(null);
  const [activeFilters, setActiveFilters] = useState<any>({
    plano: [], vencimento: [], cli_ativado: [], nova_nfe: [], SVA: [], servicos: [],
  });

  const [showPopUp, setShowPopUp] = useState(false);
  const [password, setPassword] = useState<string>("");
  const { addJob, showError, showSuccess } = useNotification();

  const handleCheckboxChange = (clienteId: number) => {
    setClientesSelecionados((prev) =>
      prev.includes(clienteId) ? prev.filter((id) => id !== clienteId) : [...prev, clienteId]
    );
  };

  const handleSelectAll = () => {
    if (clientesSelecionados.length === clientes.length) {
      setClientesSelecionados([]);
    } else {
      const titulosValidos = clientes
        .filter((c) => c.fatura && c.fatura.titulo)
        .map((c) => c.fatura.titulo);
      setClientesSelecionados(titulosValidos);
    }
  };

  const handleSearch = async () => {
    const searchCpfRegex = searchCpf.replace(/\D/g, "");
    setLoading(true);
    try {
      setIsReducaoActive(activeFilters.SVA[0] === "SVA");
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/NFCom/buscarClientes`,
        { cpf: searchCpfRegex, filters: activeFilters, dateFilter: dateFilter },
        { headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" } }
      );
      setClientes(resposta.data);
    } catch (erro) {
      showError("Erro ao buscar clientes.");
    } finally {
      setLoading(false);
    }
  };

  const emitirNFCom = async () => {
    setLoading(true);
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/NFCom/emitirNFCom`,
        { password, clientesSelecionados, reducao: isReducaoActive ? reducao : "0.0", ambiente, lastNfcomId },
        { headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" }, timeout: 3600000 }
      );
      addJob(resposta.data.job, "emissao");
      showSuccess("Emissão iniciada! Acompanhe nas notificações.");
    } catch (erro) {
      showError("Erro ao emitir NFCom.");
    } finally {
      setShowPopUp(false);
      setLoading(false);
    }
  };

  const enviarCertificado = async () => {
    if (!arquivo || !certPassword) return;
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      formData.append("password", certPassword);
      await axios.post(`${process.env.REACT_APP_URL}/Nfe/upload`, formData, {
        headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "multipart/form-data" },
      });
      showSuccess("Certificado enviado com sucesso!");
      setShowCertPasswordPopUp(false);
      setCertPassword("");
    } catch (erro) {
      showError("Não foi possível enviar o certificado.");
    }
  };

  const totalSomado = clientes.reduce((acc, c) => acc + Number(c.fatura.valor || 0), 0);

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      <NavBar user={user} />
      <Stacked setSearchCpf={setSearchCpf} onSearch={handleSearch} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6 relative z-10 flex flex-wrap gap-4">
        <Link href="/Nfcom/Buscar">
          <button className="bg-blue-600 text-white h-12 px-6 rounded-lg hover:bg-blue-700 transition-all font-bold shadow-lg flex items-center gap-2">
            <CiSearch className="text-xl" />
            Buscar NFCom Geradas
          </button>
        </Link>
      </div>

      <Filter
        setActiveFilters={setActiveFilters}
        setDate={setDateFilter}
        setArquivo={setArquivo}
        enviarCertificado={() => setShowCertPasswordPopUp(true)}
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-10">
        {clientes.length > 0 && (
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden mb-8 animate-fade-in">
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center flex-wrap gap-4">
               <h2 className="text-lg font-bold text-gray-800">Resultados: {clientes.length}</h2>
               <div className="flex gap-4 items-center">
                 <span className="text-sm font-medium text-gray-600">Total Somado: <strong className="text-green-600">R$ {totalSomado.toFixed(2)}</strong></span>
                 <button onClick={handleSelectAll} className="text-sm text-sky-600 font-bold hover:underline">
                   {clientesSelecionados.length === clientes.length ? "Desmarcar Todos" : "Selecionar Todos"}
                 </button>
               </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left"></th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Título</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Login</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Vencimento</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Valor</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {clientes.map((c) => (
                    <tr key={c.fatura.titulo} className="hover:bg-sky-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          className="size-4 rounded text-sky-600 cursor-pointer"
                          checked={clientesSelecionados.includes(c.fatura.titulo)}
                          onChange={() => handleCheckboxChange(c.fatura.titulo)}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{c.fatura.titulo}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.login}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.fatura.datavenc}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-700">R$ {c.fatura.valor}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-500">{c.cli_ativado === "s" ? "ATIVO" : "INATIVO"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-8 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-8 border-b pb-2">Configurações de Emissão</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Ambiente</label>
              <select
                className="w-full h-12 px-4 border rounded-lg"
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value)}
              >
                <option value="homologacao">Homologação</option>
                <option value="producao">Produção</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Último Nfcom ID (Manual)</label>
              <input
                type="text"
                className="w-full h-12 px-4 border rounded-lg"
                placeholder="Ex: 1234"
                value={lastNfcomId}
                onChange={(e) => setLastNfcomId(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8">
            <h3 className="font-bold text-gray-700 mb-4">Redução SVA</h3>
            <div className="flex gap-4 items-center">
              <input
                type="text"
                className={`flex-1 h-12 px-4 border rounded-lg ${!isReducaoActive ? 'bg-gray-200 cursor-not-allowed' : ''}`}
                placeholder={isReducaoActive ? "Ex: 40" : "Ative o filtro Somente SVA para usar"}
                value={reducao}
                onChange={(e) => setReducao(e.target.value.replace(/[^0-9.]/g, ""))}
                disabled={!isReducaoActive}
              />
              {isReducaoActive && reducao && (
                <div className="bg-yellow-100 px-4 py-2 rounded-lg border border-yellow-200 text-sm">
                  <p className="font-bold text-yellow-800">Preview: R$ 89,90 &rarr; R$ {(89.9 * (1 - Number(reducao)/100)).toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => setShowPopUp(true)}
              disabled={loading || clientesSelecionados.length === 0}
              className="bg-sky-600 text-white h-14 px-12 rounded-xl font-bold text-lg shadow-xl hover:bg-sky-700 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <BsFiletypeDoc className="text-2xl" />
              {loading ? "Processando..." : `EMITIR NFCOM (${clientesSelecionados.length})`}
            </button>
          </div>
        </div>
      </main>

      {showPopUp && (
        <PopUpCancelNFSE
          setShowPopUp={setShowPopUp}
          showPopUp={showPopUp}
          setPassword={setPassword}
          password={password}
          cancelNFSE={emitirNFCom}
        />
      )}

      {showCertPasswordPopUp && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] bg-black/40">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm">
            <h2 className="text-lg font-bold mb-6">Senha do Certificado</h2>
            <input
              type="password"
              value={certPassword}
              onChange={(e) => setCertPassword(e.target.value)}
              className="w-full h-12 px-4 border rounded-lg mb-6 outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Senha PFX"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowCertPasswordPopUp(false); setCertPassword(""); }} className="px-4 font-bold text-gray-500">Cancelar</button>
              <button onClick={enviarCertificado} className="bg-sky-600 text-white px-8 py-2 rounded-lg font-bold">Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
