"use client";

import React, { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { BsArrowRepeat } from "react-icons/bs";
import NavBar from "@/components/NavBar";
import type { User } from "@/lib/auth";

/**
 * Auditoria: quem entrou no sistema e quem criou, editou ou removeu algo.
 * Os registros são gravados pelo backend (utils/auditoria.ts).
 *
 * Esta parte roda no NAVEGADOR, mas não busca nada: os dados chegam prontos
 * do page.tsx. Mudar um filtro só troca a URL; o servidor busca de novo e
 * manda a tabela atualizada.
 */

export interface Registro {
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

export interface Resultado {
  registros: Registro[];
  total: number;
  pagina: number;
  paginas: number;
}

export interface Opcoes {
  usuarios: string[];
  modulos: string[];
}

export interface Filtros {
  usuario: string;
  acao: string;
  modulo: string;
  inicio: string;
  fim: string;
  busca: string;
  pagina: number;
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

// Fuso fixo: a primeira versão da página é montada no servidor, que pode estar
// em outro fuso. Sem isso a hora do servidor e a do navegador não batem.
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  });

const formatarDados = (dados: string | null) => {
  if (!dados) return "";
  try {
    return JSON.stringify(JSON.parse(dados), null, 2);
  } catch {
    return dados;
  }
};

export default function AuditoriaClient({
  user,
  filtros,
  opcoes,
  resultado,
  erro,
}: {
  user: User;
  filtros: Filtros;
  opcoes: Opcoes;
  resultado: Resultado | null;
  erro: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // true enquanto o servidor busca a nova página (troca de filtro ou página)
  const [carregando, startTransition] = useTransition();
  const [aberto, setAberto] = useState<number | null>(null);
  // a busca livre só vale no Enter/botão, então fica num rascunho local
  const [busca, setBusca] = useState(filtros.busca);

  const registros = resultado?.registros ?? [];
  const total = resultado?.total ?? 0;
  const pagina = resultado?.pagina ?? filtros.pagina;
  const paginas = resultado?.paginas ?? 1;

  /** Troca a URL; o page.tsx roda de novo no servidor com os filtros novos. */
  function ir(mudancas: Partial<Filtros>) {
    const novos = { ...filtros, pagina: 1, ...mudancas };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(novos)) {
      const s = String(v).trim();
      if (s && !(k === "pagina" && s === "1")) qs.set(k, s);
    }
    setAberto(null);
    startTransition(() => {
      router.push(qs.size ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function atualizar() {
    startTransition(() => router.refresh());
  }

  const select = "rounded border border-gray-300 p-1.5";

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <NavBar user={user} />
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
            onClick={atualizar}
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
            <select value={filtros.usuario} onChange={(e) => ir({ usuario: e.target.value })} className={select}>
              <option value="">Todos</option>
              {opcoes.usuarios.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Ação</span>
            <select value={filtros.acao} onChange={(e) => ir({ acao: e.target.value })} className={select}>
              <option value="">Todas</option>
              {ACOES.map((a) => (
                <option key={a.id} value={a.id}>{a.rotulo}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Módulo</span>
            <select value={filtros.modulo} onChange={(e) => ir({ modulo: e.target.value })} className={select}>
              <option value="">Todos</option>
              {opcoes.modulos.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">De</span>
            <input type="date" value={filtros.inicio} onChange={(e) => ir({ inicio: e.target.value })} className={select} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Até</span>
            <input type="date" value={filtros.fim} onChange={(e) => ir({ fim: e.target.value })} className={select} />
          </label>
          <form
            className="flex min-w-[220px] flex-1 items-end gap-2 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              ir({ busca });
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

        <div
          className={`mt-4 overflow-x-auto rounded-lg bg-white shadow-md transition-opacity ${
            carregando ? "opacity-50" : ""
          }`}
        >
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
              onClick={() => ir({ ...filtros, pagina: pagina - 1 })}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 disabled:opacity-50"
            >
              Anterior
            </button>
            <span>
              Página {pagina} de {paginas}
            </span>
            <button
              disabled={pagina >= paginas || carregando}
              onClick={() => ir({ ...filtros, pagina: pagina + 1 })}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
