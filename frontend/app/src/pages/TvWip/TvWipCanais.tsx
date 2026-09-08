import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import {
  BsPencil,
  BsCheck2,
  BsX,
  BsPlusLg,
  BsTrash,
  BsImage,
  BsCalendar3,
} from "react-icons/bs";

export interface CanalTv {
  idcanal: number;
  canal: string;
  url: string;
  imagens: string;
  ativo: number;
  visualizacoes: number | null;
}

/** O que a edição envia. `ativo` vai como boolean; o backend grava 1/0. */
type EdicaoCanal = {
  canal?: string;
  url?: string;
  imagens?: string;
  ativo?: boolean;
};

interface ProgramaEpg {
  titulo: string;
  descricao: string;
  inicio: string | null;
  fim: string | null;
  agora: boolean;
}

interface EpgDoCanal {
  idcanal: number;
  temEpg: boolean;
  erro?: string;
  programas: ProgramaEpg[];
}

interface Props {
  avisar: (texto: string, tipo: "ok" | "erro") => void;
}

/** "2026-09-08T13:35:00Z" -> "13:35" no fuso do navegador. */
const hora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";

/**
 * Canais da TV WIP — lê e grava direto na tabela do sistema antigo em PHP
 * (wip_canais.tb_canais), que continua sendo a fonte dos canais.
 */
export const TvWipCanais: React.FC<Props> = ({ avisar }) => {
  const { user } = useAuth();
  const base = process.env.REACT_APP_URL;
  const headers = { Authorization: `Bearer ${user?.token}` };

  const [canais, setCanais] = useState<CanalTv[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState<EdicaoCanal>({});
  const [salvando, setSalvando] = useState(false);

  // Cadastro de canal novo, com a logo enviada para o servidor do TV_WIP2.
  const [form, setForm] = useState<{
    canal: string;
    url: string;
    ativo: boolean;
    arquivo: File | null;
  } | null>(null);
  const [criando, setCriando] = useState(false);

  // Guia de programação, buscada no XUI a partir da própria URL do canal.
  const [epg, setEpg] = useState<Record<number, ProgramaEpg[]>>({});
  const [carregandoEpg, setCarregandoEpg] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await axios.get<{ canais: CanalTv[] }>(
        `${base}/tv-wip/canais`,
        { headers },
      );
      setCanais(res.data.canais || []);
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao carregar os canais.", "erro");
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /**
   * Busca a programação de todos os canais numa chamada só. O backend faz as
   * consultas ao XUI em paralelo limitado e guarda em cache por 10 minutos.
   */
  const carregarEpg = useCallback(async () => {
    if (canais.length === 0) return;
    setCarregandoEpg(true);
    try {
      const ids = canais.map((c) => c.idcanal).join(",");
      const res = await axios.get<{ canais: EpgDoCanal[] }>(
        `${base}/tv-wip/canais/epg`,
        { headers, params: { ids, limite: 2 }, timeout: 60000 },
      );
      const mapa: Record<number, ProgramaEpg[]> = {};
      for (const c of res.data.canais || []) mapa[c.idcanal] = c.programas;
      setEpg(mapa);
    } catch (e: any) {
      avisar(
        e?.response?.data?.message || "Erro ao buscar a programação.",
        "erro",
      );
    } finally {
      setCarregandoEpg(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canais, user]);

  // Busca a programação assim que os canais chegam. É uma chamada só, e o
  // backend guarda o resultado por 10 minutos — não vale deixar o operador
  // clicar num botão para ver algo que ele sempre quer ver.
  useEffect(() => {
    carregarEpg();
  }, [carregarEpg]);

  async function salvar(idcanal: number, dados: EdicaoCanal) {
    setSalvando(true);
    try {
      await axios.put(`${base}/tv-wip/canais/${idcanal}`, dados, { headers });
      avisar("Canal atualizado.", "ok");
      setEditando(null);
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao salvar o canal.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  async function criar() {
    if (!form) return;
    setCriando(true);
    try {
      // multipart porque a logo vai junto; o backend repassa o arquivo para o
      // servidor do TV_WIP2 e grava o caminho relativo no banco.
      const dados = new FormData();
      dados.append("canal", form.canal);
      dados.append("url", form.url);
      dados.append("ativo", String(form.ativo));
      if (form.arquivo) dados.append("logo", form.arquivo);

      const res = await axios.post(`${base}/tv-wip/canais`, dados, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      avisar(res.data.message || "Canal criado.", "ok");
      setForm(null);
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao criar o canal.", "erro");
    } finally {
      setCriando(false);
    }
  }

  async function trocarLogo(idcanal: number, arquivo: File) {
    setSalvando(true);
    try {
      const dados = new FormData();
      dados.append("logo", arquivo);
      const res = await axios.post(
        `${base}/tv-wip/canais/${idcanal}/logo`,
        dados,
        { headers: { ...headers, "Content-Type": "multipart/form-data" } },
      );
      avisar(res.data.message || "Logo atualizada.", "ok");
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao enviar a logo.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(idcanal: number, nome: string) {
    if (
      !window.confirm(
        `Apagar o canal ${nome}? Ele sai também dos pacotes onde estiver.`,
      )
    )
      return;
    try {
      await axios.delete(`${base}/tv-wip/canais/${idcanal}`, { headers });
      avisar("Canal removido.", "ok");
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao remover.", "erro");
    }
  }

  /**
   * URL da logo servida pelo próprio backend.
   *
   * O servidor da TV só responde em HTTP e o painel roda em HTTPS: apontar
   * direto para lá faz o navegador bloquear a imagem por conteúdo misto. Por
   * isso a imagem vem por /tv-wip/logo/<arquivo>, na mesma origem segura.
   */
  const urlDaLogo = (imagens: string) => {
    const caminho = String(imagens || "").trim();
    if (!caminho) return "";
    const arquivo = caminho.split("/").pop() || "";
    if (!arquivo) return "";
    return `${base}/tv-wip/logo/${encodeURIComponent(arquivo)}`;
  };

  const filtrados = canais.filter((c) =>
    (c.canal || "").toUpperCase().includes(busca.trim().toUpperCase()),
  );

  return (
    <div className="rounded-lg bg-white shadow-md">
      <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-gray-800">Canais</h2>
          <p className="text-xs text-gray-500">
            {canais.filter((c) => c.ativo === 1).length} no ar de {canais.length}{" "}
            · gravados no banco do sistema de canais
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              setForm(
                form
                  ? null
                  : { canal: "", url: "", ativo: true, arquivo: null },
              )
            }
            className="flex items-center justify-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <BsPlusLg /> {form ? "Fechar" : "Novo canal"}
          </button>
          <button
            onClick={carregarEpg}
            disabled={carregandoEpg || canais.length === 0}
            title="Busca no XUI o que está passando em cada canal"
            className="flex items-center justify-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:text-gray-400"
          >
            {carregandoEpg ? (
              <AiOutlineLoading3Quarters className="animate-spin" />
            ) : (
              <BsCalendar3 />
            )}
            {carregandoEpg ? "Buscando…" : "Atualizar programação"}
          </button>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar canal"
            className="w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-60"
          />
        </div>
      </div>

      {form && (
        <div className="border-b border-gray-200 bg-indigo-50 p-4">
          <h3 className="font-bold text-gray-800">Novo canal</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Nome <span className="text-red-600">*</span>
              </label>
              <input
                value={form.canal}
                onChange={(e) => setForm({ ...form, canal: e.target.value })}
                placeholder="Ex: GLOBO"
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs font-semibold text-gray-600">
                URL do stream <span className="text-red-600">*</span>
              </label>
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="http://.../stream.m3u8"
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setForm({ ...form, arquivo: e.target.files?.[0] || null })
                }
                className="mt-1 w-full text-xs"
              />
              {form.arquivo && (
                <img
                  src={URL.createObjectURL(form.arquivo)}
                  alt="Pré-visualização"
                  className="mt-2 h-12 w-auto rounded bg-white object-contain"
                />
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              Já entra no ar
            </label>
            <button
              onClick={criar}
              disabled={criando || !form.canal.trim() || !form.url.trim()}
              className="rounded bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-400"
            >
              {criando ? "Criando…" : "Criar canal"}
            </button>
            <span className="text-xs text-gray-500">
              A logo é enviada para a pasta de logos do servidor da TV.
            </span>
          </div>
        </div>
      )}

      {carregando ? (
        <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
          <AiOutlineLoading3Quarters className="animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="max-h-[32rem] overflow-auto">
          <table className="min-w-[44rem] text-sm sm:min-w-full">
            <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Canal</th>
                <th className="px-3 py-2 text-left">URL</th>
                <th className="px-3 py-2 text-left">No ar agora</th>
                <th className="px-3 py-2 text-left">Logo</th>
                <th className="px-3 py-2 text-center">No ar</th>
                <th className="px-3 py-2 text-right">Views</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const emEdicao = editando === c.idcanal;
                return (
                  <tr key={c.idcanal} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-400">{c.idcanal}</td>
                    <td className="px-3 py-2">
                      {emEdicao ? (
                        <input
                          value={rascunho.canal ?? ""}
                          onChange={(e) =>
                            setRascunho({ ...rascunho, canal: e.target.value })
                          }
                          className="w-full rounded border border-gray-300 p-1 text-sm"
                        />
                      ) : (
                        <span className="font-semibold text-gray-800">
                          {c.canal}
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-2">
                      {emEdicao ? (
                        <input
                          value={rascunho.url ?? ""}
                          onChange={(e) =>
                            setRascunho({ ...rascunho, url: e.target.value })
                          }
                          className="w-full rounded border border-gray-300 p-1 text-sm"
                        />
                      ) : (
                        <span
                          className="block truncate text-xs text-gray-500"
                          title={c.url}
                        >
                          {c.url}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[16rem] px-3 py-2">
                      {(() => {
                        const grade = epg[c.idcanal];
                        if (!grade) {
                          return (
                            <span className="text-xs text-gray-400">
                              {carregandoEpg ? "buscando…" : "—"}
                            </span>
                          );
                        }
                        if (grade.length === 0) {
                          return (
                            <span className="text-xs text-gray-400">
                              sem guia
                            </span>
                          );
                        }
                        const atual = grade.find((p) => p.agora) || grade[0];
                        const proximo = grade.find((p) => p !== atual);
                        return (
                          <div title={atual.descricao || undefined}>
                            <span className="block truncate font-medium text-gray-800">
                              {atual.titulo || "(sem título)"}
                            </span>
                            <span className="block text-xs text-gray-500">
                              {hora(atual.inicio)}–{hora(atual.fim)}
                              {proximo && ` · depois: ${proximo.titulo}`}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="max-w-[12rem] px-3 py-2">
                      {!emEdicao && (
                        <label
                          className="mr-2 inline-flex cursor-pointer items-center rounded border border-gray-300 p-1 text-gray-500 hover:bg-gray-50"
                          title="Trocar a logo"
                        >
                          <BsImage />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) trocarLogo(c.idcanal, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                      {emEdicao ? (
                        <input
                          value={rascunho.imagens ?? ""}
                          onChange={(e) =>
                            setRascunho({ ...rascunho, imagens: e.target.value })
                          }
                          className="w-full rounded border border-gray-300 p-1 text-sm"
                        />
                      ) : urlDaLogo(c.imagens) ? (
                        <img
                          src={urlDaLogo(c.imagens)}
                          alt={c.canal}
                          title={c.imagens}
                          loading="lazy"
                          className="inline-block h-8 w-auto max-w-[5rem] rounded bg-gray-100 object-contain"
                          onError={(e) => {
                            // Arquivo apagado do servidor: mostra o caminho em
                            // vez de um ícone quebrado.
                            const img = e.currentTarget;
                            img.style.display = "none";
                            img.insertAdjacentHTML(
                              "afterend",
                              `<span class="text-xs text-amber-600" title="${c.imagens}">logo não encontrada</span>`,
                            );
                          }}
                        />
                      ) : (
                        <span className="text-xs text-gray-400">sem logo</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => salvar(c.idcanal, { ativo: c.ativo !== 1 })}
                        disabled={salvando}
                        title="Ligar/desligar o canal"
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          c.ativo === 1
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {c.ativo === 1 ? "No ar" : "Fora"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {c.visualizacoes ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {emEdicao ? (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => salvar(c.idcanal, rascunho)}
                            disabled={salvando}
                            title="Salvar"
                            className="rounded border border-green-300 p-1 text-green-700 hover:bg-green-50"
                          >
                            <BsCheck2 />
                          </button>
                          <button
                            onClick={() => setEditando(null)}
                            title="Cancelar"
                            className="rounded border border-gray-300 p-1 text-gray-500 hover:bg-gray-50"
                          >
                            <BsX />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditando(c.idcanal);
                              setRascunho({
                                canal: c.canal,
                                url: c.url,
                                imagens: c.imagens,
                              });
                            }}
                            title="Editar"
                            className="rounded border border-gray-300 p-1 text-gray-500 hover:bg-gray-50"
                          >
                            <BsPencil />
                          </button>
                          <button
                            onClick={() => remover(c.idcanal, c.canal)}
                            title="Apagar canal"
                            className="rounded border border-red-300 p-1 text-red-600 hover:bg-red-50"
                          >
                            <BsTrash />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
