import React, { useState, useRef, useEffect } from "react";
import {
  HiArrowLeft,
  HiUser,
  HiHome,
  HiCheck,
  HiCreditCard,
  HiCurrencyDollar,
  HiXCircle,
  HiPrinter,
  HiArrowRight,
} from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import { Keyboard } from "./components/Keyboard";
import axios from "axios";
import { FaSpinner, FaBarcode } from "react-icons/fa";
import { QRCodeCanvas } from "qrcode.react";
import { format } from "date-fns";
import { useReactToPrint } from "react-to-print";
import { Receipt } from "./components/Receipt";
import { useIdleTimeout } from "../../hooks/useIdleTimeout";

interface Client {
  id: number;
  nome: string;
  cpf_cnpj: string;
  login: string;
  endereco: string;
  numero: string;
  bairro: string;
  plano: string;
  cidade: string;
}

interface Invoice {
  id: number;
  valor: string;
  data_vencimento: string;
  descricao: string;
}

export const PagarFatura = () => {
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState("");
  const [valorPagamento, setValorPagamento] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [step, setStep] = useState<
    | "search"
    | "selection"
    | "invoice-selection"
    | "method"
    | "payment-pix"
    | "payment-card"
    | "payment-success"
    | "payment-error"
  >("search");
  const [errorMessage, setErrorMessage] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);

  const [order, setOrder] = useState<{
    id: string;
    user_id: string;
    external_reference: string;
    status: string;
  } | null>(null);
  const [faturaId, setFaturaId] = useState<number | string | null>(null);
  const [cardMessage, setCardMessage] = useState(
    "Insira o cartão na maquininha e siga as instruções.",
  );

  useIdleTimeout({
    onIdle: () =>
      navigate("/TokenAutoAtendimento", { state: { forceIdle: true } }),
    idleTime: 180, // 3 minutes
  });

  // Input ref to keep focus if needed, though we primarily use virtual keyboard
  const inputRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    onAfterPrint: () => console.log("Impressão concluída"),
    onPrintError: (error) => console.error("Erro impressão:", error),
  });

  const handleKeyPress = (key: string) => {
    if (step !== "search") return;

    if (key === "BACKSPACE") {
      setCpf((prev) => prev.slice(0, -1));
    } else if (key === "ENTER") {
      handleSearch();
    } else if (key === "SPACE") {
      // CPF usually doesn't have spaces, but we can allow it or ignore
    } else if (key.length === 1 && /[0-9]/.test(key)) {
      // Allow numbers for CPF (11) or CNPJ (14), but let them type more to correct mistakes
      if (cpf.length < 14) {
        setCpf((prev) => prev + key);
      }
    }
  };

  const handleSearch = async () => {
    if (cpf.length !== 11 && cpf.length !== 14) {
      setError("Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/TokenAutoAtendimento/Login`,
        { cpf }, // Sending raw CPF digits
      );

      const data = Array.isArray(response.data)
        ? response.data
        : response.data.clients || [response.data];

      if (!data || data.length === 0) {
        setError("Nenhum cadastro encontrado para este CPF/CNPJ.");
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

  const fetchInvoices = async (client: Client) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/TokenAutoAtendimento/FaturasAbertas`,
        { login: client.login },
      );
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar faturas:", error);
      return [];
    }
  };

  const toggleClientSelection = (client: Client) => {
    if (selectedClients.find((c) => c.id === client.id)) {
      setSelectedClients(selectedClients.filter((c) => c.id !== client.id));
    } else {
      setSelectedClients([...selectedClients, client]);
    }
  };

  const handleClientClick = async (client: Client) => {
    // If we are in multi-select mode (more than 0 selected), clicking toggles
    // But maybe for simplicity, card click = select single and show invoices.
    // Checkbox click = toggle multi selection.

    // For now: Card click -> Select ONLY this client and go to Invoice Selection
    setSelectedClient(client);
    setSelectedClients([client]); // Reset multi-selection to just this one

    setLoading(true);
    try {
      // 1. Select Context
      await axios.post(
        `${process.env.REACT_APP_URL}/TokenAutoAtendimento/ChooseHome`,
        { ...client },
      );

      // 2. Fetch Invoices
      const fethedInvoices = await fetchInvoices(client);
      setInvoices(fethedInvoices);
      setStep("invoice-selection");
    } catch (err: any) {
      console.error(err);
      setError("Erro ao selecionar cadastro.");
    } finally {
      setLoading(false);
    }
  };

  const handleMultiClientPayment = async () => {
    if (selectedClients.length === 0) return;

    // Logic to pay 1st invoice of all selected clients
    // We treat this as a "combined" payment similar to multi-invoice
    // But we first need to get the invoice IDs.
    // Since we don't have a direct endpoint for "give me 1st invoice ID",
    // we might need to rely on assumptions or a new backend endpoint.
    // For now, I'll assume we can use the same flow: get invoices for each, pick first.

    setLoading(true);
    try {
      let allInvoiceIds: number[] = [];
      let totalValue = 0;

      for (const client of selectedClients) {
        // Select Context (important for backend session maybe?) - might be tricky for multiple.
        // Assuming backend can handle 'stateless' invoice ID payment via Pix generator.
        const clientInvoices = await fetchInvoices(client);
        if (clientInvoices.length > 0) {
          allInvoiceIds.push(clientInvoices[0].id); // Pick first
          totalValue += parseFloat(clientInvoices[0].valor);
        }
      }

      if (allInvoiceIds.length === 0) {
        setError("Nenhuma fatura encontrada para os cadastros selecionados.");
        setLoading(false);
        return;
      }

      setSelectedInvoiceIds(allInvoiceIds);
      setValorPagamento(totalValue.toFixed(2));
      // Move to method, but we might skip method and go straight to Pix if card isn't supported for multi.
      // Let's go to method, but maybe disable card?
      setStep("method");
    } catch (err) {
      console.error(err);
      setError("Erro ao processar validação das faturas.");
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceSelect = (id: number) => {
    if (selectedInvoiceIds.includes(id)) {
      setSelectedInvoiceIds(selectedInvoiceIds.filter((i) => i !== id));
    } else {
      setSelectedInvoiceIds([...selectedInvoiceIds, id]);
    }
  };

  const handleInvoicePayment = () => {
    if (selectedInvoiceIds.length === 0) return;

    // Calculate total for display?
    const total = invoices
      .filter((inv) => selectedInvoiceIds.includes(inv.id))
      .reduce((sum, inv) => sum + parseFloat(inv.valor), 0);

    setValorPagamento(total.toFixed(2));
    setStep("method");
  };

  const obterOrderPorId = React.useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_URL}/TokenAutoAtendimento/ObterOrderPorId/${order?.id}`,
        );

        console.log(response.data);

        if (response.data.status === "expired") {
          setErrorMessage("Pagamento expirado.");
          setStep("payment-error");
          setOrder(null);
        } else if (
          response.data.status === "failed" ||
          response.data.status === "canceled"
        ) {
          setErrorMessage("Pagamento Falhou.");
          setStep("payment-error");
          setOrder(null);
        }
      } catch (err: any) {
        console.error(err);
        if (!silent)
          setError(err.response?.data?.error || "Erro ao buscar pedido.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [order?.id],
  );

  useEffect(() => {
    let intervalId: NodeJS.Timer;
    if (order) {
      // Initial call
      obterOrderPorId(false);

      // Polling every 5 seconds
      intervalId = setInterval(() => {
        obterOrderPorId(true);
      }, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [order, obterOrderPorId]);

  const handleMethodSelect = async (method: "pix" | "credit" | "debit") => {
    // Determine if we are doing single client single invoice (legacy flow) or multi
    // Actually, "legacy flow" now is just a subset of multi-invoice (array of 1).

    const isMulti = selectedInvoiceIds.length > 0;

    // If we have selectedInvoiceIds, we use that.
    // However, if we came from "Selection" step directly (single client, old flow),
    // we might not have populated selectedInvoiceIds yet if we didn't go through invoice selection.
    // BUT, we changed handleClientClick to go to invoice-selection.
    // What if there is only 1 invoice? auto select?
    // Let's stick to: We ALWAYS have selectedInvoiceIds if we are at this step from the new flows.

    // Fallback: if no invoices selected but selectedClient exists (shouldn't happen with new flow but generic safety)
    if (!isMulti && !selectedClient) return;

    if (method === "credit" || method === "debit") {
      setStep("payment-card");
      setCardMessage("Aguardando comunicação com a maquininha...");
      try {
        const loginToUse = selectedClient?.login || selectedClients[0]?.login;
        const titulos = isMulti ? selectedInvoiceIds.join(",") : "";

        let endpoint = "";
        if (isMulti) {
          endpoint =
            method === "credit"
              ? `${process.env.REACT_APP_URL}/TokenAutoAtendimento/GerarPagamentoCreditoMultiplo`
              : `${process.env.REACT_APP_URL}/TokenAutoAtendimento/GerarPagamentoDebitoMultiplo`;
        } else {
          endpoint =
            method === "credit"
              ? `${process.env.REACT_APP_URL}/TokenAutoAtendimento/ObterListaTerminaisEGerarPagamentoCredito`
              : `${process.env.REACT_APP_URL}/TokenAutoAtendimento/ObterListaTerminaisEGerarPagamentoDebito`;
        }

        const payload: any = { login: loginToUse };
        if (isMulti) {
          payload.titulos = titulos;
        }

        const response = await axios.post(endpoint, payload);

        if (response.status === 200) {
          setCardMessage("Termine o processo na maquininha.");
          // response.id contains the comma/hyphen separated IDs
          setFaturaId(response.data.id);
          setValorPagamento(response.data.valor);
          setDataPagamento(response.data.dataPagamento);
          setOrder(response.data.order);
        }
      } catch (error) {
        console.error(error);
        setError(
          `Erro ao iniciar pagamento ${
            method === "credit" ? "Crédito" : "Débito"
          }.`,
        );
        setStep("method");
      }
      return;
    }

    // Method is PIX
    setLoading(true);
    setError("");
    try {
      let response;

      if (isMulti && selectedInvoiceIds.length > 0) {
        // Use the `geradorTitulos` logic from PixDetalhe
        // We need 'titulos' as comma separated IDs (or whatever that endpoint expects).
        // PixDetalhe uses `{ nome_completo: user, cpf: cpf, titulos: titulos }` for `geradorTitulos`.

        // Wait, `geradorTitulos` in PixDetalhe takes `titulos` as a string of IDs?
        // Let's format it.
        const idsString = selectedInvoiceIds.join(",");
        const mainClient = selectedClient || selectedClients[0];

        response = await axios.post(
          `${process.env.REACT_APP_URL}/TokenAutoAtendimento/GerarPixMultiplos`,
          {
            nome_completo: mainClient.nome,
            cpf: cpf,
            titulos: idsString,
          },
        );

        // The response structure from PixDetalhe: { link, pppoe, formattedDate, valor }
        // We need to map it to our state.
        const data = response.data;
        setQrCode(data.link); // Pix CopyPaste/Link
        setValorPagamento(data.valor);
        setDataPagamento(data.formattedDate);

        // We don't get a single 'faturaId' for polling if it's a combined pix?
        // The other endpoint returned `faturaId`.
        // If `geradorTitulos` creates a new "Fatura Avulsa" or "Cobranca", it should return its ID.
        // PixDetalhe doesn't seem to care about polling in the code I saw (it just shows the link).
        // REQUIRED: We need to poll for success.
        // I'll check if response has an ID or `id`.
        if (data.id || data.faturaId) {
          setFaturaId(data.id || data.faturaId);
        } else {
          // If no ID returned, we can't poll via FaturaWentPaid.
          // Pix generation should return at least one ID or we need a new polling mechanism.
          // Backend `gerarPixVariasContas` now returns `faturaId` (first invoice ID).
          // preventing warn.
        }
      } else {
        // Fallback legacy single logic (if no invoice IDs but just context?)
        // Should not happen with new flow, but keeping for safety.

        response = await axios.post(
          `${process.env.REACT_APP_URL}/TokenAutoAtendimento/GerarPixToken`,
          {
            cpf: cpf,
            login: selectedClient?.login,
            perdoarJuros: false,
          },
        );
        setFaturaId(response.data.faturaId);
        setQrCode(response.data.imagem);
        setValorPagamento(response.data.valor);
        setDataPagamento(response.data.formattedDate);
      }

      setStep("payment-pix");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Erro ao iniciar pagamento Pix.");
    } finally {
      setLoading(false);
    }
  };

  const formatCpfCnpj = (value: string) => {
    const cleanValue = value.replace(/\D/g, "");

    if (cleanValue.length <= 11) {
      return cleanValue
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})/, "$1-$2")
        .replace(/(-\d{2})\d+?$/, "$1");
    } else {
      return cleanValue
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
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
          console.log(
            "Verificando status do pagamento Pix para Fatura ID:",
            faturaId,
          );
          const response = await axios.post(
            `${process.env.REACT_APP_URL}/TokenAutoAtendimento/FaturaWentPaid`,
            { faturaId },
          );

          console.log("Resposta Verificação Pix:", response.data);

          // Check for boolean true or object with paid/status property
          // Adjust logic based on actual backend response.
          // Assuming if it returns 200 and data is truthy or specifically true/confirmed.
          // If the API returns 200 with "false" (not paid), we should NOT confirm.

          const isPaid = response.data.pago === true;
          if (isPaid) {
            console.log("Pagamento Confirmado!");
            setStep("payment-success");
          } else {
            console.log("Pagamento ainda pendente...");
          }
        } catch (error) {
          console.log(
            "Aguardando pagamento (ou erro na verificação)...",
            error,
          );
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
    let timeoutId: NodeJS.Timeout;

    if (step === "payment-pix" || step === "payment-card") {
      timeoutId = setTimeout(() => {
        setErrorMessage("Tempo para pagamento expirado.");
        setStep("payment-error");
        setOrder(null);
      }, 120000); // 2 minutes
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [step]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "payment-success") {
      // Trigger print automatically on success with a small delay to ensure rendering
      setTimeout(() => {
        console.log("PRINT DEBUG: Attempting automatic print...");
        if (receiptRef.current) {
          console.log(
            "PRINT DEBUG: Receipt ref found, calling handlePrint now.",
          );
          handlePrint?.();
        } else {
          console.error(
            "PRINT DEBUG: receiptRef.current is null/undefined! Cannot print.",
          );
        }
      }, 1000); // Increased delay to 1000ms to ensure render

      timer = setTimeout(() => {
        navigate("/TokenAutoAtendimento", { state: { forceIdle: true } });
      }, 20000);
    } else if (step === "payment-error") {
      timer = setTimeout(() => {
        navigate("/TokenAutoAtendimento", { state: { forceIdle: true } });
      }, 20000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [step, navigate, handlePrint]);

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
      case "payment-error":
        return "Erro no Pagamento";
      default:
        return "";
    }
  };

  function handleBack(): void {
    if (step === "selection") {
      setStep("search");
      setClients([]);
      setError("");
      setSelectedClients([]);
    } else if (step === "invoice-selection") {
      setStep("selection");
      setInvoices([]);
      setSelectedInvoiceIds([]);
      // Keep selected client? Maybe reset if we want them to pick again.
      // But typically back means "go up".
      // If we came from click -> selection.
      setSelectedClient(null);
    } else {
      navigate("/TokenAutoAtendimento", { state: { forceIdle: false } });
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black opactiy-80"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
      </div>

      {/* Kiosk Frame */}
      <div className="relative z-10 w-full max-w-md lg:max-w-[900px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] lg:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-full lg:h-[85vh] border-t-white/20 border-l-white/20">
        {/* Glow Effects */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 lg:px-10 pt-8 lg:pt-16 pb-4 lg:pb-6 bg-slate-900/40 border-b border-white/5">
          <div className="flex items-center space-x-3 lg:space-x-6 text-cyan-400">
            {/* Conditional Back Button in Header - Positioned to the left of title */}
            {(step === "search" || step === "selection") && (
              <button
                onClick={handleBack}
                className="p-2 lg:p-4 -ml-2 lg:-ml-4 rounded-full hover:bg-white/5 transition-colors mr-2 lg:mr-4"
              >
                <HiArrowLeft className="text-2xl lg:text-4xl" />
              </button>
            )}
            <div className="flex flex-col">
              <span className="text-xl lg:text-4xl font-bold tracking-wider text-white">
                PAGAR FATURA
              </span>
              <span className="text-[10px] lg:text-sm tracking-[0.2em] text-cyan-300 uppercase">
                {getStepTitle()}
              </span>
            </div>
          </div>
          <img
            src="/imgs/icon.png"
            alt="Logo"
            className="h-16 lg:h-28 w-auto drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]"
          />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {step === "search" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">
                  Digite seu CPF ou CNPJ
                </h2>
                <p className="text-slate-400 text-sm">
                  Use o teclado abaixo para digitar os números
                </p>
              </div>

              <div className="w-full max-w-sm lg:max-w-xl relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-slate-900 border border-white/10 rounded-xl lg:rounded-2xl p-4 lg:p-6 flex items-center shadow-xl">
                  <HiUser className="text-2xl lg:text-4xl text-cyan-400 mr-3 lg:mr-4" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={formatCpfCnpj(cpf)}
                    readOnly
                    placeholder="CPF/CNPJ"
                    className="bg-transparent border-none outline-none text-3xl lg:text-5xl font-mono text-white placeholder-slate-600 w-full text-center tracking-wider"
                  />
                </div>
              </div>

              {/* Removed Back button from here as requested */}

              <button
                onClick={handleSearch}
                disabled={loading || (cpf.length !== 11 && cpf.length !== 14)}
                className={`
                  w-full max-w-sm lg:max-w-xl py-4 lg:py-8 rounded-xl lg:rounded-2xl font-bold text-xl lg:text-3xl tracking-wide uppercase transition-all transform shadow-lg
                  flex items-center justify-center space-x-2 lg:space-x-4
                  ${
                    loading || (cpf.length !== 11 && cpf.length !== 14)
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-cyan-500/50 active:scale-95"
                  }
                `}
              >
                {loading ? (
                  <>
                    <FaSpinner className="animate-spin text-xl lg:text-3xl" />
                    <span>Buscando...</span>
                  </>
                ) : (
                  <>
                    <span>Continuar</span>
                    <HiArrowRight className="text-xl lg:text-3xl" />
                  </>
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
                {clients.map((client) => {
                  const isSelected = !!selectedClients.find(
                    (c) => c.id === client.id,
                  );
                  return (
                    <div
                      key={client.id}
                      className={`
                        group relative overflow-hidden rounded-xl lg:rounded-2xl p-4 lg:p-6 text-left transition-all duration-300 transform 
                        border border-white/10
                        ${isSelected ? "bg-slate-800 border-cyan-500/50 shadow-lg shadow-cyan-900/20" : "bg-slate-800/50 hover:bg-slate-800"}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        {/* Checkbox for multi-select */}
                        <div
                          className="mr-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleClientSelection(client);
                          }}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-colors cursor-pointer ${isSelected ? "bg-cyan-500 border-cyan-500" : "border-slate-500 bg-slate-900/50 group-hover:border-cyan-400"}`}
                          >
                            {isSelected && (
                              <HiCheck className="text-white text-xl" />
                            )}
                          </div>
                        </div>

                        {/* Main Content - Click to select strictly this one */}
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => handleClientClick(client)}
                        >
                          <div className="flex items-start space-x-4">
                            <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
                              <HiHome className="text-2xl text-cyan-400" />
                            </div>
                            <div>
                              <h4 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-300 transition-colors">
                                {client.login}
                              </h4>
                              <p className="text-slate-400 text-sm">
                                {client.cpf_cnpj}
                              </p>
                              {client.endereco && (
                                <p className="text-slate-500 text-xs mt-1">
                                  {client.endereco}, {client.numero},{" "}
                                  {client.bairro}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Arrow to indicate single click action */}
                        <div className="ml-4 opacity-50 group-hover:opacity-100 transition-opacity">
                          <HiArrowRight className="text-white text-2xl" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedClients.length > 1 && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleMultiClientPayment}
                    disabled={loading}
                    className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl shadow-lg hover:shadow-emerald-500/30 transform hover:scale-105 active:scale-95 transition-all flex items-center space-x-2"
                  >
                    {loading ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <HiCheck className="text-xl" />
                    )}
                    <span>
                      Pagar 1ª Fatura dos {selectedClients.length} Cadastros
                    </span>
                  </button>
                </div>
              )}

              <div className="mt-8 text-center pb-4">
                <button
                  onClick={() => {
                    setStep("search");
                    setError("");
                    setClients([]);
                    setSelectedClients([]);
                  }}
                  className="text-slate-400 hover:text-white text-sm hover:underline"
                >
                  Buscar outro CPF
                </button>
              </div>
            </div>
          )}

          {step === "invoice-selection" && (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
              <h3 className="text-white text-lg font-bold mb-4 px-2">
                Selecione as Faturas (Cadastro:{" "}
                <span className="text-cyan-400">{selectedClient?.login}</span>)
              </h3>

              {invoices.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  Nenhuma fatura em aberto encontrada.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {invoices.map((inv) => {
                    const isSel = selectedInvoiceIds.includes(inv.id);
                    return (
                      <div
                        key={inv.id}
                        onClick={() => handleInvoiceSelect(inv.id)}
                        className={`
                                    cursor-pointer p-4 rounded-xl border transition-all duration-200 flex items-center justify-between
                                    ${isSel ? "bg-slate-800 border-cyan-500 shadow-md shadow-cyan-900/10" : "bg-slate-800/30 border-white/5 hover:bg-slate-800/50"}
                                `}
                      >
                        <div className="flex items-center space-x-4">
                          <div
                            className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${isSel ? "bg-cyan-500 border-cyan-500" : "border-slate-500 bg-slate-900"}`}
                          >
                            {isSel && (
                              <HiCheck className="text-white text-sm" />
                            )}
                          </div>
                          <div>
                            <p className="text-white font-bold text-lg">
                              {formatCurrency(inv.valor)}
                            </p>
                            <p className="text-slate-400 text-sm">
                              {inv.descricao}
                            </p>
                          </div>
                        </div>
                        <div className="text-slate-300 font-mono text-sm">
                          Venc:{" "}
                          {format(new Date(inv.data_vencimento), "dd/MM/yyyy")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 flex flex-col items-center space-y-4 pb-4">
                {selectedInvoiceIds.length > 0 && (
                  <div className="text-white font-bold text-xl">
                    Total:{" "}
                    <span className="text-cyan-400">
                      {formatCurrency(
                        invoices
                          .filter((i) => selectedInvoiceIds.includes(i.id))
                          .reduce((a, b) => a + parseFloat(b.valor), 0),
                      )}
                    </span>
                  </div>
                )}

                <button
                  onClick={handleInvoicePayment}
                  disabled={selectedInvoiceIds.length === 0}
                  className={`
                            px-8 py-3 rounded-xl font-bold shadow-lg transition-all transform flex items-center space-x-2
                            ${
                              selectedInvoiceIds.length > 0
                                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:scale-105 active:scale-95 hover:shadow-blue-500/30"
                                : "bg-slate-700 text-slate-500 cursor-not-allowed"
                            }
                        `}
                >
                  <span>Pagar {selectedInvoiceIds.length} Fatura(s)</span>
                  <HiArrowRight />
                </button>
              </div>
            </div>
          )}

          {step === "method" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 lg:space-y-10">
              <h2 className="text-2xl lg:text-4xl font-bold text-white mb-4 lg:mb-6">
                Como deseja pagar?{" "}
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 w-full max-w-sm lg:max-w-4xl">
                {/* Pix - Full Width on lg if preferred, or just first item */}
                <button
                  onClick={() => handleMethodSelect("pix")}
                  disabled={loading}
                  className={`
                    lg:col-span-2 group relative overflow-hidden rounded-2xl lg:rounded-3xl p-6 lg:p-8 transition-all transform 
                    ${
                      loading
                        ? "bg-emerald-800 cursor-not-allowed"
                        : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-emerald-500/30"
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-xl lg:text-3xl uppercase tracking-wider flex items-center gap-2 lg:gap-4">
                      {loading ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          <span>Processando...</span>
                        </>
                      ) : (
                        "Pix"
                      )}
                    </span>
                    <div className="bg-white/20 p-3 lg:p-4 rounded-full">
                      <FaBarcode className="text-white text-2xl lg:text-4xl" />
                    </div>
                  </div>
                  <p className="text-emerald-100 text-sm lg:text-lg mt-2 lg:mt-3 text-left">
                    {loading ? "Aguarde um momento" : "Pagamento instantâneo"}
                  </p>
                </button>

                {/* Credit Card */}
                <button
                  onClick={() => handleMethodSelect("credit")}
                  className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl lg:rounded-3xl p-6 lg:p-8 transition-all transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/30"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-bold text-xl lg:text-2xl uppercase tracking-wider">
                      Crédito
                    </span>
                    <div className="bg-white/20 p-3 lg:p-4 rounded-full">
                      <HiCreditCard className="text-white text-2xl lg:text-3xl" />
                    </div>
                  </div>
                  <p className="text-blue-100 text-sm lg:text-base text-left">
                    Cartão de Crédito
                  </p>
                </button>

                {/* Debit Card */}
                <button
                  onClick={() => handleMethodSelect("debit")}
                  className="group relative overflow-hidden bg-gradient-to-r from-cyan-600 to-blue-500 rounded-2xl lg:rounded-3xl p-6 lg:p-8 transition-all transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/30"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-bold text-xl lg:text-2xl uppercase tracking-wider">
                      Débito
                    </span>
                    <div className="bg-white/20 p-3 lg:p-4 rounded-full">
                      <HiCreditCard className="text-white text-2xl lg:text-3xl" />
                    </div>
                  </div>
                  <p className="text-cyan-100 text-sm lg:text-base text-left">
                    Cartão de Débito
                  </p>
                </button>
              </div>
            </div>
          )}

          {(step === "payment-pix" || step === "payment-card") && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 lg:space-y-10 overflow-auto">
              <div className="w-24 h-24 lg:w-32 lg:h-32 bg-cyan-500/10 rounded-full flex items-center justify-center animate-pulse">
                <HiCurrencyDollar className="text-5xl lg:text-7xl text-cyan-400" />
              </div>

              <div className="text-center">
                <h2 className="text-2xl lg:text-4xl font-bold text-white mb-2">
                  {step === "payment-pix"
                    ? "Pagamento Pix"
                    : "Pagamento Cartão"}
                </h2>
              </div>

              {step === "payment-pix" ? (
                <div className="flex flex-col items-center space-y-4 lg:space-y-8 w-full max-w-sm lg:max-w-xl">
                  <div className="bg-slate-800/80 border border-cyan-500/30 rounded-2xl lg:rounded-3xl p-4 lg:p-8 w-full text-center shadow-lg shadow-cyan-500/10">
                    <span className="text-slate-400 text-sm lg:text-lg uppercase tracking-widest block mb-1 lg:mb-2">
                      Valor a Pagar
                    </span>
                    <span className="text-4xl lg:text-6xl font-bold text-white">
                      {formatCurrency(valorPagamento)}{" "}
                      <span className="text-green-400 text-sm lg:text-xl uppercase tracking-widest block my-2 lg:my-4">
                        {dataPagamento &&
                          format(new Date(dataPagamento), "dd/MM/yyyy")}
                      </span>
                    </span>
                  </div>

                  {qrCode && (
                    <div className="bg-white p-2 lg:p-4 rounded-xl lg:rounded-2xl shadow-2xl overflow-hidden max-w-full">
                      {qrCode.length > 1000 || qrCode.startsWith("data:") ? (
                        <img
                          src={
                            qrCode.startsWith("data:image")
                              ? qrCode
                              : `data:image/png;base64,${qrCode}`
                          }
                          alt="QR Code Pix"
                          className="w-64 h-64 lg:w-96 lg:h-96 object-contain"
                        />
                      ) : (
                        <div className="w-64 h-64 lg:w-96 lg:h-96 flex items-center justify-center">
                          <QRCodeCanvas
                            value={qrCode}
                            size={256}
                            style={{ width: "100%", height: "auto" }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-slate-400 text-base lg:text-xl max-w-md mx-auto text-center">
                    Escaneie o QR Code acima para pagar
                  </p>
                </div>
              ) : (
                <div className="text-center w-full max-w-sm lg:max-w-xl">
                  <div className="bg-slate-800/80  border border-cyan-500/30 rounded-2xl lg:rounded-3xl p-6 lg:p-8 w-full text-center shadow-lg shadow-cyan-500/10 mb-4 lg:mb-8">
                    <span className="text-slate-400 text-sm lg:text-lg uppercase tracking-widest block mb-1 lg:mb-2">
                      Valor a Pagar
                    </span>
                    <span className="text-4xl lg:text-6xl font-bold text-white">
                      {formatCurrency(valorPagamento)}
                    </span>
                    <span className="text-green-400 text-sm lg:text-xl uppercase tracking-widest block my-2 lg:my-4">
                      {dataPagamento &&
                        format(new Date(dataPagamento), "dd/MM/yyyy")}
                    </span>
                  </div>
                  <p className="text-slate-400 text-lg lg:text-2xl max-w-lg mx-auto text-center mb-4 lg:mb-6">
                    {cardMessage}
                  </p>
                  <div className="p-4 lg:p-6 bg-slate-800 border border-white/5 rounded-2xl max-w-md w-full mx-auto mt-4 lg:mt-6">
                    <div className="flex items-center justify-center space-x-3 lg:space-x-4 text-slate-300">
                      <FaSpinner className="animate-spin text-cyan-400 text-2xl lg:text-3xl" />
                      <span className="text-lg lg:text-xl">
                        Aguardando operação...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {step === "payment-pix" && (
                <button
                  onClick={() => navigate("/TokenAutoAtendimento")}
                  className="mt-4 lg:mt-8 px-4 lg:px-8 py-3 lg:py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl lg:rounded-2xl border border-white/10 transition-colors text-lg lg:text-2xl"
                >
                  Cancelar / Voltar
                </button>
              )}
              {step === "payment-card" && (
                <span className="mt-4 lg:mt-8 px-4 lg:px-8 py-3 lg:py-5 bg-red-800 hover:bg-red-700 text-white rounded-xl lg:rounded-2xl border border-white/10 transition-colors text-base lg:text-xl block max-w-sm lg:max-w-xl text-center">
                  Para Cancelar, Clique na seta esquerda no canto superior da
                  maquininha!
                </span>
              )}
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
                  Retornando ao início em 20 segundos...
                </div>
              </div>

              <div className="flex flex-col space-y-4 w-full max-w-sm">
                <button
                  onClick={() => handlePrint && handlePrint()}
                  className="w-full px-10 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl shadow-lg transform transition-all hover:scale-105 active:scale-95 flex items-center justify-center space-x-2"
                >
                  <HiPrinter className="text-xl" />
                  <span>Imprimir Comprovante</span>
                </button>

                <button
                  onClick={() =>
                    navigate("/TokenAutoAtendimento", {
                      state: { forceIdle: true },
                    })
                  }
                  className="w-full px-10 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-cyan-500/50 text-white font-bold rounded-xl shadow-lg transform transition-all hover:scale-105 active:scale-95"
                >
                  Voltar ao Início Agora
                </button>
              </div>
            </div>
          )}

          {step === "payment-error" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8 animate-fadeIn">
              <div className="w-32 h-32 bg-red-500/20 rounded-full flex items-center justify-center">
                <HiXCircle className="text-6xl text-red-500" />
              </div>

              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-white">
                  {errorMessage || "Erro no Pagamento"}
                </h2>
                <p className="text-slate-400 text-lg">
                  Não foi possível concluir a transação.
                </p>
                <div className="text-slate-500 text-sm">
                  Retornando ao início em 10 segundos...
                </div>
              </div>

              <button
                onClick={() =>
                  navigate("/TokenAutoAtendimento", {
                    state: { forceIdle: true },
                  })
                }
                className="mt-8 px-10 py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:shadow-red-500/50 text-white font-bold rounded-xl shadow-lg transform transition-all hover:scale-105 active:scale-95"
              >
                Tentar Novamente
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
      {/* Hidden Receipt Component - using overflow hidden instead of display none ensures render for print */}
      <div style={{ position: "absolute", top: "-9999px", left: "-9999px" }}>
        <Receipt
          ref={receiptRef}
          clientName={selectedClient?.nome || ""}
          cpfCnpj={selectedClient?.cpf_cnpj || ""}
          faturaId={faturaId}
          valor={valorPagamento}
          dataPagamento={dataPagamento}
          plano={selectedClient?.plano || ""}
        />
      </div>
    </div>
  );
};
