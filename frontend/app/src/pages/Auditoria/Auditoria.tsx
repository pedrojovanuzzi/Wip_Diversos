import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { BsArrowRepeat } from "react-icons/bs";

/**
 * Auditoria: quem entrou no sistema e quem criou, editou ou removeu algo.
 * Os registros são gravados pelo backend (utils/auditoria.ts).
 */

interface Registro {
  id: number;
  user_id: number | null;
  user_login: string | null;
  acao: string;
  modulo: string | null;
  metodo: string | null;
  rota: string | null;
  status_code: number | null;
  descricao: string | null;
  dados: string | null;
  ip: string | null;
  user_agent: string | null;
  criado_em: string;
}

const ACOES: { id: string; rotulo: string; cor: string }[] = [
  { id: "CRIAR", rotulo: "Criou", cor: "bg-green-100 text-green-800" },
  { id: "EDITAR", rotulo: "Editou", cor: "bg-blue-100 text-blue-800" },
  { id: "REMOVER", rotulo: "Removeu", cor: "bg-red-100 text-red-800" },
  { id: "LOGIN", rotulo: "Login", cor: "bg-gray-100 text-gray-800" },
  { id: "LOGIN_FALHOU", rotulo: "Login falhou", cor: "bg-amber-100 text-amber-800" },
];

const acaoInfo = (id: string) =>
  ACOES.find((a) => a.id === id) ?? { id, rotulo: id, cor: "bg-gray-100" };

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  });

const formatarDados = (dados: string | null) => {
  if (!dados) return "";
  try {
    return JSON.stringify(JSON.parse(dados), null, 2);
  } catch {
    return dados;
  }
};

export const Auditoria: React.FC = () => {
  const { user } = useAuth();
  const base = process.env.REACT_APP_URL;
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${user?.token}` }),
    [user],
  );

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);

  const [opcoes, setOpcoes] = useState<{ usuarios: string[]; modulos: string[] }>(
    { usuarios: [], modulos: [] },
  );
  const [usuario, setUsuario] = useState("");
  const [acao, setAcao] = useState("");
  const [modulo, setModulo] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(
    async (p: number) => {
      setCarregando(true);
      setErro(null);
      try {
        const res = await axios.get(`${base}/auditoria`, {
          headers,
          params: {
            pagina: p,
            usuario: usuario || undefined,
            acao: acao || undefined,
            modulo: modulo || undefined,
            inicio: inicio || undefined,
            fim: fim || undefined,
            busca: busca.trim() || undefined,
          },
        });
        setRegistros(res.data.registros);
        setTotal(res.data.total);
        setPaginas(res.data.paginas);
        setPagina(res.data.pagina);
      } catch (e: any) {
        setErro(e?.response?.data?.message ?? "Erro ao carregar os logs.");
      } finally {
        setCarregando(false);
      }
    },
    [base, headers, usuario, acao, modulo, inicio, fim, busca],
  );

  useEffect(() => {
    axios
      .get(`${base}/auditoria/filtros`, { headers })
      .then((res) => setOpcoes(res.data))
      .catch(() => {});
  }, [base, headers]);

  // Filtros de select recarregam na hora; a busca livre só no Enter/botão.
  useEffect(() => {
    carregar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, acao, modulo, inicio, fim]);

  const select = "rounded border border-gray-300 p-1.5";

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <NavBar />
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">
              Auditoria
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">
              Acessos ao sistema e tudo que foi criado, editado ou removido,
              com o usuário, a data e os dados enviados. Senhas e tokens não
              são gravados.
            </p>
          </div>
          <button
            onClick={() => carregar(pagina)}
            disabled={carregando}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {carregando ? (
              <AiOutlineLoading3Quarters className="animate-spin" />
            ) : (
              <BsArrowRepeat />
            )}
            Atualizar
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-md">
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Usuário</span>
            <select value={usuario} onChange={(e) => setUsuario(e.target.value)} className={select}>
              <option value="">Todos</option>
              {opcoes.usuarios.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Ação</span>
            <select value={acao} onChange={(e) => setAcao(e.target.value)} className={select}>
              <option value="">Todas</option>
              {ACOES.map((a) => (
                <option key={a.id} value={a.id}>{a.rotulo}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Módulo</span>
            <select value={modulo} onChange={(e) => setModulo(e.target.value)} className={select}>
              <option value="">Todos</option>
              {opcoes.modulos.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">De</span>
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={select} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Até</span>
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={select} />
          </label>
          <form
            className="flex min-w-[220px] flex-1 items-end gap-2 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              carregar(1);
            }}
          >
            <label className="flex-1">
              <span className="mb-1 block text-gray-600">Buscar</span>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Descrição, rota ou dados"
                className={`${select} w-full`}
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-1.5 font-semibold text-white hover:bg-indigo-700"
            >
              Buscar
            </button>
          </form>
        </div>

        {erro && (
          <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </p>
        )}

        <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow-md">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Usuário</th>
                <th className="px-3 py-2">Ação</th>
                <th className="px-3 py-2">Módulo</th>
                <th className="px-3 py-2">Descrição / rota</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => {
                const info = acaoInfo(r.acao);
                const falhou = (r.status_code ?? 0) >= 400;
                return (
                  <React.Fragment key={r.id}>
                    <tr
                      onClick={() => setAberto(aberto === r.id ? null : r.id)}
                      className="cursor-pointer border-t hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-3 py-2">{dataHora(r.criado_em)}</td>
                      <td className="px-3 py-2 font-medium">{r.user_login ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${info.cor}`}>
                          {info.rotulo}
                        </span>
                      </td>
                      <td className="px-3 py-2">{r.modulo ?? "—"}</td>
                      <td className="max-w-md truncate px-3 py-2">
                        {r.descricao ?? (
                          <span className="font-mono text-xs text-gray-500">
                            {r.metodo} {r.rota}
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-2 ${falhou ? "font-semibold text-red-600" : "text-gray-600"}`}>
                        {r.status_code ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{r.ip ?? "—"}</td>
                    </tr>
                    {aberto === r.id && (
                      <tr className="border-t bg-gray-50">
                        <td colSpan={7} className="px-3 py-3 text-xs">
                          <p className="text-gray-600">
                            <b>Rota:</b> <span className="font-mono">{r.metodo} {r.rota}</span>
                          </p>
                          {r.user_agent && (
                            <p className="mt-1 break-all text-gray-600">
                              <b>Navegador:</b> {r.user_agent}
                            </p>
                          )}
                          {r.dados ? (
                            <pre className="mt-2 max-h-80 overflow-auto rounded bg-white p-2 font-mono">
                              {formatarDados(r.dados)}
                            </pre>
                          ) : (
                            <p className="mt-2 text-gray-500">Sem dados enviados.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {!registros.length && !carregando && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>{total.toLocaleString("pt-BR")} registros</span>
          <div className="flex items-center gap-2">
            <button
              disabled={pagina <= 1 || carregando}
              onClick={() => carregar(pagina - 1)}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 disabled:opacity-50"
            >
              Anterior
            </button>
            <span>
              Página {pagina} de {paginas}
            </span>
            <button
              disabled={pagina >= paginas || carregando}
              onClick={() => carregar(pagina + 1)}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
