import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { BsPencil, BsTrash, BsPlusLg } from "react-icons/bs";
import { CanalTv } from "./TvWipCanais";

export interface Pacote {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  padrao: boolean;
  canais: number[];
  contas: number;
}

interface Props {
  avisar: (texto: string, tipo: "ok" | "erro") => void;
}

const VAZIO = {
  id: 0,
  nome: "",
  descricao: "",
  ativo: true,
  padrao: false,
  canais: [] as number[],
};

/**
 * Pacotes (grupos) de canais. Um pacote reúne canais; as contas recebem
 * pacotes. Assim dá para mudar a grade de muita gente de uma vez só.
 */
export const TvWipPacotes: React.FC<Props> = ({ avisar }) => {
  const { user } = useAuth();
  const base = process.env.REACT_APP_URL;
  const headers = { Authorization: `Bearer ${user?.token}` };

  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [canais, setCanais] = useState<CanalTv[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [form, setForm] = useState<typeof VAZIO | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [filtroCanal, setFiltroCanal] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [p, c] = await Promise.all([
        axios.get<{ pacotes: Pacote[] }>(`${base}/tv-wip/pacotes`, { headers }),
        axios.get<{ canais: CanalTv[] }>(`${base}/tv-wip/canais`, { headers }),
      ]);
      setPacotes(p.data.pacotes || []);
      setCanais(c.data.canais || []);
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

  const nomeDoCanal = useMemo(() => {
    const mapa = new Map(canais.map((c) => [c.idcanal, c.canal]));
    return (id: number) => mapa.get(id) || `#${id}`;
  }, [canais]);

  const canaisFiltrados = useMemo(() => {
    const termo = filtroCanal.trim().toUpperCase();
    if (!termo) return canais;
    return canais.filter((c) => (c.canal || "").toUpperCase().includes(termo));
  }, [canais, filtroCanal]);

  async function salvar() {
    if (!form) return;
    setSalvando(true);
    try {
      const res = await axios.post(
        `${base}/tv-wip/pacotes`,
        { ...form, id: form.id || undefined },
        { headers },
      );
      avisar(res.data.message || "Pacote salvo.", "ok");
      setForm(null);
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao salvar.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(p: Pacote) {
    const aviso =
      p.contas > 0
        ? `O pacote ${p.nome} está em ${p.contas} conta(s). Remover mesmo assim?`
        : `Remover o pacote ${p.nome}?`;
    if (!window.confirm(aviso)) return;
    try {
      await axios.delete(`${base}/tv-wip/pacotes/${p.id}`, { headers });
      avisar("Pacote removido.", "ok");
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao remover.", "erro");
    }
  }

  const alternarCanal = (id: number) =>
    setForm((f) =>
      !f
        ? f
        : {
            ...f,
            canais: f.canais.includes(id)
              ? f.canais.filter((c) => c !== id)
              : [...f.canais, id],
          },
    );

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white shadow-md">
        <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-gray-800">Pacotes de canais</h2>
            <p className="text-xs text-gray-500">
              Um pacote agrupa canais; as contas recebem pacotes.
            </p>
          </div>
          <button
            onClick={() => setForm({ ...VAZIO })}
            className="flex items-center justify-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <BsPlusLg /> Novo pacote
          </button>
        </div>

        {carregando ? (
          <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
            <AiOutlineLoading3Quarters className="animate-spin" /> Carregando…
          </div>
        ) : pacotes.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">
            Nenhum pacote ainda. Crie um e depois atribua às contas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[40rem] text-sm sm:min-w-full">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Pacote</th>
                  <th className="px-3 py-2 text-left">Canais</th>
                  <th className="px-3 py-2 text-right">Contas</th>
                  <th className="px-3 py-2 text-center">Situação</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pacotes.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <span className="font-semibold text-gray-800">
                        {p.nome}
                      </span>
                      {p.padrao && (
                        <span
                          className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800"
                          title="Vale para quem não tem nenhum pacote atribuído"
                        >
                          padrão
                        </span>
                      )}
                      {p.descricao && (
                        <span className="block text-xs text-gray-500">
                          {p.descricao}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-gray-600">
                        {p.canais.length} canal(is)
                      </span>
                      {p.canais.length > 0 && (
                        <span
                          className="block truncate text-xs text-gray-400"
                          title={p.canais.map(nomeDoCanal).join(", ")}
                        >
                          {p.canais.slice(0, 4).map(nomeDoCanal).join(", ")}
                          {p.canais.length > 4 && "…"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {p.contas}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          p.ativo
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() =>
                            setForm({
                              id: p.id,
                              nome: p.nome,
                              descricao: p.descricao || "",
                              ativo: p.ativo,
                              padrao: p.padrao,
                              canais: [...p.canais],
                            })
                          }
                          title="Editar"
                          className="rounded border border-gray-300 p-1 text-gray-500 hover:bg-gray-50"
                        >
                          <BsPencil />
                        </button>
                        <button
                          onClick={() => remover(p)}
                          title="Remover"
                          className="rounded border border-red-300 p-1 text-red-600 hover:bg-red-50"
                        >
                          <BsTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <div className="rounded-lg bg-white p-4 shadow-md ring-2 ring-indigo-500">
          <h3 className="font-bold text-gray-800">
            {form.id ? `Editar ${form.nome}` : "Novo pacote"}
          </h3>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Nome <span className="text-red-600">*</span>
              </label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Aberto, Esportes, Completo"
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Descrição
              </label>
              <input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Opcional"
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              Ativo
            </label>
            <label
              className="flex items-center gap-2 text-sm text-gray-700"
              title="Aplicado a quem não tem nenhum pacote atribuído"
            >
              <input
                type="checkbox"
                checked={form.padrao}
                onChange={(e) => setForm({ ...form, padrao: e.target.checked })}
              />
              Pacote padrão
            </label>
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-gray-600">
                Canais do pacote ({form.canais.length} de {canais.length})
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  value={filtroCanal}
                  onChange={(e) => setFiltroCanal(e.target.value)}
                  placeholder="Filtrar canal"
                  className="rounded border border-gray-300 p-1.5 text-sm"
                />
                <button
                  onClick={() =>
                    setForm({
                      ...form,
                      canais: canaisFiltrados.map((c) => c.idcanal),
                    })
                  }
                  className="rounded border border-gray-300 px-2 py-1.5 text-xs hover:bg-gray-50"
                >
                  Marcar exibidos
                </button>
                <button
                  onClick={() => setForm({ ...form, canais: [] })}
                  className="rounded border border-gray-300 px-2 py-1.5 text-xs hover:bg-gray-50"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="mt-2 grid max-h-72 gap-1 overflow-auto rounded border border-gray-200 p-2 sm:grid-cols-2 lg:grid-cols-3">
              {canaisFiltrados.map((c) => (
                <label
                  key={c.idcanal}
                  className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50 ${
                    c.ativo !== 1 ? "text-gray-400" : "text-gray-700"
                  }`}
                  title={c.ativo !== 1 ? "Canal fora do ar" : c.url}
                >
                  <input
                    type="checkbox"
                    checked={form.canais.includes(c.idcanal)}
                    onChange={() => alternarCanal(c.idcanal)}
                  />
                  <span className="truncate">{c.canal}</span>
                  {c.ativo !== 1 && (
                    <span className="ml-auto text-[10px] uppercase">fora</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={salvar}
              disabled={salvando || !form.nome.trim()}
              className="rounded bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-400"
            >
              {salvando ? "Salvando…" : "Salvar pacote"}
            </button>
            <button
              onClick={() => setForm(null)}
              className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
