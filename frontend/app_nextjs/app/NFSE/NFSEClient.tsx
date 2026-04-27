"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import NavBar from "@/components/NavBar";
import Stacked from "./components/Stacked";
import Filter from "./components/Filter";
import { BsFiletypeDoc } from "react-icons/bs";
import PopUpButton from "./components/PopUpButton";
import Link from "next/link";
import { useNotification } from "@/lib/NotificationContext";
import type { User } from "@/lib/auth";

export default function NFSEClient({ user }: { user: User }) {
  const [dadosNFe, setDadosNFe] = useState({});
  const [arquivo, setArquivo] = useState<File | null>(null);

  // Estados para controlar envio do certificado e senha
  const [showCertPasswordPopUp, setShowCertPasswordPopUp] = useState(false);
  const [certPassword, setCertPassword] = useState<string>("");

  const [searchCpf, setSearchCpf] = useState<string>("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [aliquota, setAliquota] = useState("");
  const [lastNfe, setLastNfe] = useState<string>("");
  const [rpsNumber, setRpsNumber] = useState<string>("");
  const [service, setService] = useState("");
  const [loading, setLoading] = useState(false);
  const [ambiente, setAmbiente] = useState("homologacao");
  const [reducao, setReducao] = useState("");
  const [clientesSelecionados, setClientesSelecionados] = useState<number[]>([]);
  const [dateFilter, setDateFilter] = useState<{
    start: string;
    end: string;
  } | null>(null);
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

  const [showPopUp, setShowPopUp] = useState(false);
  const [password, setPassword] = useState<string>(""); 
  const { addJob, showError, showSuccess } = useNotification();

  const handleCheckboxChange = (titulo: number) => {
    setClientesSelecionados((prev) => {
      if (prev.includes(titulo)) {
        return prev.filter((id) => id !== titulo);
      } else {
        return [...prev, titulo];
      }
    });
  };

  const handleSelectAll = () => {
    if (clientesSelecionados.length === clientes.length) {
      setClientesSelecionados([]);
    } else {
      const titulosValidos = clientes
        .filter((cliente) => cliente.fatura && cliente.fatura.titulo)
        .map((cliente) => cliente.fatura.titulo);
      setClientesSelecionados(titulosValidos);
    }
  };

  const handleSearch = async () => {
    const searchCpfRegex = searchCpf.replace(/\D/g, "");
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/nfse/BuscarClientes`,
        {
          cpf: searchCpfRegex,
          filters: activeFilters,
          dateFilter: dateFilter,
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
      console.error("Erro ao Buscar Clientes:", erro);
      showError("Erro ao buscar clientes.");
    }
  };

  const emitirNFe = async () => {
    try {
      setLoading(true);
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/nfse/`,
        {
          password,
          clientesSelecionados,
          aliquota,
          service,
          reducao,
          ambiente,
          lastNfe,
          rpsNumber,
        },
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            "Content-Type": "application/json",
          },
          timeout: 480000,
        }
      );
      
      if (resposta.data.job) {
        addJob(resposta.data.job, "emissao");
        showSuccess("Solicitação enviada! Processando em segundo plano.");
      } else {
        showSuccess("NF-e emitida com sucesso.");
      }
    } catch (erro: any) {
      console.error("Erro ao emitir NF-e:", erro);
      const msg = erro.response?.data?.erro || "Erro desconhecido ao emitir NF-e.";
      showError(`Erro: ${msg}`);
    } finally {
      setShowPopUp(false);
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
      const formData = new FormData();
      formData.append("arquivo", arquivo);
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
    } catch (erro) {
      console.error("Erro ao enviar o certificado:", erro);
      showError("Não foi possível enviar o certificado.");
      setShowCertPasswordPopUp(false);
    }
  };

  const handleOpenPopup = () => {
    if (!lastNfe) {
      alert("Por favor, preencha o campo 'Ultima NF-e'.");
      return;
    }
    setShowPopUp(true);
  };

  let valueSome = 0;

  return (
    <div className="bg-gray-50 min-h-screen">
      <NavBar user={user} />
      <Stacked setSearchCpf={setSearchCpf} onSearch={handleSearch} />
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
        <Link href="/BuscarNfseGerada">
          <button className="bg-violet-700 text-white py-3 px-8 rounded-lg hover:bg-violet-600 transition-all shadow-md">
            NF-es Geradas
          </button>
        </Link>
      </div>

      <Filter
        setActiveFilters={setActiveFilters}
        setDate={setDateFilter}
        setArquivo={setArquivo}
        enviarCertificado={handleEnviarCertificado}
        user={user}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {clientes.length > 0 && (
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Total de Resultados: {clientes.length}
          </h2>
        )}

        {loading && (
          <div className="flex justify-center my-8">
            <span className="text-gray-500 animate-pulse">Processando emissão...</span>
          </div>
        )}

        {clientes.length > 0 ? (
          <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg bg-white">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      checked={clientesSelecionados.length > 0 && clientesSelecionados.length === clientes.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Título</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Login</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Vencimento</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tipo</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Valor</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clientes.map((cliente) => {
                  valueSome += Number(cliente.fatura.valor);
                  return (
                    <tr key={cliente.fatura.titulo}>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                          checked={clientesSelecionados.includes(cliente.fatura.titulo)}
                          onChange={() => handleCheckboxChange(cliente.fatura.titulo)}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{cliente.fatura.titulo}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{cliente.login}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{cliente.fatura.datavenc}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{cliente.fatura.tipo}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">R$ {cliente.fatura.valor}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {cliente.cli_ativado === "s" ? "Ativo" : "Inativo"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 mt-10">Nenhum cliente encontrado</p>
        )}

        <div className="mt-8 bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-6">
            Valores Somados: <span className="text-green-600 font-bold">R$ {valueSome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
               <select
                onChange={(e) => setAmbiente(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border p-2"
                value={ambiente}
              >
                <option value="homologacao">Homologação</option>
                <option value="producao">Produção</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alíquota (%)</label>
              <input
                type="text"
                onChange={(e) => setAliquota(e.target.value)}
                placeholder="Ex: 5.0000"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Serviço</label>
              <input
                type="text"
                onChange={(e) => setService(e.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, ""))}
                placeholder="Servico de Manutencao"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Redução (%)</label>
              <input
                type="text"
                onChange={(e) => setReducao(e.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, ""))}
                placeholder="Ex: 60"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-red-700 mb-1 font-bold">Último Número NF-e *</label>
              <input
                type="text"
                required
                onChange={(e) => setLastNfe(e.target.value.normalize("NFD").replace(/[^a-zA-Z0-9 ]/g, ""))}
                placeholder="Última NF-e emitida"
                className="w-full rounded-md border-red-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm h-10 border p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">Número RPS (Opcional)</label>
              <input
                type="text"
                onChange={(e) => setRpsNumber(e.target.value.normalize("NFD").replace(/[^a-zA-Z0-9 ]/g, ""))}
                placeholder="Número RPS"
                className="w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 border p-2"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              className="bg-indigo-600 text-white py-4 px-20 rounded-lg hover:bg-indigo-500 transition-all shadow-lg flex items-center gap-3 font-bold"
              onClick={handleOpenPopup}
              disabled={loading}
            >
              <BsFiletypeDoc className="text-2xl" />
              EMITIR NFSE
            </button>
          </div>
        </div>
      </div>

      {showPopUp && (
        <PopUpButton
          setShowPopUp={setShowPopUp}
          showPopUp={showPopUp}
          setPassword={setPassword}
          password={password}
          emitirNFe={emitirNFe}
        />
      )}

      {showCertPasswordPopUp && (
        <div className="fixed inset-0 flex items-center justify-center z-[10000] bg-black/30">
          <div className="bg-white p-6 rounded-md shadow-lg w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-4">Senha do Certificado</h2>
            <input
              type="password"
              value={certPassword}
              onChange={(e) => setCertPassword(e.target.value)}
              className="block w-full border p-2 rounded mb-6 h-10"
              placeholder="Senha do PFX"
            />
            <div className="flex justify-end gap-3">
              <button
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                onClick={() => {
                  setShowCertPasswordPopUp(false);
                  setCertPassword("");
                }}
              >
                Cancelar
              </button>
              <button
                className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-400"
                onClick={enviarCertificado}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
