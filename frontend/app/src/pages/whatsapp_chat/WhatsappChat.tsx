import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { TiPencil } from "react-icons/ti";
import { FiSearch, FiMessageCircle, FiX, FiUser } from "react-icons/fi";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";

interface User {
  nome: string;
  telefone: string;
}

interface Conversation {
  id: string;
  user: User;
}

const isPhoneOnly = (name: string) =>
  !!name && /^[\d\s+()-]+$/.test(name.trim());

const initials = (name: string) =>
  (name || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const avatarColor = (seed: string) => {
  const palette = [
    "from-emerald-500 to-teal-500",
    "from-sky-500 to-indigo-500",
    "from-amber-500 to-orange-500",
    "from-rose-500 to-pink-500",
    "from-purple-500 to-fuchsia-500",
    "from-lime-500 to-emerald-500",
  ];
  let hash = 0;
  for (let i = 0; i < (seed || "").length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
};

const formatPhone = (raw: string) => {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 13) {
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12) {
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  return raw || "";
};

export default function WhatsappChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [newName, setNewName] = useState("");
  const [recentConvBool, setRecentConvBool] = useState(true);
  const [query, setQuery] = useState("");
  const [savingName, setSavingName] = useState(false);

  const { user } = useAuth();
  const token = user?.token;

  function openModal(id: string, currentName: string) {
    setSelectedId(id);
    setNewName(currentName);
    setShowModal(true);
  }

  async function fetchConversations() {
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/whatsapp/conversations",
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (response.status === 200) {
        setConversations(response.data.conversations);
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
    }
  }

  async function fetchLastConversations() {
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/whatsapp/Lastconversation",
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (response.status === 200) {
        setConversations(response.data);
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
    }
  }

  async function changeName(id: number | string, nome: string) {
    setSavingName(true);
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/whatsapp/conversations",
        { id, nome },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (response.status === 200) {
        setConversations(response.data.conversation);
      }
    } catch (error) {
      console.log("Error changing name:", error);
    } finally {
      setSavingName(false);
    }
  }

  useEffect(() => {
    let interval: any;
    if (recentConvBool) {
      fetchLastConversations();
      interval = setInterval(fetchLastConversations, 10000);
    } else {
      fetchConversations();
      interval = setInterval(fetchConversations, 10000);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentConvBool]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      [c.user?.nome, c.user?.telefone]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [conversations, query]);

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="inline-flex rounded-xl p-2.5 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <FiMessageCircle className="size-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Conversas WhatsApp
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Selecione uma conversa para abrir o atendimento.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
            />
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 self-stretch sm:self-auto">
            <button
              onClick={() => setRecentConvBool(true)}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                recentConvBool
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Recentes
            </button>
            <button
              onClick={() => setRecentConvBool(false)}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                !recentConvBool
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Todas
            </button>
          </div>
        </div>

        {/* Counter */}
        <p className="mt-3 text-xs text-slate-500">
          {filtered.length}{" "}
          {filtered.length === 1 ? "conversa" : "conversas"}
          {query && ` correspondem a "${query}"`}
        </p>

        {/* List */}
        <div className="mt-3 bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              {conversations.length === 0
                ? "Sem clientes encontrados."
                : "Nenhuma conversa corresponde à busca."}
            </div>
          ) : (
            filtered.map((conv) => (
              <div
                key={conv.id}
                className="group relative flex items-center gap-3 p-3 sm:p-4 hover:bg-slate-50 transition"
              >
                <Link
                  to={`/Whatsapp/${conv.id}`}
                  className="absolute inset-0"
                  aria-label={`Abrir conversa de ${conv.user?.nome}`}
                />
                <div
                  className={`shrink-0 size-12 rounded-full bg-gradient-to-br ${avatarColor(conv.user?.nome || conv.id)} text-white flex items-center justify-center text-sm font-bold shadow-sm`}
                >
                  {isPhoneOnly(conv.user?.nome) || !conv.user?.nome ? (
                    <FiUser className="size-5" />
                  ) : (
                    initials(conv.user.nome)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {conv.user?.nome || "Sem nome"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {formatPhone(conv.user?.telefone) || "—"}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openModal(conv.id, conv.user?.nome || "");
                  }}
                  className="relative z-10 inline-flex items-center justify-center size-9 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
                  title="Renomear"
                >
                  <TiPencil className="size-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal renomear */}
      {showModal && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !savingName && setShowModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Alterar nome
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Renomeie o contato exibido na lista.
                </p>
              </div>
              <button
                onClick={() => !savingName && setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <FiX className="size-5" />
              </button>
            </div>

            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Novo nome
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
              placeholder="Nome do contato"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                disabled={savingName}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (selectedId) {
                    changeName(selectedId, newName);
                    setShowModal(false);
                  }
                }}
                disabled={savingName || !newName.trim()}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingName ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
