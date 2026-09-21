import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FaPlus, FaTrash, FaSave } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";

interface Config {
  id: number;
  software: string;
  diaVencimento: number;
  gerarTodoMes: boolean | number;
  valor: string;
  ativo: boolean | number;
  observacao: string | null;
}

interface SemConfig {
  software: string;
  licencas: number;
}

/** Linha em edição: os campos vêm como texto e só viram número ao salvar. */
interface Rascunho {
  software: string;
  diaVencimento: string;
  valor: string;
  gerarTodoMes: boolean;
  ativo: boolean;
}

const vazio: Rascunho = {
  software: "",
  diaVencimento: "10",
  valor: "",
  gerarTodoMes: true,
  ativo: true,
};

const campo =
  "border rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200";

/**
 * Regra de cobrança de cada software: dia do vencimento, valor e se gera
 * mensalidade todo mês.
 */
export const ConfiguracaoMensalidades = () => {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [semConfig, setSemConfig] = useState<SemConfig[]>([]);
  const [rascunhos, setRascunhos] = useState<Record<number, Rascunho>>({});
  const [novo, setNovo] = useState<Rascunho>(vazio);
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();
  const token = user?.token;
  const { showError, showSuccess } = useNotification();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const resposta = await axios.get(
        `${process.env.REACT_APP_URL}/licenca/mensalidades/config`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const lista: Config[] = resposta.data?.configuracoes ?? [];
      setConfigs(lista);
      setSemConfig(resposta.data?.softwaresSemConfiguracao ?? []);
      setRascunhos(
        Object.fromEntries(
          lista.map((c) => [
            c.id,
            {
              software: c.software,
              diaVencimento: String(c.diaVencimento),
              valor: String(c.valor),
              gerarTodoMes: !!c.gerarTodoMes,
              ativo: !!c.ativo,
            },
          ]),
        ),
      );
    } catch (error) {
      console.error(error);
      showError("Erro ao carregar as configurações.");
    } finally {
      setLoading(false);
    }
  }, [token, showError]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = async (rascunho: Rascunho) => {
    if (!rascunho.software.trim()) {
      showError("Informe o software.");
      return;
    }
    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/licenca/mensalidades/config`,
        {
          software: rascunho.software.trim(),
          diaVencimento: Number(rascunho.diaVencimento),
          valor: rascunho.valor.replace(",", "."),
          gerarTodoMes: rascunho.gerarTodoMes,
          ativo: rascunho.ativo,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      showSuccess("Configuração salva.");
      setNovo(vazio);
      carregar();
    } catch (error: any) {
      showError(error?.response?.data?.message || "Erro ao salvar.");
    }
  };

  const remover = async (id: number) => {
    if (!window.confirm("Remover a configuração deste software?")) return;
    try {
      await axios.delete(
        `${process.env.REACT_APP_URL}/licenca/mensalidades/config/${id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      showSuccess("Configuração removida.");
      carregar();
    } catch (error) {
      showError("Erro ao remover.");
    }
  };

  const atualizar = (id: number, campos: Partial<Rascunho>) =>
    setRascunhos((prev) => ({ ...prev, [id]: { ...prev[id], ...campos } }));

  return (
    <div className="space-y-6">
      <div className="bg-white shadow-md rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-800">
          Configuração por software
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Define quando vence, quanto custa e se a mensalidade é gerada todo
          mês. Vencer não bloqueia a licença: o bloqueio continua manual, na aba
          de licenças.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Software",
                  "Dia do vencimento",
                  "Valor (R$)",
                  "Gera todo mês",
                  "Ativo",
                  "",
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
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-sm">
                    Carregando...
                  </td>
                </tr>
              )}

              {!loading &&
                configs.map((config) => {
                  const rascunho = rascunhos[config.id];
                  if (!rascunho) return null;
                  return (
                    <tr key={config.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {config.software}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className={`${campo} w-20`}
                          type="number"
                          min={1}
                          max={31}
                          value={rascunho.diaVencimento}
                          onChange={(e) =>
                            atualizar(config.id, {
                              diaVencimento: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className={`${campo} w-28`}
                          type="text"
                          inputMode="decimal"
                          value={rascunho.valor}
                          onChange={(e) =>
                            atualizar(config.id, { valor: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={rascunho.gerarTodoMes}
                          onChange={(e) =>
                            atualizar(config.id, {
                              gerarTodoMes: e.target.checked,
                            })
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={rascunho.ativo}
                          onChange={(e) =>
                            atualizar(config.id, { ativo: e.target.checked })
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => salvar(rascunho)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Salvar"
                          >
                            <FaSave />
                          </button>
                          <button
                            onClick={() => remover(config.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Remover"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {/* Linha de inclusão */}
              <tr className="bg-gray-50">
                <td className="px-4 py-3">
                  {/* Só softwares que já têm licença cadastrada: digitar o
                      nome na mão criava regra para software que não existe. */}
                  <select
                    className={`${campo} w-56`}
                    value={novo.software}
                    disabled={semConfig.length === 0}
                    onChange={(e) =>
                      setNovo((prev) => ({ ...prev, software: e.target.value }))
                    }
                  >
                    <option value="">
                      {semConfig.length === 0
                        ? "Todos já têm regra"
                        : "Selecione o software"}
                    </option>
                    {semConfig.map((s) => (
                      <option key={s.software} value={s.software}>
                        {s.software} ({s.licencas}{" "}
                        {s.licencas === 1 ? "licença" : "licenças"})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    className={`${campo} w-20`}
                    type="number"
                    min={1}
                    max={31}
                    value={novo.diaVencimento}
                    onChange={(e) =>
                      setNovo((prev) => ({
                        ...prev,
                        diaVencimento: e.target.value,
                      }))
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    className={`${campo} w-28`}
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={novo.valor}
                    onChange={(e) =>
                      setNovo((prev) => ({ ...prev, valor: e.target.value }))
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={novo.gerarTodoMes}
                    onChange={(e) =>
                      setNovo((prev) => ({
                        ...prev,
                        gerarTodoMes: e.target.checked,
                      }))
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={novo.ativo}
                    onChange={(e) =>
                      setNovo((prev) => ({ ...prev, ativo: e.target.checked }))
                    }
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => salvar(novo)}
                    disabled={!novo.software}
                    className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    <FaPlus /> Adicionar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {semConfig.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Softwares ainda sem regra</p>
          <p className="mt-1">
            Estes têm licença cadastrada mas não geram mensalidade:{" "}
            {semConfig.map((s) => `${s.software} (${s.licencas})`).join(", ")}.
          </p>
        </div>
      )}
    </div>
  );
};
