import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { BsEnvelope, BsEyeSlash, BsEye, BsSend, BsTrash } from "react-icons/bs";
import { Pacote } from "./TvWipPacotes";

type Destino = "todos" | "pacotes" | "logins";

interface Notificacao {
  id: number;
  titulo: string;
  mensagem: string;
  destino: Destino;
  alvos: (string | number)[] | null;
  ativo: boolean;
  expira_em: string | null;
  criado_por: string | null;
  created_at: string;
}

interface Props {
  avisar: (texto: string, tipo: "ok" | "erro") => void;
}

const LIMITE_TITULO = 120;
const LIMITE_MENSAGEM = 2000;

const VAZIO = {
  titulo: "",
  mensagem: "",
  destino: "todos" as Destino,
  pacotes: [] as number[],
  logins: "",
  expira_em: "",
};

const dataBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "—";

/** Logins digitados um por linha, ou separados por vírgula/espaço. */
const lerLogins = (texto: string) =>
  Array.from(
    new Set(
      texto
        .split(/[\s,;]+/)
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  );

/**
 * Avisos para o aplicativo da TV WIP. O que é enviado aqui aparece no envelope
 * da grade de canais, em TVs, TV box e celulares, na próxima vez que o app
 * buscar — ao abrir, ao tocar em Atualizar ou a cada poucos minutos.
 */
export const TvWipNotificacoes: React.FC<Props> = ({ avisar }) => {
  const { user } = useAuth();
  const base = process.env.REACT_APP_URL;
  const headers = { Authorization: `Bearer ${user?.token}` };

  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({ ...VAZIO });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [n, p] = await Promise.all([
        axios.get<{ notificacoes: Notificacao[] }>(`${base}/tv-wip/notificacoes`, {
          headers,
        }),
        axios.get<{ pacotes: Pacote[] }>(`${base}/tv-wip/pacotes`, { headers }),
      ]);
      setNotificacoes(n.data.notificacoes || []);
      setPacotes(p.data.pacotes || []);
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao carregar.", "erro");
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const nomeDoPacote = useMemo(() => {
    const mapa = new Map(pacotes.map((p) => [p.id, p.nome]));
    return (id: number) => mapa.get(id) || `#${id}`;
  }, [pacotes]);

  const logins = lerLogins(form.logins);

  const podeEnviar =
    form.titulo.trim().length > 0 &&
    form.mensagem.trim().length > 0 &&
    (form.destino !== "pacotes" || form.pacotes.length > 0) &&
    (form.destino !== "logins" || logins.length > 0);

  const descreverDestino = (n: Notificacao) => {
    const alvos = n.alvos ?? [];
    if (n.destino === "todos") return "Todos os aparelhos";
    if (n.destino === "pacotes") {
      return `Pacote: ${alvos.map((id) => nomeDoPacote(Number(id))).join(", ")}`;
    }
    return alvos.length <= 3
      ? `Login: ${alvos.join(", ")}`
      : `${alvos.length} logins`;
  };

  async function enviar() {
    const resumo =
      form.destino === "todos"
        ? "todos os aparelhos"
        : form.destino === "pacotes"
          ? `quem tem ${form.pacotes.map(nomeDoPacote).join(", ")}`
          : `${logins.length} login(s)`;
    if (!window.confirm(`Enviar "${form.titulo.trim()}" para ${resumo}?`)) return;

    setEnviando(true);
    try {
      const res = await axios.post(
        `${base}/tv-wip/notificacoes`,
        {
          titulo: form.titulo,
          mensagem: form.mensagem,
          destino: form.destino,
          alvos:
            form.destino === "pacotes"
              ? form.pacotes
              : form.destino === "logins"
                ? logins
                : [],
          // `datetime-local` vem sem fuso; o Date do navegador lê como horário
          // local e o ISO leva o instante certo ao servidor.
          expira_em: form.expira_em ? new Date(form.expira_em).toISOString() : null,
        },
        { headers },
      );
      avisar(res.data.message || "Notificação enviada.", "ok");
      setForm({ ...VAZIO });
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao enviar.", "erro");
    } finally {
      setEnviando(false);
    }
  }

  async function alternar(n: Notificacao) {
    try {
      const res = await axios.put(
        `${base}/tv-wip/notificacoes/${n.id}/ativo`,
        { ativo: !n.ativo },
        { headers },
      );
      avisar(res.data.message || "Salvo.", "ok");
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao salvar.", "erro");
    }
  }

  async function remover(n: Notificacao) {
    if (!window.confirm(`Apagar "${n.titulo}"? Ela some do app e do histórico.`)) {
      return;
    }
    try {
      await axios.delete(`${base}/tv-wip/notificacoes/${n.id}`, { headers });
      avisar("Notificação apagada.", "ok");
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao apagar.", "erro");
    }
  }

  const expirada = (n: Notificacao) =>
    !!n.expira_em && new Date(n.expira_em).getTime() <= Date.now();

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="flex items-start gap-3">
          <BsEnvelope className="mt-1 shrink-0 text-xl text-indigo-600" />
          <div>
            <h2 className="font-bold text-gray-800">Nova notificação</h2>
            <p className="text-xs text-gray-500">
              Aparece no envelope da grade de canais do aplicativo. Os aparelhos
              recebem ao abrir o app, ao tocar em Atualizar ou em até 5 minutos.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div>
            <label className="flex justify-between text-xs font-semibold text-gray-600">
              <span>
                Título <span className="text-red-600">*</span>
              </span>
              <span className="font-normal text-gray-400">
                {form.titulo.length}/{LIMITE_TITULO}
              </span>
            </label>
            <input
              value={form.titulo}
              maxLength={LIMITE_TITULO}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex: Manutenção programada"
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="flex justify-between text-xs font-semibold text-gray-600">
              <span>
                Mensagem <span className="text-red-600">*</span>
              </span>
              <span className="font-normal text-gray-400">
                {form.mensagem.length}/{LIMITE_MENSAGEM}
              </span>
            </label>
            <textarea
              value={form.mensagem}
              maxLength={LIMITE_MENSAGEM}
              rows={4}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
              placeholder="Ex: Na madrugada de sábado alguns canais podem ficar fora do ar entre 2h e 4h."
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600">Para quem</p>
            <div className="mt-1 flex flex-wrap gap-4">
              {(
                [
                  { id: "todos", rotulo: "Todos os aparelhos" },
                  { id: "pacotes", rotulo: "Por pacote" },
                  { id: "logins", rotulo: "Logins específicos" },
                ] as { id: Destino; rotulo: string }[]
              ).map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="destino"
                    checked={form.destino === d.id}
                    onChange={() => setForm({ ...form, destino: d.id })}
                  />
                  {d.rotulo}
                </label>
              ))}
            </div>
            {form.destino === "todos" && (
              <p className="mt-1 text-xs text-gray-500">
                Inclui os logins de demonstração do app, que não têm conta cadastrada.
              </p>
            )}
          </div>

          {form.destino === "pacotes" && (
            <div className="grid max-h-48 gap-1 overflow-auto rounded border border-gray-200 p-2 sm:grid-cols-2 lg:grid-cols-3">
              {pacotes.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum pacote cadastrado.</p>
              ) : (
                pacotes.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={form.pacotes.includes(p.id)}
                      onChange={() =>
                        setForm({
                          ...form,
                          pacotes: form.pacotes.includes(p.id)
                            ? form.pacotes.filter((id) => id !== p.id)
                            : [...form.pacotes, p.id],
                        })
                      }
                    />
                    <span className="truncate">{p.nome}</span>
                    {p.padrao && (
                      <span className="ml-auto text-[10px] uppercase text-indigo-700">
                        padrão
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>
          )}

          {form.destino === "logins" && (
            <div>
              <textarea
                value={form.logins}
                rows={3}
                onChange={(e) => setForm({ ...form, logins: e.target.value })}
                placeholder="Um login por linha, ou separados por vírgula"
                className="w-full rounded border border-gray-300 p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500">{logins.length} login(s)</p>
            </div>
          )}

          <div className="sm:w-72">
            <label className="text-xs font-semibold text-gray-600">
              Válida até (opcional)
            </label>
            <input
              type="datetime-local"
              value={form.expira_em}
              onChange={(e) => setForm({ ...form, expira_em: e.target.value })}
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500">
              Depois disso ela sai do app sozinha.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={enviar}
            disabled={enviando || !podeEnviar}
            className="flex items-center gap-2 rounded bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-400"
          >
            <BsSend /> {enviando ? "Enviando…" : "Enviar notificação"}
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow-md">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-bold text-gray-800">Enviadas</h2>
          <p className="text-xs text-gray-500">
            Retirar tira do app e mantém aqui; apagar remove de vez.
          </p>
        </div>

        {carregando ? (
          <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
            <AiOutlineLoading3Quarters className="animate-spin" /> Carregando…
          </div>
        ) : notificacoes.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">
            Nenhuma notificação enviada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[48rem] text-sm sm:min-w-full">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Notificação</th>
                  <th className="px-3 py-2 text-left">Para quem</th>
                  <th className="px-3 py-2 text-left">Enviada</th>
                  <th className="px-3 py-2 text-center">Situação</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {notificacoes.map((n) => {
                  const noAr = n.ativo && !expirada(n);
                  return (
                    <tr key={n.id} className="border-t border-gray-100 align-top">
                      <td className="max-w-md px-3 py-2">
                        <span className="font-semibold text-gray-800">{n.titulo}</span>
                        <span
                          className="block whitespace-pre-line text-xs text-gray-500 line-clamp-3"
                          title={n.mensagem}
                        >
                          {n.mensagem}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        <span title={(n.alvos ?? []).join(", ")}>
                          {descreverDestino(n)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {dataBR(n.created_at)}
                        {n.criado_por && (
                          <span className="block text-gray-400">por {n.criado_por}</span>
                        )}
                        {n.expira_em && (
                          <span className="block text-gray-400">
                            até {dataBR(n.expira_em)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            noAr
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {noAr ? "No app" : expirada(n) ? "Vencida" : "Retirada"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => alternar(n)}
                            title={n.ativo ? "Retirar do app" : "Voltar a mostrar no app"}
                            className="rounded border border-gray-300 p-1 text-gray-500 hover:bg-gray-50"
                          >
                            {n.ativo ? <BsEyeSlash /> : <BsEye />}
                          </button>
                          <button
                            onClick={() => remover(n)}
                            title="Apagar"
                            className="rounded border border-red-300 p-1 text-red-600 hover:bg-red-50"
                          >
                            <BsTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
