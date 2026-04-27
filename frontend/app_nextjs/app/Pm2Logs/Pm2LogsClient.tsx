"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import NavBar from "@/components/NavBar";
import type { User } from "@/lib/auth";

type LogEntry = { name: string; pm_id: number; type: "out" | "err"; line: string };
type Filter = "all" | "err" | "out";

export default function Pm2LogsClient({ user }: { user: User }) {
  const token = user.token;

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lines, setLines] = useState(500);
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${process.env.REACT_APP_URL}/pm2-logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { lines },
        timeout: 60000,
      });
      setLogs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  }, [token, lines]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchLogs, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchLogs]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((e) => {
      if (filter !== "all" && e.type !== filter) return false;
      if (term && !e.line.toLowerCase().includes(term) && !e.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [logs, filter, search]);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [filtered, autoScroll]);

  const counts = useMemo(() => {
    let out = 0, err = 0;
    for (const l of logs) l.type === "err" ? err++ : out++;
    return { out, err, total: logs.length };
  }, [logs]);

  return (
    <div className="bg-zinc-700 min-h-screen text-slate-100">
      <NavBar user={user} />
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 mb-4">
          <h1 className="text-2xl font-semibold">PM2 Logs</h1>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md overflow-hidden border border-slate-600">
              {(["all", "out", "err"] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 text-sm font-medium transition-colors ${filter === f ? (f === "all" ? "bg-blue-600" : f === "out" ? "bg-green-600" : "bg-red-600") + " text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                  {f === "all" ? `Todos (${counts.total})` : f === "out" ? `Normais (${counts.out})` : `Erros (${counts.err})`}
                </button>
              ))}
            </div>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar por texto ou processo..." className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm w-64 focus:outline-none focus:border-blue-500" />
            <label className="flex items-center gap-2 text-sm">
              Linhas:
              <select value={lines} onChange={(e) => setLines(Number(e.target.value))} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm">
                {[100, 500, 1000, 2000, 5000].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-blue-500" />
              Auto-atualizar (5s)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="accent-blue-500" />
              Auto-scroll
            </label>
            <button onClick={fetchLogs} disabled={loading} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
              {loading ? "Carregando..." : "Atualizar"}
            </button>
          </div>
          {error && <div className="bg-red-900/40 border border-red-600 text-red-200 px-4 py-2 rounded text-sm">{error}</div>}
        </div>
        <div className="bg-black border border-slate-700 rounded-md p-3 font-mono text-xs sm:text-sm h-[calc(100vh-260px)] overflow-auto">
          {filtered.length === 0
            ? <div className="text-slate-500 italic">Nenhum log para exibir.</div>
            : filtered.map((entry, idx) => (
              <div key={idx} className={`whitespace-pre-wrap break-all leading-snug ${entry.type === "err" ? "text-red-400" : "text-green-400"}`}>
                <span className="text-slate-500">[{entry.name}#{entry.pm_id}]</span>{" "}
                <span className={entry.type === "err" ? "text-red-300" : "text-green-300"}>[{entry.type === "err" ? "ERR" : "OUT"}]</span>{" "}
                {entry.line}
              </div>
            ))
          }
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
