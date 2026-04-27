"use client";

import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import NavBar from "@/components/NavBar";
import { CiNoWaitingSign, CiSearch, CiCirclePlus } from "react-icons/ci";
import { BsFiletypeDoc } from "react-icons/bs";
import { BiCalendar, BiUser } from "react-icons/bi";
import { IoArrowUpCircleOutline } from "react-icons/io5";

import PopUpCancelNFSE from "../NFSE/components/PopUpCancelNFSE";
import PDFNFSE from "../NFSE/components/PDFNFSE";
import { useReactToPrint } from "react-to-print";
import SetPassword from "../NFSE/components/SetPassword";
import { useNotification } from "@/lib/NotificationContext";
import type { User } from "@/lib/auth";

export default function BuscarNfseGeradaClient({ user }: { user: User }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [ambiente, setAmbiente] = useState<string>("homologacao");
  const [showCertPasswordPopUp, setShowCertPasswordPopUp] = useState(false);
  const [certPassword, setCertPassword] = useState<string>("");
  const [searchCpf, setSearchCpf] = useState<string>("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");
  const [pdfDados, setPdfDados] = useState<any[]>([]);
  
  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: "NFSE",
  });

  const [clientesSelecionados, setClientesSelecionados] = useState<number[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [showCancelPopUp, setShowCancelPopUp] = useState(false);
  const [showPasswordPopUp, setShowPasswordPopUp] = useState(false);
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const { addJob, showError, showSuccess } = useNotification();

  const handleCheckboxChange = (clienteId: number) => {
    setClientesSelecionados((prev) =>
      prev.includes(clienteId)
        ? prev.filter((id) => id !== clienteId)
        : [...prev, clienteId]
    );
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

  const imprimir = async () => {
    try {
      setLoading(true);
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/nfse/imprimirNFSE`,
        {
          id: clientesSelecionados,
          ambiente: ambiente || "homologacao",
        },
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setPdfDados(resposta.data);
      
      // Wait for state update to render PDF component
      setTimeout(() => {
        handlePrint();
        setClientesSelecionados([]);
        setLoading(false);
      }, 500);
    } catch (erro) {
      console.error("Erro ao imprimir:", erro);
      showError("Erro ao preparar impressão.");
      setLoading(false);
    }
  };

  const setSessionPassword = async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/nfse/setSessionPassword`,
        { password },
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            "Content-Type": "application/json",
          },
        }
      );
      showSuccess("Senha da sessão atualizada.");
      handleSearch();
    } catch (erro) {
      console.error(erro);
      showError("Erro ao atualizar senha.");
    } finally {
      setShowPasswordPopUp(false);
    }
  };

  const cancelNFSE = async () => {
    try {
      setLoading(true);
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/nfse/cancelarNfse`,
        {
          id: clientesSelecionados,
          password: password,
          ambiente: ambiente || "homologacao",
        },
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (resposta.data.job) {
        addJob(resposta.data.job, "cancelamento");
        showSuccess("Cancelamento solicitado! Acompanhe nas notificações.");
      } else {
        showSuccess("Notas canceladas com sucesso!");
        handleSearch();
      }
    } catch (erro) {
      showError("Erro ao cancelar notas.");
      console.error(erro);
    } finally {
      setShowCancelPopUp(false);
      setLoading(false);
    }
  };

  const handleEnviarCertificado = () => {
    if (!arquivo) return;
    setShowCertPasswordPopUp(true);
  };

  const enviarCertificado = async () => {
    if (!arquivo || !certPassword) return;
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("certificado", arquivo);
      formData.append("password", certPassword);

      await axios.post(
        `${process.env.REACT_APP_URL}/nfse/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      showSuccess("Certificado enviado com sucesso!");
      setShowCertPasswordPopUp(false);
      setCertPassword("");
      setArquivo(null);
    } catch (erro) {
      console.error(erro);
      showError("Erro ao enviar certificado.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/nfse/BuscarNSFE`,
        {
          cpf: searchCpf.replace(/\D/g, ""),
          dateFilter: dataInicio && dataFim ? { start: dataInicio, end: dataFim } : null,
          ambiente: ambiente || "homologacao",
          status: status || null,
        },
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            "Content-Type": "application/json",
          },
        }
      );
      setClientes(resposta.data);
    } catch (erro) {
      console.error(erro);
      showError("Erro ao buscar NFSe.");
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
    setShowPasswordPopUp(true);
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen pb-10">
      <NavBar user={user} />

      <div className="bg-green-700 pb-32">
        <header className="py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Buscar NFS-e Geradas
            </h1>
            <p className="mt-2 text-sm text-green-100">
              Busque notas fiscais de serviço (NFS-e) geradas
            </p>
          </div>
        </header>
      </div>

      <main className="-mt-32">
        <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
            <div className="flex items-center mb-6">
              <CiSearch className="text-gray-600 text-2xl mr-2" />
              <h2 className="text-xl font-semibold text-gray-800">Busca Avançada</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><BiUser /></span>
                  <input
                    type="text"
                    value={searchCpf}
                    onChange={(e) => setSearchCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full pl-10 h-10 border rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><BiCalendar /></span>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full pl-10 h-10 border rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><BiCalendar /></span>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full pl-10 h-10 border rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Certificado PFX</label>
                <label className="flex items-center w-full px-3 h-10 border rounded-md cursor-pointer hover:bg-gray-50 bg-white">
                  <CiCirclePlus className="mr-2 text-xl text-gray-500" />
                  <span className="text-gray-500 text-sm truncate">
                    {arquivo ? arquivo.name : "Selecionar arquivo..."}
                  </span>
                  <input
                    type="file"
                    onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
                <select
                  value={ambiente}
                  onChange={(e) => setAmbiente(e.target.value)}
                  className="w-full h-10 border rounded-md px-3"
                >
                  <option value="producao">Produção</option>
                  <option value="homologacao">Homologação</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-10 border rounded-md px-3"
                >
                  <option value="">Todos</option>
                  <option value="Ativa">Ativa</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t">
               <button
                className="bg-indigo-600 text-white h-10 px-4 rounded hover:bg-indigo-500 flex items-center gap-2"
                onClick={() => setShowPasswordPopUp(true)}
              >
                <IoArrowUpCircleOutline className="text-xl" />
                Senha Sessão
              </button>
              <button
                className="bg-green-600 text-white h-10 px-4 rounded hover:bg-green-500 flex items-center gap-2 disabled:bg-gray-300"
                onClick={handleEnviarCertificado}
                disabled={!arquivo}
              >
                <IoArrowUpCircleOutline className="text-xl" />
                Upload PFX
              </button>
              <button
                onClick={handleClear}
                className="px-6 h-10 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
              >
                Limpar
              </button>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-8 h-10 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium flex items-center gap-2 disabled:bg-blue-300"
              >
                <CiSearch className="text-xl font-bold" />
                {loading ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </div>

          {clientes.length > 0 && (
            <div className="mt-8 bg-white shadow-xl rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-wrap gap-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Resultados: {clientes.length}
                </h2>
                <div className="flex gap-2">
                  <button
                    className="bg-slate-600 text-white py-2 px-4 rounded hover:bg-slate-500 flex items-center gap-2 text-sm disabled:opacity-50"
                    onClick={imprimir}
                    disabled={clientesSelecionados.length === 0 || clientesSelecionados.length > 1}
                  >
                    <BsFiletypeDoc />
                    Imprimir ({clientesSelecionados.length})
                  </button>
                  {user.permission >= 5 && (
                    <button
                      className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-500 flex items-center gap-2 text-sm disabled:opacity-50"
                      onClick={() => setShowCancelPopUp(true)}
                      disabled={clientesSelecionados.length === 0}
                    >
                      <CiNoWaitingSign />
                      Cancelar ({clientesSelecionados.length})
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto max-h-[600px]">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600"
                          checked={clientes.length > 0 && clientesSelecionados.length === clientes.length}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Nº NFSE</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Login</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Competência</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Data</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Valor</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {clientes.sort((a,b) => b.nfse.id - a.nfse.id).map((cliente) => (
                      <tr key={cliente.nfse.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600"
                            checked={clientesSelecionados.includes(cliente.nfse.id)}
                            onChange={() => handleCheckboxChange(cliente.nfse.id)}
                          />
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{cliente.nfse.id}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{cliente.nfse.numeroNfse}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{cliente.login}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{cliente.nfse.competencia}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(cliente.nfse.timestamp).toLocaleDateString("pt-BR")}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">R$ {cliente.nfse.valor_servico}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                            cliente.nfse.status === "Ativa" ? "bg-green-50 text-green-700 ring-green-600/20" : "bg-red-50 text-red-700 ring-red-600/20"
                          }`}>
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
            <div className="text-center mt-20 text-gray-500">
               <p className="text-lg">Nenhum resultado para exibir</p>
            </div>
          )}
        </div>
      </main>

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
        <div className="fixed inset-0 flex items-center justify-center z-[10000] bg-black/40">
          <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Senha do Certificado</h2>
            <input
              type="password"
              value={certPassword}
              onChange={(e) => setCertPassword(e.target.value)}
              className="block w-full border h-10 px-3 rounded mb-6 focus:ring-2 focus:ring-green-500"
              placeholder="Senha do PFX"
            />
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
                onClick={() => {
                  setShowCertPasswordPopUp(false);
                  setCertPassword("");
                }}
              >
                Cancelar
              </button>
              <button
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-bold"
                onClick={enviarCertificado}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden">
        <PDFNFSE ref={componentRef} dados={pdfDados} />
      </div>
    </div>
  );
}
