import React, { useEffect, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import {
  BsTrash,
  BsArrowRepeat,
  BsLockFill,
  BsUnlockFill,
  BsClipboard,
  BsPencil,
  BsCheck,
  BsX,
} from "react-icons/bs";

interface ClienteItem {
  id: number;
  login: string;
  email: string | null;
  status: "pendente" | "ativo" | "bloqueado";
  setupLink: string | null;
  totalCameras: number;
  created_at: string;
}

export const CamerasAdmin: React.FC = () => {
  const { user } = useAuth();
  const base = process.env.REACT_APP_URL;
  const headers = { Authorization: `Bearer ${user?.token}` };

  const [items, setItems] = useState<ClienteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [editEmail, setEditEmail] = useState<{ id: number; value: string } | null>(
    null,
  );
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const flash = (text: string, type: "ok" | "err") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 5000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${base}/cameras/admin/clientes`, { headers });
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

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash("Link copiado!", "ok");
    } catch {
      flash("Copie manualmente: " + text, "err");
    }
  };

  const regenerar = async (id: number) => {
    setBusyId(id);
    try {
      const res = await axios.post(
        `${base}/cameras/admin/clientes/${id}/regenerar`,
        {},
        { headers },
      );
      await load();
      if (res.data.setupLink) copy(res.data.setupLink);
    } catch (e: any) {
      flash(e?.response?.data?.message || "Erro ao regenerar.", "err");
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (c: ClienteItem) => {
    const novo = c.status === "bloqueado" ? "ativo" : "bloqueado";
    setBusyId(c.id);
    try {
      await axios.put(
        `${base}/cameras/admin/clientes/${c.id}/status`,
        { status: novo },
        { headers },
      );
      await load();
    } catch (e: any) {
      flash(e?.response?.data?.message || "Erro ao alterar status.", "err");
    } finally {
      setBusyId(null);
    }
  };

  const saveEmail = async (id: number) => {
    if (!editEmail) return;
    setBusyId(id);
    try {
      await axios.put(
        `${base}/cameras/admin/clientes/${id}`,
        { email: editEmail.value },
        { headers },
      );
      setEditEmail(null);
      await load();
      flash("E-mail atualizado.", "ok");
    } catch (e: any) {
      flash(e?.response?.data?.message || "Erro ao salvar e-mail.", "err");
    } finally {
      setBusyId(null);
    }
  };

  const remover = async (id: number) => {
    if (!window.confirm("Remover este cliente e todas as suas câmeras?")) return;
    setBusyId(id);
    try {
      await axios.delete(`${base}/cameras/admin/clientes/${id}`, { headers });
      await load();
    } catch (e: any) {
      flash(e?.response?.data?.message || "Erro ao remover.", "err");
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (s: ClienteItem["status"]) => {
    const map: Record<string, string> = {
      pendente: "bg-yellow-100 text-yellow-800",
      ativo: "bg-green-100 text-green-800",
      bloqueado: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[s]}`}>{s}</span>
    );
  };

  const filtered = items.filter(
    (c) =>
      c.login.toLowerCase().includes(filter.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <>
      <NavBar />
      <div className="max-w-5xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-1">Gerenciar Câmeras (CFTV)</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Clientes com acesso ao portal de câmeras. A conta é criada ao adicionar uma
          câmera em <b>Serviços Adicionais</b>; aqui você edita os dados, regenera o
          link de cadastro, bloqueia ou remove.
        </p>

        {msg && (
          <div
            className={`mb-4 p-2 rounded text-sm ${
              msg.type === "ok"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {msg.text}
          </div>
        )}

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por login ou e-mail..."
          className="w-full sm:w-80 ring-1 ring-gray-300 rounded-md px-3 py-2 text-sm mb-4"
        />

        {loading ? (
          <p className="flex items-center gap-2 text-gray-500">
            <AiOutlineLoading3Quarters className="animate-spin" /> Carregando...
          </p>
        ) : (
          <div className="overflow-x-auto bg-white ring-1 ring-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2">Login</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Câmeras</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{c.login}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {editEmail?.id === c.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editEmail.value}
                            onChange={(e) =>
                              setEditEmail({ id: c.id, value: e.target.value })
                            }
                            className="ring-1 ring-gray-300 rounded px-2 py-1 text-sm w-48"
                          />
                          <button
                            onClick={() => saveEmail(c.id)}
                            className="text-green-600 hover:text-green-800"
                          >
                            <BsCheck />
                          </button>
                          <button
                            onClick={() => setEditEmail(null)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <BsX />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{c.email || "—"}</span>
                          <button
                            title="Editar e-mail"
                            onClick={() =>
                              setEditEmail({ id: c.id, value: c.email || "" })
                            }
                            className="text-gray-400 hover:text-gray-700"
                          >
                            <BsPencil />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">{statusBadge(c.status)}</td>
                    <td className="px-3 py-2">{c.totalCameras}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {c.setupLink && (
                          <button
                            title="Copiar link de cadastro"
                            onClick={() => copy(c.setupLink!)}
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            <BsClipboard />
                          </button>
                        )}
                        <button
                          title="Regenerar link de cadastro"
                          disabled={busyId === c.id}
                          onClick={() => regenerar(c.id)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <BsArrowRepeat />
                        </button>
                        {c.status !== "pendente" && (
                          <button
                            title={c.status === "bloqueado" ? "Desbloquear" : "Bloquear"}
                            disabled={busyId === c.id}
                            onClick={() => toggleStatus(c)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            {c.status === "bloqueado" ? <BsUnlockFill /> : <BsLockFill />}
                          </button>
                        )}
                        <button
                          title="Remover"
                          disabled={busyId === c.id}
                          onClick={() => remover(c.id)}
                          className="text-red-600 hover:text-red-800"
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
    </>
  );
};
