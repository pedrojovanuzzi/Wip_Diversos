import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { TvWipCanais } from "./TvWipCanais";
import { TvWipPacotes, Pacote } from "./TvWipPacotes";
import {
  BsArrowRepeat,
  BsClipboard,
  BsEye,
  BsEyeSlash,
  BsExclamationTriangle,
  BsPersonPlus,
  BsTrash,
  BsCollectionPlay,
} from "react-icons/bs";

type Aba = "contas" | "pacotes" | "canais";

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
  /** Criada à mão: fica fora da sincronização com o MKAuth. */
  avulso: boolean;
  observacao: string | null;
  /** Grupos de canais da conta. `padrao` = herdado, não atribuído. */
  pacotes: { id: number; nome: string; padrao: boolean }[];
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

  // Cadastro avulso: cliente sem registro no MKAuth.
  const [abrirAvulso, setAbrirAvulso] = useState(false);
  const [salvandoAvulso, setSalvandoAvulso] = useState(false);
  const [novo, setNovo] = useState({
    login: "",
    senha: "",
    nome: "",
    observacao: "",
  });

  const [aba, setAba] = useState<Aba>("contas");

  // Atribuição de pacotes em massa às contas marcadas.
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [pacotesEscolhidos, setPacotesEscolhidos] = useState<number[]>([]);
  const [modo, setModo] = useState<"adicionar" | "substituir" | "remover">(
    "adicionar",
  );
  const [aplicando, setAplicando] = useState(false);

  /**
   * Marca a lista INTEIRA do filtro atual, não só a página aberta. Quando está
   * ligado, o backend resolve os logins pelo filtro — evita mandar milhares
   * deles no corpo da requisição.
   */
  const [todosDoFiltro, setTodosDoFiltro] = useState(false);

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
      setTodosDoFiltro(false);
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

  /** Desativa a seleção — ou a lista inteira, quando "todos" está ligado. */
  async function desativarEmLote() {
    if (quantidadeAlvo === 0) return;
    if (
      !window.confirm(
        todosDoFiltro
          ? `Desativar a TV WIP de TODAS as ${total} conta(s) do filtro atual?`
          : `Desativar a TV WIP de ${selecionados.length} conta(s)?`,
      )
    )
      return;

    try {
      const res = await axios.post(
        `${base}/tv-wip/desativar`,
        alvoDaAcao(),
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

  // Os pacotes ficam carregados na aba de contas para a barra de atribuição.
  const carregarPacotes = useCallback(async () => {
    try {
      const res = await axios.get<{ pacotes: Pacote[] }>(
        `${base}/tv-wip/pacotes`,
        { headers },
      );
      setPacotes(res.data.pacotes || []);
    } catch (e) {
      console.error("Erro ao carregar os pacotes:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    carregarPacotes();
  }, [carregarPacotes, aba]);

  /** Corpo comum das ações em massa: lista marcada ou o filtro inteiro. */
  const alvoDaAcao = () =>
    todosDoFiltro
      ? { todos: true, situacao, busca: buscaAplicada }
      : { logins: selecionados };

  async function aplicarPacotes() {
    if (quantidadeAlvo === 0 || pacotesEscolhidos.length === 0) return;
    if (
      todosDoFiltro &&
      !window.confirm(
        `Aplicar em TODAS as ${total} conta(s) do filtro atual?`,
      )
    )
      return;

    setAplicando(true);
    try {
      const res = await axios.post(
        `${base}/tv-wip/pacotes/atribuir`,
        { ...alvoDaAcao(), pacotes: pacotesEscolhidos, modo },
        { headers },
      );
      avisar(res.data.message || "Pacotes aplicados.", "ok");
      setPacotesEscolhidos([]);
      carregarPacotes();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao aplicar.", "erro");
    } finally {
      setAplicando(false);
    }
  }

  async function criarAvulso(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoAvulso(true);
    try {
      const res = await axios.post(`${base}/tv-wip/avulso`, novo, { headers });
      avisar(res.data.message || "Conta criada.", "ok");
      setNovo({ login: "", senha: "", nome: "", observacao: "" });
      setAbrirAvulso(false);
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao criar a conta.", "erro");
    } finally {
      setSalvandoAvulso(false);
    }
  }

  async function removerAvulso(login: string) {
    if (!window.confirm(`Apagar de vez a conta avulsa ${login}?`)) return;
    try {
      const res = await axios.delete(
        `${base}/tv-wip/avulso/${encodeURIComponent(login)}`,
        { headers },
      );
      avisar(res.data.message || "Removida.", "ok");
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao remover.", "erro");
    }
  }

  /** Quantas contas a ação vai atingir. */
  const quantidadeAlvo = todosDoFiltro ? total : selecionados.length;

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
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            onClick={() => setAbrirAvulso((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-md hover:bg-emerald-700 sm:w-auto"
            title="Liberar a TV para alguém sem cadastro no MKAuth"
          >
            <BsPersonPlus />
            {abrirAvulso ? "Fechar" : "Cliente avulso"}
          </button>
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
        </div>

        {/* Conta avulsa: fica de fora da varredura diária, porque não há
            cadastro no MKAuth para comparar. */}
        {abrirAvulso && (
          <form
            onSubmit={criarAvulso}
            className="mt-4 rounded-lg bg-white p-4 shadow-md"
          >
            <h2 className="font-bold text-gray-800">Adicionar cliente avulso</h2>
            <p className="mt-1 text-xs text-gray-500">
              Para quem não tem cadastro no MKAuth. Esta conta{" "}
              <b>não é ativada nem desativada automaticamente</b> — só por aqui.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">
                  Login <span className="text-red-600">*</span>
                </label>
                <input
                  value={novo.login}
                  onChange={(e) =>
                    setNovo({
                      ...novo,
                      login: e.target.value.toUpperCase().replace(/\s/g, ""),
                    })
                  }
                  required
                  placeholder="EX: JOAOAVULSO"
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">
                  Senha <span className="text-red-600">*</span>
                </label>
                <input
                  value={novo.senha}
                  onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
                  required
                  placeholder="senha do aplicativo"
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">
                  Nome
                </label>
                <input
                  value={novo.nome}
                  onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                  placeholder="Opcional"
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">
                  Observação
                </label>
                <input
                  value={novo.observacao}
                  onChange={(e) =>
                    setNovo({ ...novo, observacao: e.target.value })
                  }
                  placeholder="Por que tem acesso"
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={salvandoAvulso || !novo.login || !novo.senha}
              className="mt-3 rounded bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-400"
            >
              {salvandoAvulso ? "Salvando…" : "Criar conta avulsa"}
            </button>
          </form>
        )}

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

        {/* Abas: contas, pacotes e canais dividem a mesma tela. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              { id: "contas", rotulo: "Contas" },
              { id: "pacotes", rotulo: "Pacotes de canais" },
              { id: "canais", rotulo: "Canais" },
            ] as { id: Aba; rotulo: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              className={`rounded px-4 py-2 text-sm font-medium ${
                aba === t.id
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
              }`}
            >
              {t.rotulo}
            </button>
          ))}
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

        {aba === "pacotes" && (
          <div className="mt-4">
            <TvWipPacotes avisar={avisar} />
          </div>
        )}

        {aba === "canais" && (
          <div className="mt-4">
            <TvWipCanais avisar={avisar} />
          </div>
        )}

        {aba === "contas" && (
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

            {quantidadeAlvo > 0 && (
              <button
                onClick={() => desativarEmLote()}
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Desativar {quantidadeAlvo} conta(s)
              </button>
            )}
          </div>

          {/* Seleção: a página aberta mostra 50, mas a ação pode valer para a
              lista inteira do filtro. */}
          {contas.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-gray-700">
                <input
                  type="checkbox"
                  checked={
                    selecionados.length > 0 &&
                    selecionados.length === contas.filter((c) => c.ativo).length
                  }
                  onChange={(e) => {
                    setTodosDoFiltro(false);
                    setSelecionados(
                      e.target.checked
                        ? contas.filter((c) => c.ativo).map((c) => c.login)
                        : [],
                    );
                  }}
                />
                Marcar esta página
              </label>

              <label className="flex cursor-pointer items-center gap-2 font-semibold text-indigo-800">
                <input
                  type="checkbox"
                  checked={todosDoFiltro}
                  onChange={(e) => {
                    setTodosDoFiltro(e.target.checked);
                    if (e.target.checked) setSelecionados([]);
                  }}
                />
                Selecionar todas as {total} contas do filtro
              </label>

              {(selecionados.length > 0 || todosDoFiltro) && (
                <button
                  onClick={() => {
                    setSelecionados([]);
                    setTodosDoFiltro(false);
                  }}
                  className="text-xs text-gray-500 underline"
                >
                  limpar seleção
                </button>
              )}
            </div>
          )}

          {/* Atribuição em massa: o ganho de tempo está aqui — marca várias
              contas e aplica os pacotes de uma vez. */}
          {quantidadeAlvo > 0 && (
            <div className="border-b border-gray-200 bg-indigo-50 px-4 py-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
                  <BsCollectionPlay />
                  {todosDoFiltro
                    ? `TODAS as ${total} contas do filtro`
                    : `${selecionados.length} conta(s) marcada(s)`}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600">
                    Ação
                  </label>
                  <select
                    value={modo}
                    onChange={(e) => setModo(e.target.value as typeof modo)}
                    className="mt-1 rounded border border-gray-300 p-2 text-sm"
                  >
                    <option value="adicionar">Adicionar pacotes</option>
                    <option value="substituir">Substituir por</option>
                    <option value="remover">Remover pacotes</option>
                  </select>
                </div>

                <div className="min-w-[14rem] flex-1">
                  <label className="block text-xs font-semibold text-gray-600">
                    Pacotes
                  </label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {pacotes.length === 0 ? (
                      <span className="text-xs text-gray-500">
                        Nenhum pacote criado ainda — use a aba “Pacotes de
                        canais”.
                      </span>
                    ) : (
                      pacotes.map((p) => (
                        <label
                          key={p.id}
                          className={`flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-sm ${
                            pacotesEscolhidos.includes(p.id)
                              ? "border-indigo-500 bg-white text-indigo-800"
                              : "border-gray-300 bg-white text-gray-600"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={pacotesEscolhidos.includes(p.id)}
                            onChange={() =>
                              setPacotesEscolhidos((atual) =>
                                atual.includes(p.id)
                                  ? atual.filter((i) => i !== p.id)
                                  : [...atual, p.id],
                              )
                            }
                          />
                          {p.nome}
                          <span className="text-xs text-gray-400">
                            ({p.canais.length})
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <button
                  onClick={aplicarPacotes}
                  disabled={aplicando || pacotesEscolhidos.length === 0}
                  className="rounded bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  {aplicando ? "Aplicando…" : "Aplicar"}
                </button>
              </div>
              {modo === "substituir" && (
                <p className="mt-2 text-xs text-amber-700">
                  “Substituir” apaga os pacotes atuais dessas contas e deixa
                  apenas os marcados.
                </p>
              )}
            </div>
          )}

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
                    <th className="px-3 py-2 text-left">Grupo de canais</th>
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
                              checked={
                                todosDoFiltro || selecionados.includes(c.login)
                              }
                              onChange={() => {
                                setTodosDoFiltro(false);
                                alternarSelecao(c.login);
                              }}
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
                          <div className="flex items-center gap-2">
                            <span>{c.nome || "—"}</span>
                            {c.avulso && (
                              <span
                                className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800"
                                title={
                                  c.observacao ||
                                  "Sem cadastro no MKAuth; fora da sincronização"
                                }
                              >
                                avulso
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {c.pacotes?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {c.pacotes.map((p) => (
                                <span
                                  key={p.id}
                                  title={
                                    p.padrao
                                      ? "Herdado do pacote padrão (nenhum atribuído)"
                                      : "Pacote atribuído a esta conta"
                                  }
                                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                    p.padrao
                                      ? "bg-gray-100 text-gray-600"
                                      : "bg-indigo-100 text-indigo-800"
                                  }`}
                                >
                                  {p.nome}
                                  {p.padrao && " (padrão)"}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span
                              className="text-xs text-amber-600"
                              title="Sem pacote atribuído e sem pacote padrão: o cliente não vê canal nenhum"
                            >
                              sem canais
                            </span>
                          )}
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
                          {c.avulso && (
                            <button
                              onClick={() => removerAvulso(c.login)}
                              title="Apagar a conta avulsa"
                              className="mr-2 rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                            >
                              <BsTrash />
                            </button>
                          )}
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
        )}

        <p className="mt-4 text-xs text-gray-500">
          A lista é conferida automaticamente todo dia às 03:10: clientes novos
          entram, e quem deixou de ser ativo no MKAuth é desativado. Uma
          desativação feita aqui à mão não é desfeita pela conferência. Contas
          marcadas como <b>avulso</b> ficam fora dessa conferência: só mudam de
          situação por aqui.
        </p>
      </div>
    </div>
  );
};
