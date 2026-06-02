import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { compareAsc, format } from "date-fns";
import {
  FiArrowLeft,
  FiFileText,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { LogsPPPoes } from "../../types";

const parseDate = (s: string) => {
  if (!s) return new Date(0);
  if (s.includes("T")) return new Date(s);
  return new Date(s.replace(" ", "T"));
};

const topicTone = (topics: string) => {
  const t = (topics || "").toLowerCase();
  if (t.includes("error") || t.includes("fail") || t.includes("crit"))
    return "bg-rose-50 text-rose-700 ring-rose-200";
  if (t.includes("warn"))
    return "bg-amber-50 text-amber-700 ring-amber-200";
  if (t.includes("info"))
    return "bg-sky-50 text-sky-700 ring-sky-200";
  if (t.includes("ppp") || t.includes("session"))
    return "bg-indigo-50 text-indigo-700 ring-indigo-200";
  return "bg-slate-50 text-slate-600 ring-slate-200";
};

const serverColor = (servidor: string) => {
  const palette = [
    "bg-emerald-50 text-emerald-700 ring-emerald-200",
    "bg-sky-50 text-sky-700 ring-sky-200",
    "bg-purple-50 text-purple-700 ring-purple-200",
    "bg-amber-50 text-amber-700 ring-amber-200",
    "bg-teal-50 text-teal-700 ring-teal-200",
    "bg-rose-50 text-rose-700 ring-rose-200",
  ];
  let hash = 0;
  for (let i = 0; i < (servidor || "").length; i++) {
    hash = (hash * 31 + servidor.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
};

export const LogsClient = () => {
  const { user } = useAuth();
  const token = user?.token;
  const navigate = useNavigate();

  const [content, setContent] = useState<LogsPPPoes[] | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    logList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function logList() {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/ClientAnalytics/Logs`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setContent(response.data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Erro ao carregar logs.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!content) return [];
    const q = query.trim().toLowerCase();
    const arr = q
      ? content.filter((f) =>
          [f.servidor, f.message, f.topics, f.extra]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(q)),
        )
      : content;
    return arr
      .slice()
      .sort((a, b) =>
        order === "asc"
          ? compareAsc(parseDate(a.time), parseDate(b.time))
          : compareAsc(parseDate(b.time), parseDate(a.time)),
      );
  }, [content, query, order]);

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-xl p-2.5 bg-slate-900 text-emerald-300">
              <FiFileText className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Logs PPPoE
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Eventos recentes registrados nos servidores PPPoE.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/ClientAnalytics")}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <FiArrowLeft />
            <span className="hidden sm:inline">Voltar</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por servidor, mensagem, tópico…"
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="desc">Mais recentes primeiro</option>
              <option value="asc">Mais antigos primeiro</option>
            </select>
            <button
              onClick={logList}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-3 py-2.5 text-sm font-medium hover:bg-slate-700 transition disabled:opacity-50"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>

        {/* Resumo */}
        {content && (
          <p className="mt-3 text-xs text-slate-500">
            {filtered.length} de {content.length} entrada(s)
            {query && ` correspondem a "${query}"`}
          </p>
        )}

        {/* Lista */}
        <div className="mt-4 space-y-2">
          {loading && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-500">
              <div className="inline-flex items-center gap-2">
                <span className="size-4 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin" />
                Carregando logs…
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-500">
              Nenhum log encontrado.
            </div>
          )}

          {!loading &&
            !error &&
            filtered.map((f, i) => (
              <article
                key={`${f.time}-${i}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow transition p-4"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${serverColor(f.servidor)}`}
                  >
                    {f.servidor || "—"}
                  </span>
                  {f.topics && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${topicTone(f.topics)}`}
                    >
                      {f.topics}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-slate-400 font-mono">
                    {format(parseDate(f.time), "dd/MM/yyyy HH:mm:ss")}
                  </span>
                </div>

                {f.message && (
                  <p className="font-mono text-xs sm:text-sm text-slate-800 break-words whitespace-pre-wrap leading-relaxed">
                    {f.message}
                  </p>
                )}

                {f.extra && (
                  <p className="mt-1.5 font-mono text-[11px] text-slate-500 break-words whitespace-pre-wrap">
                    {f.extra}
                  </p>
                )}
              </article>
            ))}
        </div>
      </div>
    </div>
  );
};
