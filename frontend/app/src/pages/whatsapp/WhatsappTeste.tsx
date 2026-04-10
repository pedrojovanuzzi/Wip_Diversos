import React, { useState, useEffect } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import {
  FaWhatsapp,
  FaPlay,
  FaCheckCircle,
  FaTimesCircle,
  FaSpinner,
  FaRobot,
  FaUser,
  FaFileSignature,
  FaSearch,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

interface BotMessage {
  jobName: string;
  text: string;
  type: string;
}

interface StepResult {
  step: number;
  label: string;
  userInput: string;
  botMessages: BotMessage[];
  sessionStage: string;
  status: "ok" | "error";
  error?: string;
}

interface SimulationResult {
  flow: string;
  description: string;
  totalSteps: number;
  cliente?: { login: string; nome: string; cpf_cnpj: string } | null;
  steps: StepResult[];
}

interface FlowInfo {
  name: string;
  description: string;
  requiresLogin: boolean;
}

interface ClienteInfo {
  login: string;
  nome: string;
  cpf_cnpj: string;
  rg: string;
  email: string;
  celular: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  plano: string;
  venc: string;
}

export const WhatsappTeste = () => {
  const [flows, setFlows] = useState<FlowInfo[]>([]);
  const [login, setLogin] = useState("");
  const [cliente, setCliente] = useState<ClienteInfo | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingFlow, setLoadingFlow] = useState<string | null>(null);
  const [results, setResults] = useState<SimulationResult[]>([]);

  const { user } = useAuth();
  const token = user?.token;
  const { showError, showSuccess } = useNotification();
  const navigate = useNavigate();

  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_URL}/whatsapp-test/flows`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFlows(res.data);
    } catch (e: any) {
      showError("Erro ao carregar fluxos.");
    }
  };

  const buscarCliente = async () => {
    if (!login.trim()) {
      showError("Digite o login do cliente.");
      return;
    }
    setBuscando(true);
    setCliente(null);
    setResults([]);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_URL}/whatsapp-test/cliente/${login.trim()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCliente(res.data);
      showSuccess(`Cliente "${res.data.nome}" encontrado!`);
    } catch (e: any) {
      showError(e.response?.data?.error || "Cliente não encontrado.");
    } finally {
      setBuscando(false);
    }
  };

  const runFlow = async (flowName: string) => {
    const flow = flows.find((f) => f.name === flowName);
    if (flow?.requiresLogin && !cliente) {
      showError(`O fluxo "${flowName}" requer um cliente. Busque pelo login primeiro.`);
      return;
    }

    setLoadingFlow(flowName);
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_URL}/whatsapp-test/simulate`,
        { flowName, login: cliente?.login || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResults((prev) => {
        const filtered = prev.filter((r) => r.flow !== flowName);
        return [...filtered, res.data];
      });
    } catch (e: any) {
      showError(e.response?.data?.error || "Erro ao simular fluxo.");
    } finally {
      setLoadingFlow(null);
    }
  };

  const runAll = async () => {
    setLoading(true);
    setResults([]);
    for (const flow of flows) {
      if (flow.requiresLogin && !cliente) continue;
      try {
        const res = await axios.post(
          `${process.env.REACT_APP_URL}/whatsapp-test/simulate`,
          { flowName: flow.name, login: cliente?.login || undefined },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setResults((prev) => [...prev, res.data]);
      } catch (e: any) {
        setResults((prev) => [
          ...prev,
          {
            flow: flow.name,
            description: flow.description,
            totalSteps: 0,
            steps: [
              {
                step: 1,
                label: "Erro",
                userInput: "",
                botMessages: [],
                sessionStage: "",
                status: "error" as const,
                error: e.response?.data?.error || e.message,
              },
            ],
          },
        ]);
      }
    }
    setLoading(false);
  };

  const getFlowStatus = (result: SimulationResult) => {
    return result.steps.some((s) => s.status === "error") ? "error" : "ok";
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <NavBar />
      <div className="flex-grow p-4 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Navigation */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gray-800 p-4 text-white">
              <h2 className="text-sm font-black uppercase tracking-widest">Ambiente de Testes</h2>
            </div>
            <div className="p-4 flex gap-3">
              <button
                onClick={() => navigate("/zapsign-teste")}
                className="flex items-center gap-2 px-5 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-all"
              >
                <FaFileSignature />
                Documentos ZapSign
              </button>
              <button
                className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all"
                disabled
              >
                <FaWhatsapp />
                Fluxos WhatsApp
              </button>
            </div>
          </div>

          {/* Header */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-green-600 p-6 text-white flex items-center gap-3">
              <FaWhatsapp className="text-3xl" />
              <div>
                <h1 className="text-2xl font-bold uppercase tracking-tight">
                  Teste de Fluxos WhatsApp
                </h1>
                <p className="text-green-100 text-xs font-medium">
                  Simular conversas do bot sem enviar mensagens reais
                </p>
              </div>
            </div>

            <div className="p-8">
              {/* Login Search */}
              <div className="flex gap-3 mb-6">
                <input
                  type="text"
                  placeholder="Digite o LOGIN (PPPoE) do cliente..."
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscarCliente()}
                  className="flex-1 bg-gray-50 border-2 border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 p-4 font-semibold"
                  disabled={buscando || loading}
                />
                <button
                  onClick={buscarCliente}
                  disabled={buscando || loading}
                  className="px-6 py-4 bg-green-600 text-white rounded-xl font-black uppercase text-xs tracking-wider hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {buscando ? <FaSpinner className="animate-spin" /> : <FaSearch />}
                  Buscar
                </button>
              </div>

              {/* Client Info */}
              {cliente && (
                <div className="mb-6 p-5 bg-green-50 rounded-2xl border border-green-200">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                    Dados do Cliente
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    {[
                      ["Nome", cliente.nome],
                      ["Login", cliente.login],
                      ["CPF/CNPJ", cliente.cpf_cnpj],
                      ["Celular", cliente.celular],
                      ["Endereço", `${cliente.endereco}, ${cliente.numero}`],
                      ["Bairro", cliente.bairro],
                      ["Cidade/UF", `${cliente.cidade}/${cliente.estado}`],
                      ["Plano", cliente.plano],
                    ].map(([label, val]) => (
                      <div key={label} className="bg-white p-2 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase block">{label}</span>
                        <span className="font-semibold text-gray-800 text-xs">{val || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Run All Button */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={runAll}
                  disabled={loading || !!loadingFlow}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl font-black uppercase text-xs tracking-wider hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? <FaSpinner className="animate-spin" /> : <FaPlay />}
                  Executar Todos
                </button>
              </div>

              {/* Flow Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {flows.map((flow) => {
                  const result = results.find((r) => r.flow === flow.name);
                  const isRunning = loadingFlow === flow.name;
                  const status = result ? getFlowStatus(result) : null;
                  const needsLogin = flow.requiresLogin && !cliente;

                  return (
                    <button
                      key={flow.name}
                      onClick={() => runFlow(flow.name)}
                      disabled={loading || !!loadingFlow}
                      className={`p-4 rounded-xl border-2 text-left transition-all disabled:opacity-50 hover:shadow-md ${
                        status === "ok"
                          ? "border-green-300 bg-green-50"
                          : status === "error"
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200 bg-white hover:border-green-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-gray-800">
                          {flow.name}
                        </span>
                        {isRunning && <FaSpinner className="animate-spin text-green-600" />}
                        {status === "ok" && <FaCheckCircle className="text-green-500" />}
                        {status === "error" && <FaTimesCircle className="text-red-500" />}
                      </div>
                      <p className="text-[11px] text-gray-500">{flow.description}</p>
                      {needsLogin && (
                        <p className="text-[10px] text-amber-600 font-semibold mt-1">
                          Requer login do cliente
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Results */}
          {results.map((result) => (
            <div key={result.flow} className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div
                className={`p-4 flex items-center justify-between ${
                  getFlowStatus(result) === "ok"
                    ? "bg-green-50 border-b border-green-100"
                    : "bg-red-50 border-b border-red-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  {getFlowStatus(result) === "ok" ? (
                    <FaCheckCircle className="text-green-500 text-lg" />
                  ) : (
                    <FaTimesCircle className="text-red-500 text-lg" />
                  )}
                  <h2 className="font-black text-sm uppercase tracking-tight text-gray-800">
                    {result.flow}
                  </h2>
                  {result.cliente && (
                    <span className="text-xs text-gray-500 ml-2">
                      ({result.cliente.nome} - {result.cliente.cpf_cnpj})
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{result.totalSteps} passos</span>
              </div>

              <div className="p-4 space-y-4">
                {result.steps.map((step) => (
                  <div key={step.step} className="space-y-2">
                    {/* Step Label */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          step.status === "ok" ? "bg-green-500" : "bg-red-500"
                        }`}
                      >
                        {step.step}
                      </span>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {step.label}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        stage: {step.sessionStage}
                      </span>
                    </div>

                    {/* User Message */}
                    {step.userInput && (
                      <div className="flex justify-end">
                        <div className="bg-green-100 text-green-900 rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%] text-sm flex items-start gap-2">
                          <FaUser className="text-green-600 mt-0.5 flex-shrink-0 text-xs" />
                          <span className="font-medium">{step.userInput}</span>
                        </div>
                      </div>
                    )}

                    {/* Bot Messages */}
                    {step.botMessages.map((msg, mi) => (
                      <div key={mi} className="flex justify-start">
                        <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%] text-sm flex items-start gap-2">
                          <FaRobot className="text-gray-500 mt-0.5 flex-shrink-0 text-xs" />
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">
                              {msg.type}
                            </span>
                            <span className="whitespace-pre-wrap">{msg.text}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Error */}
                    {step.error && (
                      <div className="bg-red-100 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-700 font-semibold">
                        Erro: {step.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
