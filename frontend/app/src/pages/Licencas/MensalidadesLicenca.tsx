import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  FaQrcode,
  FaCheck,
  FaUndo,
  FaSyncAlt,
  FaCopy,
  FaPlus,
  FaPen,
  FaExternalLinkAlt,
} from "react-icons/fa";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";

interface Mensalidade {
  id: number;
  licencaId: number;
  software: string | null;
  clienteNome: string | null;
  competencia: string;
  avulsa?: boolean | number;
  vencimento: string;
  valor: string;
  status: string;
  txid: string | null;
  pixCopiaCola: string | null;
  pixLink: string | null;
  valorPago: string | null;
  pagoEm: string | null;
  formaPagamento: string | null;
}

interface LicencaResumo {
  id: number;
  cliente_nome: string;
  software: string | null;
  status: string;
}

interface Configuracao {
  software: string;
  diaVencimento: number;
  valor: string;
}

const avulsaVazia = {
  licencaId: "",
  competencia: "",
  vencimento: "",
  valor: "",
  observacao: "",
  gerarPix: true,
};

const campo =
  "border rounded px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200";

function competenciaAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function dataBR(data?: string | null) {
  if (!data) return "-";
  const [ano, mes, dia] = String(data).slice(0, 10).split("-");
  return dia ? `${dia}/${mes}/${ano}` : String(data);
}

function moeda(valor?: string | null) {
  const numero = Number(valor ?? 0);
  return isNaN(numero)
    ? "-"
    : numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Aberta com vencimento passado aparece como vencida, mas nada é bloqueado. */
function situacao(m: Mensalidade) {
  if (m.status !== "aberta") return m.status;
  const hoje = new Date().toISOString().slice(0, 10);
  return String(m.vencimento).slice(0, 10) < hoje ? "vencida" : "aberta";
}

function corDaSituacao(s: string) {
  if (s === "paga") return "bg-green-100 text-green-800";
  if (s === "vencida") return "bg-red-100 text-red-800";
  if (s === "cancelada") return "bg-gray-100 text-gray-700";
  return "bg-blue-100 text-blue-800";
}

/** Mensalidades das licenças: geração, Pix e baixa. */
export const MensalidadesLicenca = () => {
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [status, setStatus] = useState("todos");
  const [loading, setLoading] = useState(false);
  const [pixAberto, setPixAberto] = useState<Mensalidade | null>(null);
  const [avulsa, setAvulsa] = useState<typeof avulsaVazia | null>(null);
  const [licencas, setLicencas] = useState<LicencaResumo[]>([]);
  const [configs, setConfigs] = useState<Configuracao[]>([]);
  const [novoValor, setNovoValor] = useState<string | null>(null);

  const { user } = useAuth();
  const token = user?.token;
  const { showError, showSuccess } = useNotification();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const resposta = await axios.get(
        `${process.env.REACT_APP_URL}/licenca/mensalidades`,
        {
          params: { competencia: competencia || undefined, status },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setMensalidades(resposta.data ?? []);
    } catch (error) {
      console.error(error);
      showError("Erro ao carregar as mensalidades.");
    } finally {
      setLoading(false);
    }
  }, [token, competencia, status, showError]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const gerar = async () => {
    if (
      !window.confirm(
        `Gerar as mensalidades de ${competencia}? Quem já tem mensalidade no mês não é duplicado.`,
      )
    )
      return;
    try {
      setLoading(true);
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/licenca/mensalidades/gerar`,
        { competencia },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const r = resposta.data ?? {};
      showSuccess(
        `${r.criadas ?? 0} mensalidade(s) criada(s), ${r.jaExistiam ?? 0} já existia(m).`,
      );
      carregar();
    } catch (error: any) {
      showError(error?.response?.data?.message || "Erro ao gerar.");
    } finally {
      setLoading(false);
    }
  };

  /** Abre o formulário e busca as licenças e as regras de cada software. */
  const abrirAvulsa = async () => {
    setAvulsa({ ...avulsaVazia, competencia });
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [l, c] = await Promise.all([
        axios.get(`${process.env.REACT_APP_URL}/licenca/listar`, { headers }),
        axios.get(`${process.env.REACT_APP_URL}/licenca/mensalidades/config`, {
          headers,
        }),
      ]);
      setLicencas(
        [...(l.data ?? [])].sort((a: LicencaResumo, b: LicencaResumo) =>
          String(a.cliente_nome).localeCompare(String(b.cliente_nome)),
        ),
      );
      setConfigs(c.data?.configuracoes ?? []);
    } catch (error) {
      console.error(error);
      showError("Erro ao carregar as licenças.");
    }
  };

  /** Ao escolher o cliente, sugere valor e vencimento da regra do software. */
  const escolherLicenca = (licencaId: string) => {
    if (!avulsa) return;
    const licenca = licencas.find((l) => String(l.id) === licencaId);
    const config = configs.find((c) => c.software === licenca?.software);
    const proximo = { ...avulsa, licencaId };
    if (config) {
      proximo.valor = proximo.valor || String(Number(config.valor));
      if (!proximo.vencimento && proximo.competencia) {
        const [ano, mes] = proximo.competencia.split("-").map(Number);
        const dia = Math.min(
          config.diaVencimento,
          new Date(ano, mes, 0).getDate(),
        );
        proximo.vencimento = `${proximo.competencia}-${String(dia).padStart(2, "0")}`;
      }
    }
    setAvulsa(proximo);
  };

  const salvarAvulsa = async () => {
    if (!avulsa) return;
    if (!avulsa.licencaId) {
      showError("Selecione o cliente.");
      return;
    }
    try {
      setLoading(true);
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/licenca/mensalidades/avulsa`,
        {
          licencaId: Number(avulsa.licencaId),
          competencia: avulsa.competencia,
          vencimento: avulsa.vencimento || undefined,
          valor: avulsa.valor,
          observacao: avulsa.observacao,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const criada: Mensalidade = resposta.data;
      const comPix = avulsa.gerarPix;
      setAvulsa(null);
      showSuccess("Cobrança criada.");
      if (comPix) await gerarPix(criada);
      else carregar();
    } catch (error: any) {
      showError(error?.response?.data?.message || "Erro ao criar a cobrança.");
    } finally {
      setLoading(false);
    }
  };

  const gerarPix = async (m: Mensalidade) => {
    try {
      setLoading(true);
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/licenca/mensalidades/${m.id}/pix`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      abrirPix(resposta.data);
      showSuccess("Pix gerado.");
      carregar();
    } catch (error: any) {
      showError(error?.response?.data?.message || "Erro ao gerar o Pix.");
    } finally {
      setLoading(false);
    }
  };

  const acao = async (m: Mensalidade, rota: string, mensagem: string) => {
    try {
      setLoading(true);
      await axios.post(
        `${process.env.REACT_APP_URL}/licenca/mensalidades/${m.id}/${rota}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      showSuccess(mensagem);
      carregar();
    } catch (error: any) {
      showError(error?.response?.data?.message || "Não foi possível concluir.");
    } finally {
      setLoading(false);
    }
  };

  const copiar = async (
    texto: string,
    mensagem = "Pix copia e cola copiado.",
  ) => {
    await navigator.clipboard.writeText(texto);
    showSuccess(mensagem);
  };

  const abrirPix = (m: Mensalidade | null) => {
    setNovoValor(null);
    setPixAberto(m);
  };

  /** Troca o valor; com Pix já gerado, a cobrança na Efí é alterada junto. */
  const salvarValor = async () => {
    if (!pixAberto || novoValor === null) return;
    try {
      setLoading(true);
      const resposta = await axios.put(
        `${process.env.REACT_APP_URL}/licenca/mensalidades/${pixAberto.id}/valor`,
        { valor: novoValor },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      abrirPix(resposta.data);
      showSuccess("Valor alterado.");
      carregar();
    } catch (error: any) {
      showError(error?.response?.data?.message || "Erro ao alterar o valor.");
    } finally {
      setLoading(false);
    }
  };

  const totalAberto = mensalidades
    .filter((m) => m.status === "aberta")
    .reduce((soma, m) => soma + Number(m.valor || 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white shadow-md rounded-lg p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-gray-500">
              Competência
            </span>
            <input
              className={`${campo} w-36`}
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-gray-500">
              Situação
            </span>
            <select
              className={`${campo} w-36`}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="todos">Todas</option>
              <option value="aberta">Abertas</option>
              <option value="paga">Pagas</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </label>

          <button
            onClick={carregar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-400"
          >
            <FaSyncAlt /> Atualizar
          </button>

          <button
            onClick={gerar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-400"
          >
            Gerar mensalidades do mês
          </button>

          <button
            onClick={abrirAvulsa}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-gray-400"
          >
            <FaPlus /> Nova cobrança avulsa
          </button>

          <span className="ml-auto text-sm text-gray-600">
            Em aberto: <strong>{moeda(String(totalAberto))}</strong>
          </span>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Cliente",
                  "Software",
                  "Competência",
                  "Vencimento",
                  "Valor",
                  "Situação",
                  "Ações",
                ].map((t) => (
                  <th
                    key={t}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm">
                    Carregando...
                  </td>
                </tr>
              ) : mensalidades.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-gray-500"
                  >
                    Nenhuma mensalidade nesse filtro. Configure o software na
                    aba de configuração e gere o mês.
                  </td>
                </tr>
              ) : (
                mensalidades.map((m) => {
                  const s = situacao(m);
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {m.clienteNome ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {m.software ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {m.competencia}
                        {!!m.avulsa && (
                          <span className="ml-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            AVULSA
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {dataBR(m.vencimento)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {moeda(m.valor)}
                        {m.status === "paga" && m.pagoEm && (
                          <span className="block text-xs text-gray-400">
                            pago em {dataBR(m.pagoEm)} ({m.formaPagamento})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${corDaSituacao(s)}`}
                        >
                          {s.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-3">
                          {m.status !== "paga" && (
                            <button
                              onClick={() =>
                                m.pixCopiaCola ? abrirPix(m) : gerarPix(m)
                              }
                              className="text-indigo-600 hover:text-indigo-900"
                              title={
                                m.pixCopiaCola ? "Ver o Pix" : "Gerar o Pix"
                              }
                            >
                              <FaQrcode />
                            </button>
                          )}
                          {m.status !== "paga" && (
                            <button
                              onClick={() =>
                                acao(m, "baixar", "Mensalidade baixada.")
                              }
                              className="text-green-600 hover:text-green-900"
                              title="Marcar como paga"
                            >
                              <FaCheck />
                            </button>
                          )}
                          {/* Só a baixa manual se desfaz: pagamento por Pix
                              foi confirmado pela Efí e reabrir cobraria de
                              novo quem já pagou. */}
                          {m.status === "paga" &&
                            m.formaPagamento !== "pix" && (
                              <button
                                onClick={() =>
                                  acao(m, "reabrir", "Mensalidade reaberta.")
                                }
                                className="text-amber-600 hover:text-amber-900"
                                title="Desfazer a baixa manual"
                              >
                                <FaUndo />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {avulsa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Nova cobrança avulsa
              </h3>
              <button
                onClick={() => setAvulsa(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                X
              </button>
            </div>

            <div className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Cliente
                </span>
                <select
                  className={campo}
                  value={avulsa.licencaId}
                  onChange={(e) => escolherLicenca(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {licencas.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.cliente_nome}
                      {l.software ? ` — ${l.software}` : ""}
                      {l.status !== "ativo" ? ` (${l.status})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase text-gray-500">
                    Competência
                  </span>
                  <input
                    className={campo}
                    type="month"
                    value={avulsa.competencia}
                    onChange={(e) =>
                      setAvulsa({ ...avulsa, competencia: e.target.value })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase text-gray-500">
                    Vencimento
                  </span>
                  <input
                    className={campo}
                    type="date"
                    value={avulsa.vencimento}
                    onChange={(e) =>
                      setAvulsa({ ...avulsa, vencimento: e.target.value })
                    }
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Valor (R$)
                </span>
                <input
                  className={campo}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={avulsa.valor}
                  onChange={(e) =>
                    setAvulsa({ ...avulsa, valor: e.target.value })
                  }
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Observação
                </span>
                <input
                  className={campo}
                  value={avulsa.observacao}
                  onChange={(e) =>
                    setAvulsa({ ...avulsa, observacao: e.target.value })
                  }
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={avulsa.gerarPix}
                  onChange={(e) =>
                    setAvulsa({ ...avulsa, gerarPix: e.target.checked })
                  }
                />
                Já gerar o Pix
              </label>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              A avulsa é extra: não substitui nem conta como a mensalidade do
              mês. Vencimento e valor em branco usam a regra do software.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setAvulsa(null)}
                className="rounded border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarAvulsa}
                disabled={loading}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-gray-400"
              >
                Criar cobrança
              </button>
            </div>
          </div>
        </div>
      )}

      {pixAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Pix da mensalidade
              </h3>
              <button
                onClick={() => abrirPix(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                X
              </button>
            </div>

            <p className="text-sm text-gray-600">
              {pixAberto.clienteNome} — {pixAberto.software} —{" "}
              {pixAberto.competencia}
            </p>
            {novoValor === null ? (
              <div className="mt-1 flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">
                  {moeda(pixAberto.valor)}
                </p>
                {pixAberto.status === "aberta" && (
                  <button
                    onClick={() =>
                      setNovoValor(String(Number(pixAberto.valor)))
                    }
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-900"
                    title="Editar o valor"
                  >
                    <FaPen /> Editar valor
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <input
                  className={`${campo} w-32`}
                  inputMode="decimal"
                  autoFocus
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && salvarValor()}
                />
                <button
                  onClick={salvarValor}
                  disabled={loading}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setNovoValor(null)}
                  className="rounded border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* O QR é desenhado do próprio copia e cola. O link da Efí
                (pixLink) é uma página de visualização, não uma imagem. */}
            {pixAberto.pixCopiaCola && (
              <div className="my-4 flex justify-center">
                <QRCodeCanvas value={pixAberto.pixCopiaCola} size={220} />
              </div>
            )}

            {pixAberto.pixCopiaCola && (
              <>
                <p className="break-all rounded bg-gray-100 p-3 text-xs text-gray-700">
                  {pixAberto.pixCopiaCola}
                </p>
                <button
                  onClick={() => copiar(pixAberto.pixCopiaCola as string)}
                  className="mt-3 inline-flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <FaCopy /> Copiar Pix copia e cola
                </button>
              </>
            )}

            {/* Página de pagamento da Efí ligada à location da cobrança: é
                o link para mandar ao cliente pagar pelo navegador. */}
            {pixAberto.pixLink && (
              <div className="mt-4">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Link de pagamento
                </span>
                <a
                  href={pixAberto.pixLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all rounded bg-gray-100 p-3 text-xs text-indigo-700 hover:underline"
                >
                  {pixAberto.pixLink}
                </a>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() =>
                      copiar(
                        pixAberto.pixLink as string,
                        "Link de pagamento copiado.",
                      )
                    }
                    className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <FaCopy /> Copiar link
                  </button>
                  <a
                    href={pixAberto.pixLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <FaExternalLinkAlt /> Abrir
                  </a>
                </div>
              </div>
            )}

            <p className="mt-4 text-xs text-gray-500">
              Quando o cliente pagar, a baixa é automática e acontece só aqui —
              mensalidade de internet no MKAUTH não é tocada.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
