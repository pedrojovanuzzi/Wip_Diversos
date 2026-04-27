import axios from "axios";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../../context/AuthContext";
import { NavBar } from "../../components/navbar/NavBar";

type LogEntry = {
  name: string;
  pm_id: number;
  type: "out" | "err";
  line: string;
};

type Filter = "all" | "err" | "out";

export const Pm2Logs = () => {
  const { user } = useAuth();
  const token = user?.token;

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [lines, setLines] = useState<number>(500);
  const [search, setSearch] = useState<string>("");
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/pm2-logs`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { lines },
          timeout: 60000,
        },
      );
      setLogs(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.error || err?.message || "Erro ao carregar logs",
      );
    } finally {
      setLoading(false);
    }
  }, [token, lines]);

  useEffect(() => {
    document.title = "PM2 Logs";
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchLogs, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchLogs]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((entry) => {
      if (filter !== "all" && entry.type !== filter) return false;
      if (
        term &&
        !entry.line.toLowerCase().includes(term) &&
        !entry.name.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [logs, filter, search]);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [filtered, autoScroll]);

  const counts = useMemo(() => {
    let out = 0;
    let err = 0;
    for (const l of logs) {
      if (l.type === "err") err += 1;
      else out += 1;
    }
    return { out, err, total: logs.length };
  }, [logs]);

  return (
    <div className="bg-zinc-700 min-h-screen text-slate-100">
      <NavBar />
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 mb-4">
          <h1 className="text-2xl font-semibold">PM2 Logs</h1>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md overflow-hidden border border-slate-600">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Todos ({counts.total})
              </button>
              <button
                onClick={() => setFilter("out")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === "out"
                    ? "bg-green-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Normais ({counts.out})
              </button>
              <button
                onClick={() => setFilter("err")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === "err"
                    ? "bg-red-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Erros ({counts.err})
              </button>
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por texto ou processo..."
              className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm w-64 focus:outline-none focus:border-blue-500"
            />

            <label className="flex items-center gap-2 text-sm">
              Linhas:
              <select
                value={lines}
                onChange={(e) => setLines(Number(e.target.value))}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
              >
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={2000}>2000</option>
                <option value={5000}>5000</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-blue-500"
              />
              Auto-atualizar (5s)
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="accent-blue-500"
              />
              Auto-scroll
            </label>

            <button
              onClick={fetchLogs}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              {loading ? "Carregando..." : "Atualizar"}
            </button>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-600 text-red-200 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="bg-black border border-slate-700 rounded-md p-3 font-mono text-xs sm:text-sm h-[calc(100vh-260px)] overflow-auto">
          {filtered.length === 0 ? (
            <div className="text-slate-500 italic">Nenhum log para exibir.</div>
          ) : (
            filtered.map((entry, idx) => (
              <div
                key={idx}
                className={`whitespace-pre-wrap break-all leading-snug ${
                  entry.type === "err" ? "text-red-400" : "text-green-400"
                }`}
              >
                <span className="text-slate-500">
                  [{entry.name}#{entry.pm_id}]
                </span>{" "}
                <span
                  className={
                    entry.type === "err" ? "text-red-300" : "text-green-300"
                  }
                >
                  [{entry.type === "err" ? "ERR" : "OUT"}]
                </span>{" "}
                {entry.line}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};

export default Pm2Logs;
