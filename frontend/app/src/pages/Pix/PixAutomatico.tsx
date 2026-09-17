import React, { useEffect, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { CiSettings } from "react-icons/ci";
import { FiCopy, FiCheck, FiSearch, FiFilter } from "react-icons/fi";
import { MdAutorenew } from "react-icons/md";

import {
  FiltrosPix,
  PixAuto,
  PixAutomaticoListOnePeople,
  PixAutomaticoListPeople,
} from "../../types";

/** Periodicidades e políticas aceitas pelo Pix Automático da Efí. */
const PERIODICIDADES = [
  "SEMANAL",
  "MENSAL",
  "TRIMESTRAL",
  "SEMESTRAL",
  "ANUAL",
];
const POLITICAS = [
  { valor: "NAO_PERMITE", rotulo: "Não permite nova tentativa" },
  { valor: "PERMITE_3R_7D", rotulo: "Permite 3 tentativas em 7 dias" },
];

/** Jornadas de contratação do Pix Automático (documentação da Efí). */
const JORNADAS = [
  {
    valor: "3",
    rotulo: "QR Code cobrando a mensalidade em aberto",
    ajuda:
      "O cliente paga a mensalidade agora e autoriza a recorrência no mesmo Pix.",
  },
  {
    valor: "2",
    rotulo: "QR Code só de autorização",
    ajuda: "Não cobra nada na hora; as cobranças começam na data inicial.",
  },
  {
    valor: "1",
    rotulo: "Sem QR Code, direto no app do banco",
    ajuda:
      "A autorização aparece no app do banco do cliente. Exige agência, conta e ISPB do banco dele.",
  },
];

const STATUS_COBRANCA = [
  "TODOS",
  "CRIADA",
  "ATIVA",
  "AGENDADA",
  "EXPIRADA",
  "CANCELADA",
];

/** Primeiro e último dia do mês corrente, para o filtro de cobranças. */
function inicioDoMes() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function fimDoMes() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
}

/** Primeiro dia do próximo mês, no formato do input de data (AAAA-MM-DD). */
function primeiroDiaDoProximoMes() {
  const hoje = new Date();
  hoje.setMonth(hoje.getMonth() + 1);
  hoje.setDate(1);
  return hoje.toISOString().slice(0, 10);
}

function dataParaBR(data?: string) {
  if (!data || !data.includes("-")) return data || "-";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function dataHoraParaBR(data?: string) {
  if (!data) return "-";
  const d = new Date(data);
  return isNaN(d.getTime()) ? data : d.toLocaleString("pt-BR");
}

function moeda(valor: unknown) {
  const numero = Number(String(valor ?? "0").replace(",", "."));
  return isNaN(numero)
    ? "-"
    : numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Cores do selo de status da recorrência. */
function corDoStatus(status?: string) {
  if (status === "APROVADA")
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "CRIADA") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "CANCELADA") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

const Selo = ({ status }: { status?: string }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${corDoStatus(
      status,
    )}`}
  >
    {status ?? "-"}
  </span>
);

const Campo = ({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: React.ReactNode;
}) => (
  <label className="flex flex-col gap-1">
    <span className="text-sm font-medium text-slate-700">{rotulo}</span>
    {children}
    {dica && <span className="text-xs text-slate-400">{dica}</span>}
  </label>
);

const entrada =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50";

/** Linha "rótulo: valor" usada na ficha de uma recorrência. */
const Linha = ({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 sm:flex-row sm:gap-4 sm:py-2.5">
    <span className="w-full shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500 sm:w-52 sm:text-sm sm:normal-case sm:tracking-normal">
      {rotulo}
    </span>
    <div className="min-w-0 break-words text-sm text-slate-900">{children}</div>
  </div>
);

export const PixAutomatico = () => {
  const [remover, setRemover] = useState(false);
  const [qr, setQrCode] = useState("");
  const [copiado, setCopiado] = useState(false);
  const navigate = useNavigate();
  const [cobrancas, setCobrancas] = useState<any>();
  const [people, setPeople] = useState<
    PixAutomaticoListPeople | PixAutomaticoListOnePeople
  >();
  const [status, setStatus] = useState<"CANCELADA">("CANCELADA");
  const [filtrosActive, setFiltrosActive] = useState(false);
  const [date, setDate] = useState(primeiroDiaDoProximoMes);

  useEffect(() => {
    setPixAutoData((prev) => ({ ...prev, data_inicial: date }));
  }, [date]);

  const [pixAutoData, setPixAutoData] = useState<PixAuto>({
    contrato: "",
    cpf: "",
    nome: "",
    servico: "",
    data_inicial: date,
    periodicidade: "MENSAL",
    valor: "",
    politica: "NAO_PERMITE",
    jornada: "3",
    destinatario: { agencia: "", conta: "", ispbParticipante: "" },
  });
  const [solicitacao, setSolicitacao] = useState<any>(null);
  const [cobs, setCobs] = useState<any[] | null>(null);
  const [filtroCob, setFiltroCob] = useState({
    inicio: inicioDoMes(),
    fim: fimDoMes(),
    status: "TODOS",
    idRec: "",
  });
  const [retentativa, setRetentativa] = useState<{
    txid: string;
    data: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [idRec, setIdRec] = useState("");
  const token = user?.token;
  const permission = user?.permission;
  const [filtros, setFiltros] = useState<FiltrosPix>({ status: "TODOS" });

  async function criarPixAutomatico(e: React.FormEvent) {
    try {
      e.preventDefault();
      setError("");
      setSucesso("");
      setLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/criarPixAutomatico`,
        { pixAutoData },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Nem toda resposta traz o QR da jornada; sem ele a recorrência continua criada.
      setQrCode(response.data?.dadosQR?.pixCopiaECola ?? "");
      setSolicitacao(response.data?.solicitacao ?? null);
      setSucesso(
        response.data?.solicitacao?.idSolicRec
          ? `Recorrência ${response.data?.idRec} criada. A autorização foi enviada ao app do banco do cliente (${response.data.solicitacao.idSolicRec}).`
          : response.data?.idRec
            ? `Recorrência criada: ${response.data.idRec}`
            : "Recorrência criada.",
      );
    } catch (error: any) {
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function gerarCobranca(e: React.FormEvent) {
    try {
      setQrCode("");
      e.preventDefault();
      setError("");
      setSucesso("");
      setLoading(true);
      await axios.post(
        `${process.env.REACT_APP_URL}/Pix/criarCobrancaPixAutomatico`,
        { pixAutoData },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSucesso("Cobrança de teste gerada.");
    } catch (error: any) {
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function getClientesPixAutomatico() {
    try {
      setLoading(true);
      setError("");
      setSucesso("");

      if (!filtrosActive) {
        const response = await axios.post(
          `${process.env.REACT_APP_URL}/Pix/getPixAutomaticoClients`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setPeople(response.data);
        setCobrancas(undefined);
      } else if (filtrosActive && filtros.idRec) {
        const client = await axios.post(
          `${process.env.REACT_APP_URL}/Pix/getPixAutomaticoOneClient`,
          { filtros },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        setPeople(client.data?.response ?? undefined);
        setQrCode(client.data?.response?.dadosQR?.pixCopiaECola ?? "");
        setCobrancas(client.data?.response2?.cobsr);
      } else if (filtrosActive && !filtros.idRec) {
        const response = await axios.post(
          `${process.env.REACT_APP_URL}/Pix/getPixAutomaticoClients`,
          { filtros },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setPeople(response.data);
        setCobrancas(undefined);
      }
    } catch (error: any) {
      if (error?.response) {
        setError(extractErrorMessage(error));
      } else {
        console.error("Erro inesperado:", error);
        setError(
          "Erro de conexão com o servidor. Verifique sua rede ou tente novamente.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function atualizarPixAutomatico(e: React.FormEvent) {
    try {
      e.preventDefault();
      setError("");
      setSucesso("");
      setLoading(true);
      await axios.post(
        `${process.env.REACT_APP_URL}/Pix/atualizarPixAutomaticoClients`,
        { idRec, status },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSucesso(`Recorrência ${idRec} marcada como ${status}.`);
    } catch (error: any) {
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function navegarCancelar() {
    navigate("/Pix/Cancelar/Cobranca");
  }

  /** Cobranças do Pix Automático no período escolhido. */
  async function listarCobrancas() {
    try {
      setLoading(true);
      setError("");
      setSucesso("");
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/listarCobrancasPixAutomatico`,
        {
          inicio: `${filtroCob.inicio}T00:00:00Z`,
          fim: `${filtroCob.fim}T23:59:59Z`,
          status: filtroCob.status,
          idRec: filtroCob.idRec || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setCobs(response.data?.cobsr ?? []);
    } catch (error: any) {
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function cancelarCobranca(txid: string) {
    try {
      setLoading(true);
      setError("");
      setSucesso("");
      await axios.post(
        `${process.env.REACT_APP_URL}/Pix/cancelarCobranca`,
        { txid },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSucesso(`Cobrança ${txid} cancelada.`);
      await listarCobrancas();
    } catch (error: any) {
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Nova tentativa de uma cobrança não paga. Só funciona quando a recorrência
   * foi criada com a política que permite retentativa.
   */
  async function enviarRetentativa() {
    if (!retentativa?.txid || !retentativa?.data) return;
    try {
      setLoading(true);
      setError("");
      setSucesso("");
      await axios.post(
        `${process.env.REACT_APP_URL}/Pix/retentativaCobranca`,
        { txid: retentativa.txid, data: retentativa.data },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSucesso(
        `Nova tentativa da cobrança ${retentativa.txid} agendada para ${dataParaBR(
          retentativa.data,
        )}.`,
      );
      setRetentativa(null);
      await listarCobrancas();
    } catch (error: any) {
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  /** Jornada 1: cancela a autorização que foi enviada ao app do banco. */
  async function cancelarSolicitacao() {
    if (!solicitacao?.idSolicRec) return;
    try {
      setLoading(true);
      setError("");
      setSucesso("");
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/cancelarSolicitacaoRecorrencia`,
        { idSolicRec: solicitacao.idSolicRec },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSolicitacao(response.data ?? null);
      setSucesso("Solicitação cancelada.");
    } catch (error: any) {
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  /** Jornada 1: verifica se o cliente já confirmou no app do banco. */
  async function consultarSolicitacao() {
    if (!solicitacao?.idSolicRec) return;
    try {
      setLoading(true);
      setError("");
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/buscarSolicitacaoRecorrencia`,
        { idSolicRec: solicitacao.idSolicRec },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSolicitacao(response.data ?? null);
      setSucesso(`Situação da solicitação: ${response.data?.status ?? "-"}.`);
    } catch (error: any) {
      setError(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function copiarQr() {
    await navigator.clipboard.writeText(qr);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  // 🔧 Função que converte qualquer tipo de erro em string segura
  function stringifySafe(x: any): string {
    if (typeof x === "string") return x;
    try {
      return JSON.stringify(x);
    } catch {
      return String(x);
    }
  }

  // 🔧 Função que captura qualquer tipo de erro (string, objeto, AxiosError, etc.)
  function extractErrorMessage(err: any): string {
    if (err && err.response) {
      const d = err.response.data;
      if (typeof d === "string") return d;
      if (d == null) return `HTTP ${err.response.status || ""}`;
      return d.error || d.erro || d.message || stringifySafe(d);
    }
    if (err && err.request) {
      return "Falha de rede ou servidor indisponível.";
    }
    if (err instanceof Error && err.message) return err.message;
    return stringifySafe(err);
  }

  const lista = (people as PixAutomaticoListPeople)?.recs;
  const um = (people as PixAutomaticoListOnePeople)?.idRec
    ? (people as PixAutomaticoListOnePeople)
    : undefined;

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Cabeçalho */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Pix Automático
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Cadastre a cobrança recorrente do cliente e acompanhe as
              recorrências já criadas.
            </p>
          </div>

          {permission! >= 5 && (
            <button
              onClick={() => navigate("/Pix/automaticoAdmin")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              title="Configurações"
            >
              <CiSettings className="size-5" />
              <span className="hidden sm:inline">Configurações</span>
            </button>
          )}
        </div>

        {/* Avisos */}
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span className="font-semibold">Erro: </span>
            <span className="break-words">{error}</span>
          </div>
        )}
        {sucesso && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {sucesso}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Cadastro / desativação */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
            <div className="mb-5 inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setRemover(false)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  !remover
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Adicionar cliente
              </button>
              <button
                type="button"
                onClick={() => setRemover(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  remover
                    ? "bg-white text-rose-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Desativar cliente
              </button>
            </div>

            {!remover ? (
              <form
                onSubmit={criarPixAutomatico}
                className="flex flex-col gap-4"
              >
                <Campo
                  rotulo="Como o cliente autoriza"
                  dica={
                    JORNADAS.find((j) => j.valor === pixAutoData.jornada)?.ajuda
                  }
                >
                  <select
                    className={entrada}
                    value={pixAutoData.jornada}
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        jornada: e.target.value,
                      }))
                    }
                  >
                    {JORNADAS.map((j) => (
                      <option key={j.valor} value={j.valor}>
                        {j.rotulo}
                      </option>
                    ))}
                  </select>
                </Campo>

                {pixAutoData.jornada === "1" && (
                  <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
                    <Campo rotulo="Agência">
                      <input
                        className={entrada}
                        type="text"
                        inputMode="numeric"
                        placeholder="0001"
                        value={pixAutoData.destinatario?.agencia ?? ""}
                        onChange={(e) =>
                          setPixAutoData((prev) => ({
                            ...prev,
                            destinatario: {
                              ...prev.destinatario,
                              agencia: e.target.value,
                            },
                          }))
                        }
                      />
                    </Campo>
                    <Campo rotulo="Conta">
                      <input
                        className={entrada}
                        type="text"
                        inputMode="numeric"
                        placeholder="123456"
                        value={pixAutoData.destinatario?.conta ?? ""}
                        onChange={(e) =>
                          setPixAutoData((prev) => ({
                            ...prev,
                            destinatario: {
                              ...prev.destinatario,
                              conta: e.target.value,
                            },
                          }))
                        }
                      />
                    </Campo>
                    <Campo rotulo="ISPB do banco" dica="8 dígitos.">
                      <input
                        className={entrada}
                        type="text"
                        inputMode="numeric"
                        placeholder="00000000"
                        value={pixAutoData.destinatario?.ispbParticipante ?? ""}
                        onChange={(e) =>
                          setPixAutoData((prev) => ({
                            ...prev,
                            destinatario: {
                              ...prev.destinatario,
                              ispbParticipante: e.target.value,
                            },
                          }))
                        }
                      />
                    </Campo>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo rotulo="Contrato">
                    <input
                      className={entrada}
                      type="text"
                      placeholder="Número do contrato"
                      value={pixAutoData.contrato}
                      onChange={(e) =>
                        setPixAutoData((prev) => ({
                          ...prev,
                          contrato: e.target.value,
                        }))
                      }
                    />
                  </Campo>

                  <Campo
                    rotulo="CPF ou CNPJ"
                    dica="Pode digitar com ou sem pontuação."
                  >
                    <input
                      className={entrada}
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={pixAutoData.cpf}
                      onChange={(e) =>
                        setPixAutoData((prev) => ({
                          ...prev,
                          cpf: e.target.value,
                        }))
                      }
                    />
                  </Campo>

                  <Campo
                    rotulo="Login (PPPoE)"
                    dica="Login do cliente no sistema."
                  >
                    <input
                      className={entrada}
                      type="text"
                      placeholder="joao.silva"
                      value={pixAutoData.nome}
                      onChange={(e) =>
                        setPixAutoData((prev) => ({
                          ...prev,
                          nome: e.target.value,
                        }))
                      }
                    />
                  </Campo>

                  <Campo rotulo="Serviço">
                    <input
                      className={entrada}
                      type="text"
                      placeholder="Internet 800 Mega"
                      value={pixAutoData.servico}
                      onChange={(e) =>
                        setPixAutoData((prev) => ({
                          ...prev,
                          servico: e.target.value,
                        }))
                      }
                    />
                  </Campo>

                  <Campo
                    rotulo="Data inicial"
                    dica="Primeira cobrança da recorrência."
                  >
                    <input
                      className={entrada}
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </Campo>

                  <Campo rotulo="Periodicidade">
                    <select
                      className={entrada}
                      value={pixAutoData.periodicidade}
                      onChange={(e) =>
                        setPixAutoData((prev) => ({
                          ...prev,
                          periodicidade: e.target.value,
                        }))
                      }
                    >
                      {PERIODICIDADES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </Campo>

                  <Campo rotulo="Valor" dica="Ex.: 89,90">
                    <input
                      className={entrada}
                      type="text"
                      inputMode="decimal"
                      placeholder="89,90"
                      value={pixAutoData.valor}
                      onChange={(e) =>
                        setPixAutoData((prev) => ({
                          ...prev,
                          valor: e.target.value,
                        }))
                      }
                    />
                  </Campo>

                  <Campo rotulo="Política de retentativa">
                    <select
                      className={entrada}
                      value={pixAutoData.politica}
                      onChange={(e) =>
                        setPixAutoData((prev) => ({
                          ...prev,
                          politica: e.target.value,
                        }))
                      }
                    >
                      {POLITICAS.map((p) => (
                        <option key={p.valor} value={p.valor}>
                          {p.rotulo}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <MdAutorenew className="size-5" />
                    {loading ? "Enviando..." : "Cadastrar no Pix Automático"}
                  </button>

                  {permission! >= 5 && (
                    <button
                      type="button"
                      onClick={gerarCobranca}
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      title="Gera uma cobrança avulsa para testes"
                    >
                      Gerar cobrança (teste)
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <form
                onSubmit={atualizarPixAutomatico}
                className="flex flex-col gap-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo
                    rotulo="IdRec"
                    dica="Identificador da recorrência a desativar."
                  >
                    <input
                      className={entrada}
                      type="text"
                      placeholder="RN09089356202510176a86b02579f"
                      value={idRec}
                      onChange={(e) => setIdRec(e.target.value)}
                    />
                  </Campo>

                  <Campo rotulo="Novo status">
                    <select
                      className={entrada}
                      value={status}
                      onChange={(e) => setStatus(e.target.value as "CANCELADA")}
                    >
                      <option value="CANCELADA">CANCELADA</option>
                    </select>
                  </Campo>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading || !idRec}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {loading ? "Enviando..." : "Desativar recorrência"}
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Consulta */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Clientes já cadastrados
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Sem filtro, traz todas as recorrências. Com o IdRec, abre a ficha
              completa do cliente.
            </p>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={filtrosActive}
                onChange={() => setFiltrosActive((prev) => !prev)}
                className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <FiFilter className="size-4 text-slate-400" />
              Usar filtros
            </label>

            {filtrosActive && (
              <div className="mt-4 flex flex-col gap-4 rounded-xl bg-slate-50 p-4">
                <Campo rotulo="Status">
                  <select
                    className={entrada}
                    value={filtros.status ?? "TODOS"}
                    onChange={(e) =>
                      setFiltros((prev) => ({
                        ...prev,
                        status: e.target.value as FiltrosPix["status"],
                      }))
                    }
                  >
                    <option value="TODOS">Todos</option>
                    <option value="CRIADA">Criada</option>
                    <option value="APROVADA">Aprovada</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </Campo>

                <Campo rotulo="IdRec" dica="Preenchido, busca só esse cliente.">
                  <input
                    className={entrada}
                    type="text"
                    placeholder="RN09089356202510176a86b02579f"
                    value={filtros.idRec ?? ""}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, idRec: e.target.value }))
                    }
                  />
                </Campo>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={getClientesPixAutomatico}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <FiSearch className="size-4" />
                {loading ? "Buscando..." : "Buscar"}
              </button>
              <button
                onClick={navegarCancelar}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Buscar cobranças
              </button>
            </div>

            {solicitacao?.idSolicRec && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Autorização no app do banco
                  </h3>
                  <Selo status={solicitacao.status} />
                </div>
                <p className="mt-2 break-all font-mono text-xs text-slate-500">
                  {solicitacao.idSolicRec}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={consultarSolicitacao}
                    disabled={loading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:text-slate-400"
                  >
                    Atualizar situação
                  </button>
                  <button
                    onClick={cancelarSolicitacao}
                    disabled={loading}
                    className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:text-slate-400"
                  >
                    Cancelar solicitação
                  </button>
                </div>
              </div>
            )}

            {qr && (
              <div className="mt-5 flex flex-col items-center gap-3 rounded-xl bg-slate-50 p-4">
                <QRCodeCanvas value={qr} size={200} />
                <button
                  onClick={copiarQr}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  {copiado ? (
                    <>
                      <FiCheck className="size-4 text-emerald-600" /> Copiado
                    </>
                  ) : (
                    <>
                      <FiCopy className="size-4" /> Copiar Pix Copia e Cola
                    </>
                  )}
                </button>
                <p className="w-full break-all text-center text-xs text-slate-400">
                  {qr}
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Lista de recorrências */}
        {Array.isArray(lista) && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Recorrências encontradas: {lista.length}
              </h2>
            </div>

            {lista.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                Nenhuma recorrência encontrada com esse filtro.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        "IdRec",
                        "Contrato",
                        "Devedor",
                        "Valor",
                        "Periodicidade",
                        "Status",
                      ].map((t) => (
                        <th
                          key={t}
                          className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700"
                        >
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lista.map((person) => (
                      <tr key={person.idRec} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-900">
                          {person.idRec}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
                          {person.vinculo?.contrato ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {person.vinculo?.devedor?.nome ?? "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                          {moeda(person.valor?.valorRec)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                          {person.calendario?.periodicidade ?? "-"}
                        </td>
                        <td className="px-4 py-3">
                          <Selo status={person.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Ficha de uma recorrência */}
        {um && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  {um.vinculo?.devedor?.nome ?? "Recorrência"}
                </h2>
                <Selo status={um.status} />
              </div>

              <Linha rotulo="ID da recorrência">
                <span className="font-mono text-xs">{um.idRec}</span>
              </Linha>
              <Linha rotulo="Contrato">{um.vinculo?.contrato ?? "-"}</Linha>
              <Linha rotulo="CPF/CNPJ">{um.vinculo?.devedor?.cpf ?? "-"}</Linha>
              <Linha rotulo="Valor recorrente">
                {moeda(um.valor?.valorRec)}
              </Linha>
              <Linha rotulo="Periodicidade">
                {um.calendario?.periodicidade ?? "-"}
              </Linha>
              <Linha rotulo="Data inicial">
                {dataParaBR(um.calendario?.dataInicial)}
              </Linha>
              <Linha rotulo="Política de retentativa">
                {um.politicaRetentativa ?? "-"}
              </Linha>
              <Linha rotulo="Recebedor">
                {um.recebedor?.nome ?? "-"} ({um.recebedor?.cnpj ?? "-"})
              </Linha>
              <Linha rotulo="Histórico da recorrência">
                <div className="flex flex-col gap-1">
                  {um.atualizacao?.length ? (
                    um.atualizacao.map((f, idx) => (
                      <div key={idx} className="flex flex-wrap gap-2">
                        <span className="text-slate-500">
                          {dataHoraParaBR(f?.data)}
                        </span>
                        <Selo status={f?.status} />
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </div>
              </Linha>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">
                Cobranças ({(cobrancas ?? []).length})
              </h2>

              {(cobrancas ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhuma cobrança agendada para esta recorrência.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {(cobrancas ?? []).map((c: any, i: number) => (
                    <div
                      key={c?.txid ?? i}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-900">
                          Cobrança {i + 1}
                        </span>
                        <Selo status={c?.status} />
                      </div>

                      <p className="mt-2 break-all font-mono text-xs text-slate-500">
                        {c?.txid ?? "-"}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        Vencimento:{" "}
                        {dataParaBR(c?.calendario?.dataDeVencimento)}
                      </p>

                      {(c?.atualizacao ?? []).length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Atualizações
                          </p>
                          {(c?.atualizacao ?? []).map((f: any, j: number) => (
                            <div
                              key={j}
                              className="mt-1 flex flex-wrap items-center gap-2 text-sm"
                            >
                              <span className="text-slate-500">
                                {dataHoraParaBR(f?.data)}
                              </span>
                              <Selo status={f?.status} />
                            </div>
                          ))}
                        </div>
                      )}

                      {(c?.tentativas ?? []).length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Tentativas
                          </p>
                          {(c?.tentativas ?? []).map((t: any, j: number) =>
                            (t?.atualizacao ?? []).map((a: any, k: number) => (
                              <div
                                key={`${i}-${j}-${k}`}
                                className="mt-1 flex flex-wrap items-center gap-2 text-sm"
                              >
                                <span className="text-slate-500">
                                  {dataHoraParaBR(a?.data)}
                                </span>
                                <Selo status={a?.status} />
                              </div>
                            )),
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Cobranças do Pix Automático */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Cobranças do Pix Automático
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            As cobranças geradas para as recorrências, com a situação de cada
            uma. A nova tentativa só funciona nas recorrências criadas com a
            política que permite retentativa.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Campo rotulo="De">
              <input
                className={entrada}
                type="date"
                value={filtroCob.inicio}
                onChange={(e) =>
                  setFiltroCob((prev) => ({ ...prev, inicio: e.target.value }))
                }
              />
            </Campo>
            <Campo rotulo="Até">
              <input
                className={entrada}
                type="date"
                value={filtroCob.fim}
                onChange={(e) =>
                  setFiltroCob((prev) => ({ ...prev, fim: e.target.value }))
                }
              />
            </Campo>
            <Campo rotulo="Status">
              <select
                className={entrada}
                value={filtroCob.status}
                onChange={(e) =>
                  setFiltroCob((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                {STATUS_COBRANCA.map((s) => (
                  <option key={s} value={s}>
                    {s === "TODOS" ? "Todos" : s}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="IdRec" dica="Opcional.">
              <input
                className={entrada}
                type="text"
                placeholder="Só de uma recorrência"
                value={filtroCob.idRec}
                onChange={(e) =>
                  setFiltroCob((prev) => ({ ...prev, idRec: e.target.value }))
                }
              />
            </Campo>
            <div className="flex items-end">
              <button
                onClick={listarCobrancas}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <FiSearch className="size-4" />
                {loading ? "Buscando..." : "Buscar cobranças"}
              </button>
            </div>
          </div>

          {retentativa && (
            <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-900">
                  Nova tentativa da cobrança
                </p>
                <p className="break-all font-mono text-xs text-amber-700">
                  {retentativa.txid}
                </p>
              </div>
              <Campo rotulo="Data da tentativa">
                <input
                  className={entrada}
                  type="date"
                  value={retentativa.data}
                  onChange={(e) =>
                    setRetentativa((prev) =>
                      prev ? { ...prev, data: e.target.value } : prev,
                    )
                  }
                />
              </Campo>
              <button
                onClick={enviarRetentativa}
                disabled={loading || !retentativa.data}
                className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Confirmar
              </button>
              <button
                onClick={() => setRetentativa(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          )}

          {cobs && (
            <div className="mt-4 overflow-x-auto">
              {cobs.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Nenhuma cobrança nesse período.
                </p>
              ) : (
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        "Txid",
                        "IdRec",
                        "Vencimento",
                        "Valor",
                        "Status",
                        "Ações",
                      ].map((t) => (
                        <th
                          key={t}
                          className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700"
                        >
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cobs.map((c: any) => (
                      <tr key={c?.txid} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-900">
                          {c?.txid ?? "-"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {c?.idRec ?? "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                          {dataParaBR(c?.calendario?.dataDeVencimento)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                          {moeda(c?.valor?.original)}
                        </td>
                        <td className="px-4 py-3">
                          <Selo status={c?.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() =>
                                setRetentativa({
                                  txid: c?.txid,
                                  data:
                                    c?.calendario?.dataDeVencimento?.slice(
                                      0,
                                      10,
                                    ) ?? "",
                                })
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                              Nova tentativa
                            </button>
                            {permission! >= 5 && (
                              <button
                                onClick={() => cancelarCobranca(c?.txid)}
                                className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 shadow-sm transition hover:bg-rose-50"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        {loading && (
          <p className="mt-6 text-center text-sm text-slate-500">
            Carregando...
          </p>
        )}
      </div>
    </div>
  );
};
