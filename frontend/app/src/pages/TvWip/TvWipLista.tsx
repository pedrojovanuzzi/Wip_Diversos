import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import {
  BsArrowRepeat,
  BsClipboard,
  BsEye,
  BsEyeSlash,
  BsExclamationTriangle,
} from "react-icons/bs";

interface Conta {
  id: number;
  login: string;
  senha: string | null;
  nome: string | null;
  ativo: boolean;
  desativado_em: string | null;
  motivo_desativacao: string | null;
  desativado_por: string | null;
  verificado_em: string | null;
}

type Situacao = "ativas" | "desativadas" | "todas";

const SITUACOES: { id: Situacao; rotulo: string }[] = [
  { id: "ativas", rotulo: "Ativas" },
  { id: "desativadas", rotulo: "Desativadas" },
  { id: "todas", rotulo: "Todas" },
];

const dataBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "—";

export const TvWipLista: React.FC = () => {
  const { user } = useAuth();
  const base = process.env.REACT_APP_URL;
  const headers = { Authorization: `Bearer ${user?.token}` };

  const [contas, setContas] = useState<Conta[]>([]);
  const [resumo, setResumo] = useState({ ativas: 0, desativadas: 0 });
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [pagina, setPagina] = useState(1);
  const [situacao, setSituacao] = useState<Situacao>("ativas");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensagem, setMensagem] = useState<{
    texto: string;
    tipo: "ok" | "erro";
  } | null>(null);
  const [senhasVisiveis, setSenhasVisiveis] = useState<number[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const avisar = (texto: string, tipo: "ok" | "erro") => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 5000);
  };

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await axios.get(`${base}/tv-wip`, {
        headers,
        params: { pagina, porPagina: 50, situacao, busca: buscaAplicada },
      });
      setContas(res.data.contas || []);
      setTotal(res.data.total || 0);
      setPaginas(res.data.paginas || 1);
      setResumo(res.data.resumo || { ativas: 0, desativadas: 0 });
      setSelecionados([]);
    } catch (e: any) {
      avisar(
        e?.response?.data?.message || "Erro ao carregar a lista.",
        "erro",
      );
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pagina, situacao, buscaAplicada]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Busca com atraso: são milhares de contas, não dá para consultar por tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPagina(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [busca]);

  async function acao(rota: "desativar" | "reativar", logins: string[]) {
    if (logins.length === 0) return;

    if (rota === "desativar") {
      const ok = window.confirm(
        logins.length === 1
          ? `Desativar a TV WIP de ${logins[0]}?`
          : `Desativar a TV WIP de ${logins.length} clientes?`,
      );
      if (!ok) return;
    }

    try {
      const res = await axios.post(
        `${base}/tv-wip/${rota}`,
        { logins },
        { headers },
      );
      avisar(res.data.message || "Feito.", "ok");
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Não foi possível concluir.", "erro");
    }
  }

  async function sincronizar() {
    setSincronizando(true);
    try {
      const res = await axios.post(`${base}/tv-wip/sincronizar`, {}, { headers });
      avisar(
        `${res.data.clientesAtivos} cliente(s) ativo(s): ` +
          `${res.data.criadas} nova(s), ${res.data.desativadas} desativada(s), ` +
          `${res.data.reativadas} reativada(s).`,
        "ok",
      );
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao sincronizar.", "erro");
    } finally {
      setSincronizando(false);
    }
  }

  const alternarSelecao = (login: string) =>
    setSelecionados((atual) =>
      atual.includes(login)
        ? atual.filter((l) => l !== login)
        : [...atual, login],
    );

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      avisar("Copiado.", "ok");
    } catch {
      avisar("O navegador bloqueou a cópia.", "erro");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <NavBar />
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">TV WIP Grátis</h1>
            <p className="mt-1 text-sm text-gray-500">
              Clientes com acesso à TV distribuída gratuitamente. O login no
              aplicativo é o mesmo do cadastro.
            </p>
          </div>
          <button
            onClick={sincronizar}
            disabled={sincronizando}
            title="Confere agora quem continua sendo cliente ativo"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white shadow-md hover:bg-indigo-700 disabled:bg-gray-400 sm:w-auto"
          >
            {sincronizando ? (
              <AiOutlineLoading3Quarters className="animate-spin" />
            ) : (
              <BsArrowRepeat />
            )}
            Sincronizar agora
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-white p-4 shadow-md">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Contas ativas
            </p>
            <p className="text-2xl font-bold text-green-600">{resumo.ativas}</p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-md">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Desativadas
            </p>
            <p className="text-2xl font-bold text-gray-500">
              {resumo.desativadas}
            </p>
          </div>
        </div>

        {mensagem && (
          <p
            className={`mt-4 flex items-center gap-2 rounded border p-3 text-sm ${
              mensagem.tipo === "ok"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {mensagem.tipo === "erro" && <BsExclamationTriangle />}
            {mensagem.texto}
          </p>
        )}

        <div className="mt-4 rounded-lg bg-white shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {SITUACOES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSituacao(s.id);
                    setPagina(1);
                  }}
                  className={`rounded px-3 py-1.5 text-sm font-medium ${
                    situacao === s.id
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {s.rotulo}
                </button>
              ))}
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por login ou nome"
                className="w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-60"
              />
            </div>

            {selecionados.length > 0 && (
              <button
                onClick={() => acao("desativar", selecionados)}
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Desativar {selecionados.length} selecionada(s)
              </button>
            )}
          </div>

          {carregando ? (
            <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
              <AiOutlineLoading3Quarters className="animate-spin" />
              Carregando…
            </div>
          ) : contas.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">
              Nenhuma conta encontrada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[46rem] text-sm sm:min-w-full">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="w-10 px-3 py-2"></th>
                    <th className="px-3 py-2 text-left">Login</th>
                    <th className="px-3 py-2 text-left">Senha</th>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-center">Situação</th>
                    <th className="px-3 py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {contas.map((c) => {
                    const visivel = senhasVisiveis.includes(c.id);
                    return (
                      <tr key={c.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          {c.ativo && (
                            <input
                              type="checkbox"
                              checked={selecionados.includes(c.login)}
                              onChange={() => alternarSelecao(c.login)}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2 font-semibold text-gray-800">
                          <button
                            onClick={() => copiar(c.login)}
                            title="Copiar login"
                            className="hover:text-indigo-600"
                          >
                            {c.login}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-700">
                              {visivel ? c.senha || "—" : "••••••••"}
                            </span>
                            <button
                              onClick={() =>
                                setSenhasVisiveis((v) =>
                                  v.includes(c.id)
                                    ? v.filter((i) => i !== c.id)
                                    : [...v, c.id],
                                )
                              }
                              title={visivel ? "Ocultar" : "Mostrar"}
                              className="text-gray-400 hover:text-gray-700"
                            >
                              {visivel ? <BsEyeSlash /> : <BsEye />}
                            </button>
                            {c.senha && (
                              <button
                                onClick={() => copiar(c.senha!)}
                                title="Copiar senha"
                                className="text-gray-400 hover:text-gray-700"
                              >
                                <BsClipboard />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {c.nome || "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {c.ativo ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                              Ativa
                            </span>
                          ) : (
                            <span
                              className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600"
                              title={`${c.motivo_desativacao || "sem motivo"} · ${dataBR(c.desativado_em)}${
                                c.desativado_por ? ` · por ${c.desativado_por}` : ""
                              }`}
                            >
                              Desativada
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {c.ativo ? (
                            <button
                              onClick={() => acao("desativar", [c.login])}
                              className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Desativar TV
                            </button>
                          ) : (
                            <button
                              onClick={() => acao("reativar", [c.login])}
                              className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                            >
                              Reativar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {paginas > 1 && (
            <div className="flex flex-col gap-2 border-t border-gray-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-gray-500">
                Página {pagina} de {paginas} · {total} conta(s)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => p - 1)}
                  className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  disabled={pagina >= paginas}
                  onClick={() => setPagina((p) => p + 1)}
                  className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          A lista é conferida automaticamente todo dia às 03:10: clientes novos
          entram, e quem deixou de ser ativo no MKAuth é desativado. Uma
          desativação feita aqui à mão não é desfeita pela conferência.
        </p>
      </div>
    </div>
  );
};
