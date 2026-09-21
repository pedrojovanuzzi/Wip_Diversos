import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FaFileInvoiceDollar, FaSyncAlt } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";

interface Mensalidade {
  id: number;
  licencaId: number;
  software: string | null;
  clienteNome: string | null;
  competencia: string;
  vencimento: string;
  valor: string;
  status: string;
  nfseNumero: string | null;
  nfseChave: string | null;
  nfseEmitidaEm: string | null;
  nfseCanceladaEm: string | null;
  nfseErro: string | null;
}

const campo =
  "border rounded px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200";

/** Item 01.05 da LC 116: licenciamento ou cessão de direito de uso de software. */
const ITEM_PADRAO = "010501";

function competenciaAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function moeda(valor?: string | null) {
  const numero = Number(valor ?? 0);
  return isNaN(numero)
    ? "-"
    : numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataBR(data?: string | null) {
  if (!data) return "-";
  const d = new Date(data);
  return isNaN(d.getTime()) ? String(data) : d.toLocaleDateString("pt-BR");
}

/**
 * Emissão manual da NFS-e de cada mensalidade de licença.
 *
 * Licenciamento de uso de software é serviço (item 01.05 da LC 116/2003), por
 * isso NFS-e e não NF-e. A emissão é sempre disparada por você: nada sai
 * sozinho.
 */
export const NotasFiscaisLicenca = () => {
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [loading, setLoading] = useState(false);
  const [emitindo, setEmitindo] = useState<Mensalidade | null>(null);

  const [ambiente, setAmbiente] = useState("homologacao");
  const [password, setPassword] = useState("");
  const [ultimoRps, setUltimoRps] = useState("");
  const [aliquota, setAliquota] = useState("5.0000");
  const [servico, setServico] = useState(ITEM_PADRAO);
  const [descricao, setDescricao] = useState("");

  const { user } = useAuth();
  const token = user?.token;
  const { showError, showSuccess } = useNotification();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const resposta = await axios.get(
        `${process.env.REACT_APP_URL}/licenca/mensalidades`,
        {
          params: { competencia: competencia || undefined, status: "todos" },
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
  }, [token, competencia, showError]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /**
   * Último RPS já usado no ambiente, para o campo não depender de memória:
   * repetir um número faz a prefeitura recusar (N-E0014).
   */
  const buscarUltimoRps = useCallback(
    async (amb: string) => {
      try {
        const resposta = await axios.get(
          `${process.env.REACT_APP_URL}/licenca/mensalidades/ultimo-rps`,
          {
            params: { ambiente: amb },
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (resposta.data?.ultimoRps) {
          setUltimoRps(String(resposta.data.ultimoRps));
        }
      } catch {
        // Sem sugestão, o campo segue em branco para digitar na mão.
      }
    },
    [token],
  );

  const abrirEmissao = (m: Mensalidade) => {
    setEmitindo(m);
    setDescricao(
      `Licenciamento de uso do software ${m.software ?? ""} - competencia ${m.competencia}`,
    );
    buscarUltimoRps(ambiente);
  };

  /**
   * Registra uma nota que já saiu na prefeitura. Não emite nada — serve para
   * quando a emissão foi aceita lá e falhou ao gravar aqui.
   */
  const vincular = async (m: Mensalidade) => {
    const numero = window.prompt(
      `Número da NFS-e já emitida para ${m.clienteNome} (${m.competencia}):`,
    );
    if (!numero) return;
    const chave = window.prompt("Chave de acesso (opcional):") || "";

    try {
      setLoading(true);
      await axios.post(
        `${process.env.REACT_APP_URL}/licenca/mensalidades/${m.id}/vincular-nfse`,
        { numero, chave },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      showSuccess("Nota registrada.");
      carregar();
    } catch (error: any) {
      showError(error?.response?.data?.message || "Erro ao registrar a nota.");
    } finally {
      setLoading(false);
    }
  };

  /** Cancela a nota na prefeitura. Pede a senha do certificado na hora. */
  const cancelarNota = async (m: Mensalidade) => {
    if (
      !window.confirm(
        `Cancelar a NFS-e nº ${m.nfseNumero} na prefeitura? Isso vale fiscalmente e não tem volta.`,
      )
    )
      return;

    const senha = window.prompt("Senha do certificado:");
    if (!senha) return;

    try {
      setLoading(true);
      await axios.post(
        `${process.env.REACT_APP_URL}/licenca/mensalidades/${m.id}/cancelar-nfse`,
        { password: senha, ambiente },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      showSuccess("Nota cancelada na prefeitura.");
      carregar();
    } catch (error: any) {
      showError(error?.response?.data?.message || "Erro ao cancelar a nota.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Só desfaz o vínculo aqui. A nota, se estiver válida na prefeitura,
   * continua válida — por isso o aviso é explícito.
   */
  const removerNota = async (m: Mensalidade) => {
    if (
      !window.confirm(
        `Remover a nota nº ${m.nfseNumero} apenas deste sistema?\n\nIsso NÃO cancela nada na prefeitura: se a nota estiver válida lá, continua valendo, e esta mensalidade volta a permitir emissão (risco de emitir uma segunda nota para o mesmo mês).`,
      )
    )
      return;

    try {
      setLoading(true);
      await axios.post(
        `${process.env.REACT_APP_URL}/licenca/mensalidades/${m.id}/desvincular-nfse`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      showSuccess("Nota removida deste sistema.");
      carregar();
    } catch (error: any) {
      showError(error?.response?.data?.message || "Erro ao remover a nota.");
    } finally {
      setLoading(false);
    }
  };

  const emitir = async () => {
    if (!emitindo) return;
    if (!password) {
      showError("Informe a senha do certificado.");
      return;
    }
    if (!/^\d+$/.test(ultimoRps.trim())) {
      showError("Informe o último número de RPS usado.");
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        `${process.env.REACT_APP_URL}/licenca/mensalidades/${emitindo.id}/nfse`,
        {
          password,
          ambiente,
          ultimoRps: ultimoRps.trim(),
          aliquota,
          servico,
          descricao,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      showSuccess("NFS-e emitida.");
      setEmitindo(null);
      setPassword("");
      carregar();
    } catch (error: any) {
      showError(error?.response?.data?.message || "Erro ao emitir a nota.");
    } finally {
      setLoading(false);
    }
  };

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

          <button
            onClick={carregar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-400"
          >
            <FaSyncAlt /> Atualizar
          </button>

          <p className="ml-auto max-w-xl text-xs text-gray-500">
            Licenciamento de software é serviço (item 01.05 da LC 116/2003),
            então a nota é NFS-e. Confirme com seu contador o código e a
            alíquota do município antes da primeira nota real.
          </p>
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
                  "Valor",
                  "Nota fiscal",
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
                  <td colSpan={6} className="px-4 py-6 text-center text-sm">
                    Carregando...
                  </td>
                </tr>
              ) : mensalidades.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-gray-500"
                  >
                    Nenhuma mensalidade nessa competência.
                  </td>
                </tr>
              ) : (
                mensalidades.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {m.clienteNome ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {m.software ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {m.competencia}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {moeda(m.valor)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {m.nfseNumero ? (
                        <>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              m.nfseCanceladaEm
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            Nº {m.nfseNumero}
                            {m.nfseCanceladaEm ? " (cancelada)" : ""}
                          </span>
                          <span className="block text-xs text-gray-400">
                            {m.nfseCanceladaEm
                              ? `cancelada em ${dataBR(m.nfseCanceladaEm)}`
                              : dataBR(m.nfseEmitidaEm)}
                          </span>
                        </>
                      ) : m.nfseErro ? (
                        // A recusa da prefeitura diz o que corrigir, então
                        // aparece inteira em vez de cortada.
                        <span className="block max-w-sm whitespace-normal break-words text-xs text-red-600">
                          {m.nfseErro}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Sem nota</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.nfseNumero && (
                        <div className="flex flex-wrap gap-2">
                          {!m.nfseCanceladaEm && (
                            <button
                              onClick={() => cancelarNota(m)}
                              className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                              title="Cancela a nota na prefeitura"
                            >
                              Cancelar na prefeitura
                            </button>
                          )}
                          <button
                            onClick={() => removerNota(m)}
                            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            title="Tira a nota só deste sistema, sem cancelar na prefeitura"
                          >
                            Remover daqui
                          </button>
                        </div>
                      )}
                      {!m.nfseNumero && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => abrirEmissao(m)}
                            className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                          >
                            <FaFileInvoiceDollar /> Emitir NFS-e
                          </button>
                          {/* Para a nota que saiu na prefeitura mas não ficou
                              registrada aqui: evita emitir a mesma duas vezes. */}
                          <button
                            onClick={() => vincular(m)}
                            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            title="Registrar uma nota que já foi emitida na prefeitura"
                          >
                            Já emitida
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {emitindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50 p-4">
          <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Emitir NFS-e
              </h3>
              <button
                onClick={() => setEmitindo(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                X
              </button>
            </div>

            <p className="text-sm text-gray-600">
              {emitindo.clienteNome} — {emitindo.software} —{" "}
              {emitindo.competencia} — <strong>{moeda(emitindo.valor)}</strong>
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Ambiente
                </span>
                <select
                  className={campo}
                  value={ambiente}
                  onChange={(e) => {
                    setAmbiente(e.target.value);
                    // Cada ambiente tem a sua numeração.
                    buscarUltimoRps(e.target.value);
                  }}
                >
                  <option value="homologacao">Homologação</option>
                  <option value="producao">Produção</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Último número de RPS
                </span>
                <input
                  className={campo}
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 123500"
                  value={ultimoRps}
                  onChange={(e) =>
                    setUltimoRps(e.target.value.replace(/\D/g, ""))
                  }
                />
                {ultimoRps ? (
                  <span className="text-xs text-gray-400">
                    Sugerido pelas notas já gravadas. A nota sai com o RPS{" "}
                    {Number(ultimoRps) + 1}.
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">
                    Sem nota gravada neste ambiente: informe o último número
                    usado.
                  </span>
                )}
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Código do serviço
                </span>
                <input
                  className={campo}
                  type="text"
                  value={servico}
                  onChange={(e) => setServico(e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Alíquota
                </span>
                <input
                  className={campo}
                  type="text"
                  inputMode="decimal"
                  value={aliquota}
                  onChange={(e) => setAliquota(e.target.value)}
                />
              </label>

              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Discriminação
                </span>
                <textarea
                  className={campo}
                  rows={2}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </label>

              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Senha do certificado
                </span>
                <input
                  className={campo}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Os dados do tomador vêm do cadastro da licença. Se faltar algum, a
              emissão avisa qual é e nada é enviado à prefeitura.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEmitindo(null)}
                className="rounded bg-gray-500 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={emitir}
                disabled={loading}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:bg-gray-300"
              >
                {loading ? "Emitindo..." : "Emitir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
