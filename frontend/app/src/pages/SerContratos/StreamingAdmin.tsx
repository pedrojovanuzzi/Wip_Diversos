import React, { useEffect, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { BsTrash, BsPencil, BsCheckCircle, BsXCircle } from "react-icons/bs";

interface Assinante {
  id: number;
  login: string;
  email: string;
  phone: string;
  pacote: string;
  ticket: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const StreamingAdmin: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Assinante[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingPhone, setEditingPhone] = useState<{
    id: number;
    value: string;
  } | null>(null);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(
    null,
  );

  const base = process.env.REACT_APP_URL;
  const headers = { Authorization: `Bearer ${user?.token}` };
  const canManage = (user?.permission ?? 0) >= 5;

  const flash = (text: string, type: "ok" | "err") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${base}/streaming`, { headers });
      setItems(res.data.items || []);
    } catch (e: any) {
      flash(e?.response?.data?.message || "Erro ao carregar.", "err");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  const savePhone = async (id: number) => {
    if (!editingPhone) return;
    setBusyId(id);
    try {
      await axios.put(
        `${base}/streaming/${id}/phone`,
        { phone: editingPhone.value },
        { headers },
      );
      flash("Telefone atualizado.", "ok");
      setEditingPhone(null);
      await load();
    } catch (e: any) {
      flash(e?.response?.data?.message || "Erro ao atualizar.", "err");
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (item: Assinante) => {
    setBusyId(item.id);
    try {
      await axios.put(
        `${base}/streaming/${item.id}/status`,
        { ativo: !item.ativo },
        { headers },
      );
      flash(`Assinante ${!item.ativo ? "ativado" : "desativado"}.`, "ok");
      await load();
    } catch (e: any) {
      flash(e?.response?.data?.message || "Erro ao alterar status.", "err");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: Assinante) => {
    if (!window.confirm(`Remover assinante streaming de ${item.login}?`))
      return;
    setBusyId(item.id);
    try {
      const res = await axios.delete(`${base}/streaming/${item.id}`, {
        headers,
      });
      flash(res.data.remoteNote || "Removido.", res.data.remoteNote ? "err" : "ok");
      await load();
    } catch (e: any) {
      flash(e?.response?.data?.message || "Erro ao remover.", "err");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = items.filter((i) => {
    if (!filter.trim()) return true;
    const q = filter.trim().toLowerCase();
    return (
      i.login.toLowerCase().includes(q) ||
      (i.email || "").toLowerCase().includes(q) ||
      (i.phone || "").toLowerCase().includes(q) ||
      (i.ticket || "").toLowerCase().includes(q)
    );
  });

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-800">
              Streaming — Assinantes
            </h1>
            <button
              onClick={load}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
            >
              {loading ? (
                <AiOutlineLoading3Quarters className="animate-spin inline" />
              ) : (
                "Recarregar"
              )}
            </button>
          </div>

          <input
            type="text"
            placeholder="Filtrar por login, email, telefone ou ticket..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mb-4"
          />

          {msg && (
            <div
              className={`mb-4 p-3 rounded text-sm ${
                msg.type === "ok"
                  ? "bg-green-100 text-green-800 border border-green-200"
                  : "bg-red-100 text-red-800 border border-red-200"
              }`}
            >
              {msg.text}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-white uppercase text-xs">
                  <th className="p-2 text-left">Login</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Telefone</th>
                  <th className="p-2 text-left">Ticket</th>
                  <th className="p-2 text-center">Ativo</th>
                  <th className="p-2 text-left">Criado</th>
                  <th className="p-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-4 text-center text-gray-500"
                    >
                      {loading ? "Carregando..." : "Nenhum assinante."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((it) => (
                    <tr
                      key={it.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="p-2 font-mono text-xs">{it.login}</td>
                      <td className="p-2">{it.email}</td>
                      <td className="p-2">
                        {editingPhone?.id === it.id ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={editingPhone.value}
                              onChange={(e) =>
                                setEditingPhone({
                                  id: it.id,
                                  value: e.target.value,
                                })
                              }
                              className="flex-1 p-1 border border-gray-300 rounded text-xs"
                            />
                            <button
                              onClick={() => savePhone(it.id)}
                              disabled={busyId === it.id}
                              className="px-2 bg-green-600 text-white rounded text-xs"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setEditingPhone(null)}
                              className="px-2 bg-gray-400 text-white rounded text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span>{it.phone || "—"}</span>
                            <button
                              onClick={() =>
                                setEditingPhone({
                                  id: it.id,
                                  value: it.phone || "",
                                })
                              }
                              className="text-indigo-600 hover:text-indigo-800"
                              title="Editar telefone"
                            >
                              <BsPencil />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-xs font-mono truncate max-w-[180px]">
                        {it.ticket || "—"}
                      </td>
                      <td className="p-2 text-center">
                        {it.ativo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                            <BsCheckCircle /> Sim
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                            <BsXCircle /> Não
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-gray-500 text-xs">
                        {new Date(it.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-2 text-center space-x-1">
                        {canManage ? (
                          <>
                            <button
                              onClick={() => toggleStatus(it)}
                              disabled={busyId === it.id || !it.ticket}
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                it.ativo
                                  ? "bg-yellow-500 text-white hover:bg-yellow-600"
                                  : "bg-green-600 text-white hover:bg-green-700"
                              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
                              title={!it.ticket ? "Sem ticket" : ""}
                            >
                              {it.ativo ? "Desativar" : "Ativar"}
                            </button>
                            <button
                              onClick={() => remove(it)}
                              disabled={busyId === it.id}
                              className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:bg-gray-400"
                            >
                              <BsTrash />
                            </button>
                          </>
                        ) : (
                          <span
                            className="text-xs text-gray-400"
                            title="Permissão insuficiente"
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};
