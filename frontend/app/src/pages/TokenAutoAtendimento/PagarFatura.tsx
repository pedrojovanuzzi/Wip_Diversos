import React, { useState, useRef, useEffect } from "react";
import {
  HiArrowLeft,
  HiChip,
  HiUser,
  HiHome,
  HiCheck,
  HiClipboardCopy,
} from "react-icons/hi";
import { Link, useNavigate } from "react-router-dom";
import { Keyboard } from "./components/Keyboard";
import axios from "axios";
import { FaSpinner } from "react-icons/fa";

interface Client {
  id: number;
  nome: string;
  cpf: string;
  endereco?: {
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
  };
  plano?: string;
  contratoId?: number;
}

export const PagarFatura = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"search" | "selection">("search");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Input ref to keep focus if needed, though we primarily use virtual keyboard
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyPress = (key: string) => {
    if (step !== "search") return;

    if (key === "BACKSPACE") {
      setCpf((prev) => prev.slice(0, -1));
    } else if (key === "ENTER") {
      handleSearch();
    } else if (key === "SPACE") {
      // CPF usually doesn't have spaces, but we can allow it or ignore
    } else if (key.length === 1 && /[0-9]/.test(key)) {
      // Only allow numbers for CPF
      if (cpf.length < 11) {
        setCpf((prev) => prev + key);
      }
    } else if (key.length === 1 && !/[a-zA-Z]/.test(key)) {
      // Allow other chars if needed, but primarily blocking letters if strict
      // For now, let's strictly allow only numbers as it's a CPF field
    }
  };

  const handleSearch = async () => {
    if (cpf.length !== 11) {
      setError("CPF deve ter 11 dígitos.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/TokenAutoAtendimento/Login`,
        { cpf } // Sending raw CPF digits
      );

      // Assuming backend returns { data: Client[] } or just Client[]
      // Adjust based on actual response structure.
      // If response is just the array:
      const data = Array.isArray(response.data)
        ? response.data
        : response.data.clients || [response.data];

      if (!data || data.length === 0) {
        setError("Nenhum cadastro encontrado para este CPF.");
      } else {
        setClients(data);
        setStep("selection");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Erro ao buscar cadastro.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = async (client: Client) => {
    setLoading(true);
    try {
      // Using ChooseHome as requested to select the context
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/TokenAutoAtendimento/ChooseHome`,
        { ...client } // Sending full client object or ID as required
      );

      // Navigate to the next step - likely the actual payment or invoice list
      // For now, we'll placeholder this navigation
      // navigate("/TokenAutoAtendimento/faturas");
      // alert(`Cadastro de ${client.nome} selecionado! Redirecionando...`);
      // Since I don't know the exact next route, I'll leave it as an alert for now
      console.log(response.data);
      setSelectedClient(response.data);
      //selectedClient.login
      // or navigate back to home if that's the flow
    } catch (err: any) {
      console.error(err);
      setError("Erro ao selecionar cadastro.");
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black opactiy-80"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
      </div>

      {/* Kiosk Frame */}
      <div className="relative z-10 w-[90vw] max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-[800px] border-t-white/20 border-l-white/20">
        {/* Glow Effects */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4 bg-slate-900/40 border-b border-white/5">
          <div className="flex items-center space-x-3 text-cyan-400">
            <Link
              to="/TokenAutoAtendimento"
              className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors"
            >
              <HiArrowLeft className="text-2xl" />
            </Link>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-wider text-white">
                PAGAR FATURA
              </span>
              <span className="text-[10px] tracking-[0.2em] text-cyan-300 uppercase">
                {step === "search" ? "Identificação" : "Seleção de Cadastro"}
              </span>
            </div>
          </div>
          <HiChip className="text-4xl text-cyan-400/50" />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {step === "search" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">
                  Digite seu CPF
                </h2>
                <p className="text-slate-400 text-sm">
                  Use o teclado abaixo para digitar os números
                </p>
              </div>

              <div className="w-full max-w-sm relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-slate-900 border border-white/10 rounded-xl p-4 flex items-center shadow-xl">
                  <HiUser className="text-2xl text-cyan-400 mr-3" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={formatCPF(cpf)}
                    readOnly
                    placeholder="000.000.000-00"
                    className="bg-transparent border-none outline-none text-3xl font-mono text-white placeholder-slate-600 w-full text-center tracking-wider"
                  />
                </div>
              </div>

              <button
                onClick={handleSearch}
                disabled={loading || cpf.length !== 11}
                className={`
                  w-full max-w-sm py-4 rounded-xl font-bold text-lg tracking-wide uppercase transition-all transform shadow-lg
                  flex items-center justify-center space-x-2
                  ${
                    loading || cpf.length !== 11
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-cyan-500/50 active:scale-95"
                  }
                `}
              >
                {loading ? (
                  <>
                    <FaSpinner className="animate-spin text-xl" />
                    <span>Buscando...</span>
                  </>
                ) : (
                  <span>Continuar</span>
                )}
              </button>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm text-center max-w-sm w-full animate-shake">
                  {error}
                </div>
              )}
            </div>
          )}

          {step === "selection" && (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
              <h3 className="text-white text-lg font-bold mb-4 px-2">
                Cadastros Encontrados:
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className="
                      group relative overflow-hidden bg-slate-800/50 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/50 
                      rounded-2xl p-5 text-left transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-900/20
                    "
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                          <HiHome className="text-2xl text-cyan-400" />
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-300 transition-colors">
                            {client.nome}
                          </h4>
                          <p className="text-slate-400 text-sm mb-2">
                            {client.cpf}
                          </p>
                          {client.endereco && (
                            <p className="text-slate-500 text-xs flex flex-col">
                              <span>
                                {client.endereco.rua}, {client.endereco.numero}
                              </span>
                              <span>
                                {client.endereco.bairro} -{" "}
                                {client.endereco.cidade}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-cyan-500 rounded-full p-2">
                        <HiCheck className="text-white text-xl" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-8 text-center">
                <button
                  onClick={() => {
                    setStep("search");
                    setError("");
                    setClients([]);
                  }}
                  className="text-slate-400 hover:text-white text-sm hover:underline"
                >
                  Buscar outro CPF
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Keyboard Area - Only show in search step */}
        {step === "search" && (
          <div className="bg-slate-900/90 border-t border-white/10 p-2 z-20">
            <Keyboard onKeyPress={handleKeyPress} />
          </div>
        )}
      </div>
    </div>
  );
};
