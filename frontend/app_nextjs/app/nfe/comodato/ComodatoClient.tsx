"use client";

import React, { useState } from "react";
import axios from "axios";
import NavBar from "@/components/NavBar";
import Stacked from "../components/Stacked";
import Link from "next/link";
import { useNotification } from "@/lib/NotificationContext";
import type { User } from "@/lib/auth";

export default function ComodatoClient({ user }: { user: User }) {
  const { showSuccess, showError, addJob } = useNotification();

  const [searchCpf, setSearchCpf] = useState("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [clientesSelecionados, setClientesSelecionados] = useState<any[]>([]);

  const [ambiente, setAmbiente] = useState("homologacao");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const searchCpfRegex = searchCpf.replace(/\D/g, "");
    try {
      setLoading(true);
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/buscarAtivos`,
        { cpf: searchCpfRegex },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      
      const clientesOrdenados = [...resposta.data].sort((a: any, b: any) => {
        const nomeA = (a.nome || a.razao_social || "").toLowerCase();
        const nomeB = (b.nome || b.razao_social || "").toLowerCase();
        return nomeA.localeCompare(nomeB);
      });
      
      setClientes(clientesOrdenados);
      setClientesSelecionados([]);
    } catch (erro) {
      console.error("Erro ao Buscar Clientes:", erro);
      showError("Erro ao buscar clientes.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (client: any) => {
    setClientesSelecionados((prev) => {
      const exists = prev.find((c) => c.id === client.id);
      if (exists) {
        return prev.filter((c) => c.id !== client.id);
      } else {
        return [...prev, client];
      }
    });
  };

  const handleSelectAll = () => {
    if (clientesSelecionados.length === clientes.length) {
      setClientesSelecionados([]);
    } else {
      setClientesSelecionados([...clientes]);
    }
  };

  const emitirNFe = async () => {
    if (!password) {
      showError("Digite a senha do certificado.");
      return;
    }

    if (clientesSelecionados.length === 0) {
      showError("Selecione pelo menos um cliente.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        logins: clientesSelecionados.map((c) => c.login),
        password,
        ambiente,
      };

      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/comodato/saida`,
        payload,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      if (resposta.data.job) {
        addJob(resposta.data.job, "emissao");
        showSuccess("Emissão iniciada em segundo plano! Acompanhe nas notificações.");
      } else {
        showSuccess("Processamento iniciado.");
      }

      setPassword("");
      setClientesSelecionados([]);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || "Erro ao iniciar emissão NFE.";
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar user={user} />
      
      <Stacked
        setSearchCpf={setSearchCpf}
        onSearch={handleSearch}
        title="NFe de Comodato (Saída)"
        color="bg-purple-600"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        <Link href="/BuscarNfe">
          <button className="bg-violet-700 text-white py-3 px-10 rounded-lg hover:bg-violet-600 transition-all shadow-md font-bold">
            Buscar Notas Emitidas
          </button>
        </Link>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {clientes.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-10">
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
              <div className="flex gap-4">
                <span className="text-sm font-medium text-gray-600">Total: <strong>{clientes.length}</strong></span>
                <span className="text-sm font-medium text-blue-600">Selecionados: <strong>{clientesSelecionados.length}</strong></span>
              </div>
              <button 
                onClick={handleSelectAll}
                className="text-sm text-indigo-600 font-bold hover:text-indigo-500"
              >
                {clientesSelecionados.length === clientes.length ? "Desmarcar Todos" : "Selecionar Todos"}
              </button>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-4 border-b"></th>
                    <th className="p-4 border-b text-sm font-bold text-gray-700">Nome/Razão Social</th>
                    <th className="p-4 border-b text-sm font-bold text-gray-700">Login</th>
                    <th className="p-4 border-b text-sm font-bold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clientes.map((c) => (
                    <tr key={c.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          className="size-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={!!clientesSelecionados.find((sel) => sel.id === c.id)}
                          onChange={() => handleCheckboxChange(c)}
                        />
                      </td>
                      <td className="p-4 text-sm text-gray-800 font-medium">{c.nome || c.razao_social}</td>
                      <td className="p-4 text-sm text-gray-600">{c.login}</td>
                      <td className="p-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${c.cli_ativado === 's' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {c.cli_ativado === "s" ? "ATIVO" : "INATIVO"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-8 pb-2 border-b">Configurações de Emissão</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Ambiente de Sefaz</label>
              <select
                className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value)}
              >
                <option value="homologacao">Homologação (Teste)</option>
                <option value="producao">Produção (Real)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Senha do Certificado Digital</label>
              <input
                type="password"
                className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Senha PFX"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={emitirNFe}
              disabled={loading || clientesSelecionados.length === 0}
              className={`h-14 px-12 rounded-xl text-white font-bold text-lg shadow-xl transition-all active:scale-95 flex items-center gap-3 ${
                loading || clientesSelecionados.length === 0
                  ? "bg-gray-300 cursor-not-allowed shadow-none"
                  : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200"
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processando...
                </>
              ) : (
                `EMITIR NFE PARA ${clientesSelecionados.length} CLIENTE(S)`
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
