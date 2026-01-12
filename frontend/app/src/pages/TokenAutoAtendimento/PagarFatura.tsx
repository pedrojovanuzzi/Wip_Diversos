import React, { useState, useRef, useEffect } from "react";
import {
  HiArrowLeft,
  HiChip,
  HiUser,
  HiHome,
  HiCheck,
  HiCreditCard,
  HiCurrencyDollar,
} from "react-icons/hi";
import { Link, useNavigate } from "react-router-dom";
import { Keyboard } from "./components/Keyboard";
import axios from "axios";
import { FaSpinner, FaBarcode } from "react-icons/fa";
import { QRCodeCanvas } from "qrcode.react";

interface Client {
  id: number;
  nome: string;
  cpf_cnpj: string;
  login: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
}

export const PagarFatura = () => {
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState("");
  const [valorPagamento, setValorPagamento] = useState("");
  const [step, setStep] = useState<
    | "search"
    | "selection"
    | "method"
    | "payment-pix"
    | "payment-card"
    | "payment-success"
  >("search");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [faturaId, setFaturaId] = useState<number | null>(null);
  const [cardMessage, setCardMessage] = useState(
    "Insira o cartão na maquininha e siga as instruções."
  );

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

      const data = Array.isArray(response.data)
        ? response.data
        : response.data.clients || [response.data];

      if (!data || data.length === 0) {
        setError("Nenhum cadastro encontrado para este CPF.");
      } else {
        setClients(data);
        console.log(data);
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
      // 1. Select Context
      await axios.post(
        `${process.env.REACT_APP_URL}/TokenAutoAtendimento/ChooseHome`,
        { ...client }
      );

      setSelectedClient(client);
      setStep("method"); // Move to payment method selection
    } catch (err: any) {
      console.error(err);
      setError("Erro ao selecionar cadastro.");
    } finally {
      setLoading(false);
    }
  };

  const handleMethodSelect = async (method: "pix" | "card") => {
    if (!selectedClient) return;

    if (method === "card") {
      setStep("payment-card");
      setCardMessage("Aguardando comunicação com a maquininha...");
      try {
        const response = await axios.post(
          `${process.env.REACT_APP_URL}/TokenAutoAtendimento/ObterListaTerminaisEGerarPagamento`,
          {
            login: selectedClient.login,
          }
        );

        if (response.status === 200) {
          setCardMessage("Termine o processo na maquininha.");
          // Se response.data for o número direto (como visto nos logs), usamos ele.
          // Caso contrário, tentamos pegar faturaId se for um objeto.
          const id =
            typeof response.data === "object"
              ? response.data.faturaId
              : response.data;
          setFaturaId(id);
        }
      } catch (error) {
        console.error(error);
        setError("Erro ao iniciar pagamento Cartão.");
      }
      return;
    }

    // Method is PIX
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/TokenAutoAtendimento/GerarPixToken`,
        {
          cpf: cpf,
          login: selectedClient.login,
          perdoarJuros: false,
        }
      );

      console.log(response.data);

      const valor = response.data.valor;
      const qrCode = response.data.imagem;
      setQrCode(qrCode);
      setValorPagamento(valor);
      setFaturaId(response.data.faturaId);
      // API request sent successfully.
      // User requested NOT to show QR Code, so we assume the backend handles the display/process or it's displayed on a terminal.
      setStep("payment-pix");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Erro ao iniciar pagamento Pix.");
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

  const formatCurrency = (value: string | number) => {
    if (!value) return "R$ 0,00";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return typeof value === "string" ? value : "R$ 0,00";
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  useEffect(() => {
    let intervalId: NodeJS.Timer;

    if (faturaId) {
      const checkPayment = async () => {
        try {
          const response = await axios.post(
            `${process.env.REACT_APP_URL}/TokenAutoAtendimento/FaturaWentPaid`,
            { faturaId }
          );

          // Payment confirmed
          setStep("payment-success");
        } catch (error) {
          console.log("Aguardando pagamento...", error);
        }
      };

      // Initial check
      checkPayment();

      // Poll every 3 seconds: setInterval guarantees execution
      intervalId = setInterval(checkPayment, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [step, faturaId, navigate]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "payment-success") {
      timer = setTimeout(() => {
        navigate("/TokenAutoAtendimento");
      }, 10000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [step, navigate]);

  const getStepTitle = () => {
    switch (step) {
      case "search":
        return "Identificação";
      case "selection":
        return "Seleção de Cadastro";
      case "method":
        return "Forma de Pagamento";
      case "payment-pix":
        return "Pagamento via Pix";
      case "payment-card":
        return "Pagamento via Cartão";
      case "payment-success":
        return "Concluído";
      default:
        return "";
    }
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
                {getStepTitle()}
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
                            {client.login}
                          </h4>
                          <p className="text-slate-400 text-sm mb-2">
                            {client.cpf_cnpj}
                          </p>
                          {client.endereco && (
                            <p className="text-slate-500 text-xs flex flex-col">
                              <span>
                                {client.endereco}, {client.numero}
                              </span>
                              <span>
                                {client.bairro} - {client.cidade}
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

          {step === "method" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
              <h2 className="text-2xl font-bold text-white mb-4">
                Como deseja pagar?{" "}
              </h2>
              <div className="grid grid-cols-1 gap-6 w-full max-w-sm">
                <button
                  onClick={() => handleMethodSelect("pix")}
                  disabled={loading}
                  className={`
                    group relative overflow-hidden rounded-2xl p-6 transition-all transform 
                    ${
                      loading
                        ? "bg-emerald-800 cursor-not-allowed"
                        : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/30"
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-xl uppercase tracking-wider flex items-center gap-2">
                      {loading ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          <span>Processando...</span>
                        </>
                      ) : (
                        "Pix"
                      )}
                    </span>
                    <div className="bg-white/20 p-3 rounded-full">
                      <FaBarcode className="text-white text-2xl" />
                    </div>
                  </div>
                  <p className="text-emerald-100 text-sm mt-2 text-left">
                    {loading ? "Aguarde um momento" : "Pagamento instantâneo"}
                  </p>
                </button>

                <button
                  onClick={() => handleMethodSelect("card")}
                  className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-xl uppercase tracking-wider">
                      Cartão
                    </span>
                    <div className="bg-white/20 p-3 rounded-full">
                      <HiCreditCard className="text-white text-2xl" />
                    </div>
                  </div>
                  <p className="text-blue-100 text-sm mt-2 text-left">
                    Débito ou Crédito
                  </p>
                </button>
              </div>
            </div>
          )}

          {(step === "payment-pix" || step === "payment-card") && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8 overflow-auto">
              <div className="w-24 h-24 bg-cyan-500/10 rounded-full flex items-center justify-center animate-pulse">
                <HiCurrencyDollar className="text-5xl text-cyan-400" />
              </div>

              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">
                  {step === "payment-pix"
                    ? "Pagamento Pix"
                    : "Pagamento Cartão"}
                </h2>
              </div>

              {step === "payment-pix" ? (
                <div className="flex flex-col items-center space-y-6 w-full max-w-md">
                  <div className="bg-slate-800/80 border border-cyan-500/30 rounded-2xl p-6 w-full text-center shadow-lg shadow-cyan-500/10">
                    <span className="text-slate-400 text-sm uppercase tracking-widest block mb-1">
                      Valor a Pagar
                    </span>
                    <span className="text-4xl font-bold text-white">
                      {formatCurrency(valorPagamento)}
                    </span>
                  </div>

                  {qrCode && (
                    <div className="bg-white p-4 rounded-xl shadow-2xl">
                      {qrCode.length > 1000 || qrCode.startsWith("data:") ? (
                        <img
                          src={
                            qrCode.startsWith("data:image")
                              ? qrCode
                              : `data:image/png;base64,${qrCode}`
                          }
                          alt="QR Code Pix"
                          className="w-64 h-64 object-contain"
                        />
                      ) : (
                        <QRCodeCanvas value={qrCode} size={256} />
                      )}
                    </div>
                  )}
                  <p className="text-slate-400 text-sm max-w-xs mx-auto text-center">
                    Escaneie o QR Code acima para pagar
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="bg-slate-800/80 border border-cyan-500/30 rounded-2xl p-6 w-full text-center shadow-lg shadow-cyan-500/10">
                    <span className="text-slate-400 text-sm uppercase tracking-widest block mb-1">
                      Valor a Pagar
                    </span>
                    <span className="text-4xl font-bold text-white">
                      {formatCurrency(valorPagamento)}
                    </span>
                  </div>
                  <p className="text-slate-400 text-lg max-w-xs mx-auto text-center">
                    {cardMessage}
                  </p>
                  <div className="p-4 bg-slate-800 border border-white/5 rounded-xl max-w-sm w-full mt-8">
                    <div className="flex items-center justify-center space-x-3 text-slate-300">
                      <FaSpinner className="animate-spin text-cyan-400" />
                      <span>Aguardando operação...</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate("/TokenAutoAtendimento")}
                className="mt-8 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-white/10 transition-colors"
              >
                Cancelar / Voltar
              </button>
            </div>
          )}

          {step === "payment-success" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
              <div className="w-32 h-32 bg-green-500/20 rounded-full flex items-center justify-center">
                <HiCheck className="text-6xl text-green-400" />
              </div>

              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-white">
                  Pagamento Confirmado!
                </h2>
                <p className="text-slate-400 text-lg">
                  Obrigado por utilizar nosso autoatendimento.
                </p>
                <div className="text-slate-500 text-sm">
                  Retornando ao início em 10 segundos...
                </div>
              </div>

              <button
                onClick={() => navigate("/TokenAutoAtendimento")}
                className="mt-8 px-10 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-cyan-500/50 text-white font-bold rounded-xl shadow-lg transform transition-all hover:scale-105 active:scale-95"
              >
                Voltar ao Início Agora
              </button>
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
