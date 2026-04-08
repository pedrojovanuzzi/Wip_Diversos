import React, { useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { FaSearch, FaFileSignature, FaExternalLinkAlt, FaCheckCircle, FaTimesCircle, FaSpinner } from "react-icons/fa";

interface ClienteInfo {
  login: string;
  nome: string;
  cpf_cnpj: string;
  rg: string;
  email: string;
  celular: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  plano: string;
  venc: string;
  termo: string;
}

interface DocResult {
  servico: string;
  sign_url: string | null;
  token: string | null;
  second_signer_url: string | null;
}

interface GerarResult {
  cliente: { login: string; nome: string };
  docs: DocResult[];
  erros: Record<string, string>;
}

export const ZapSignTeste = () => {
  const [login, setLogin] = useState("");
  const [cliente, setCliente] = useState<ClienteInfo | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<GerarResult | null>(null);

  const { user } = useAuth();
  const token = user?.token;
  const { showError, showSuccess } = useNotification();

  const buscarCliente = async () => {
    if (!login.trim()) {
      showError("Digite o login do cliente.");
      return;
    }
    setBuscando(true);
    setCliente(null);
    setResultado(null);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_URL}/zapsign/test/cliente/${login.trim()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCliente(res.data);
    } catch (e: any) {
      showError(e.response?.data?.error || "Cliente não encontrado.");
    } finally {
      setBuscando(false);
    }
  };

  const gerarTodos = async () => {
    if (!cliente) return;
    setGerando(true);
    setResultado(null);
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_URL}/zapsign/test/gerar-todos`,
        { login: cliente.login },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResultado(res.data);
      showSuccess("Documentos gerados!");
    } catch (e: any) {
      showError(e.response?.data?.error || "Erro ao gerar documentos.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <NavBar />
      <div className="flex-grow p-4 sm:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-amber-500 p-6 text-white flex items-center gap-3">
              <FaFileSignature className="text-3xl" />
              <div>
                <h1 className="text-2xl font-bold uppercase tracking-tight">Teste de Documentos ZapSign</h1>
                <p className="text-amber-100 text-xs font-medium">Gerar todos os tipos de documento a partir de um cliente</p>
              </div>
            </div>

            <div className="p-8">
              {/* Busca */}
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Digite o LOGIN do cliente..."
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscarCliente()}
                  className="flex-1 bg-gray-50 border-2 border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 p-4 font-semibold"
                  disabled={buscando || gerando}
                />
                <button
                  onClick={buscarCliente}
                  disabled={buscando || gerando}
                  className="px-6 py-4 bg-amber-500 text-white rounded-xl font-black uppercase text-xs tracking-wider hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {buscando ? <FaSpinner className="animate-spin" /> : <FaSearch />}
                  Buscar
                </button>
              </div>

              {/* Dados do cliente */}
              {cliente && (
                <div className="mt-6 p-6 bg-gray-50 rounded-2xl border border-gray-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Dados do Cliente</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {[
                      ["Nome", cliente.nome],
                      ["Login", cliente.login],
                      ["CPF/CNPJ", cliente.cpf_cnpj],
                      ["RG", cliente.rg],
                      ["E-mail", cliente.email],
                      ["Celular", cliente.celular],
                      ["Endereço", `${cliente.endereco}, ${cliente.numero}`],
                      ["Bairro", cliente.bairro],
                      ["Cidade/UF", `${cliente.cidade}/${cliente.estado}`],
                      ["CEP", cliente.cep],
                      ["Plano", cliente.plano],
                      ["Vencimento", `Dia ${cliente.venc}`],
                      ["Termo", cliente.termo || "—"],
                    ].map(([label, val]) => (
                      <div key={label} className="bg-white p-3 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase block">{label}</span>
                        <span className="font-semibold text-gray-800">{val || "—"}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={gerarTodos}
                    disabled={gerando}
                    className="mt-6 w-full py-4 bg-amber-500 text-white rounded-xl font-black uppercase text-xs tracking-wider hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                  >
                    {gerando ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        Gerando todos os documentos...
                      </>
                    ) : (
                      <>
                        <FaFileSignature />
                        Gerar Todos os Documentos
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Resultados */}
          {resultado && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-black uppercase tracking-tight text-gray-800">
                  Resultados — {resultado.cliente.nome}
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {resultado.docs.map((doc, i) => (
                  <div key={i} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <FaCheckCircle className="text-green-500 text-lg" />
                      <span className="font-bold text-sm text-gray-800">{doc.servico}</span>
                    </div>
                    <div className="flex gap-2">
                      {doc.sign_url && (
                        <a
                          href={doc.sign_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-200 transition-colors flex items-center gap-1"
                        >
                          <FaExternalLinkAlt className="text-[10px]" />
                          Assinar
                        </a>
                      )}
                      {doc.second_signer_url && (
                        <a
                          href={doc.second_signer_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-200 transition-colors flex items-center gap-1"
                        >
                          <FaExternalLinkAlt className="text-[10px]" />
                          2o Signatário
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {Object.entries(resultado.erros).map(([servico, msg]) => (
                  <div key={servico} className="p-5 flex items-center justify-between hover:bg-red-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <FaTimesCircle className="text-red-500 text-lg" />
                      <span className="font-bold text-sm text-gray-800">{servico}</span>
                    </div>
                    <span className="text-xs text-red-600 font-semibold max-w-[400px] truncate" title={msg}>{msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
