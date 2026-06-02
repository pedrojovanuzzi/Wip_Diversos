import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiCopy,
  FiDownload,
  FiFileText,
  FiSearch,
  FiCheck,
} from "react-icons/fi";

export const LogViewer = () => {
  const location = useLocation();
  const { fileName, content, path } = location.state || {};
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(true);

  const lines = useMemo<string[]>(
    () => (content ? String(content).split(/\r?\n/) : []),
    [content],
  );

  const matchCount = useMemo(() => {
    if (!query) return 0;
    try {
      const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      return (String(content) || "").match(re)?.length ?? 0;
    } catch {
      return 0;
    }
  }, [query, content]);

  function goBack() {
    navigate("/ServerLogs", { state: { path } });
  }

  function copyAll() {
    if (!content) return;
    navigator.clipboard.writeText(String(content));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadFile() {
    if (!content) return;
    const blob = new Blob([String(content)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "log.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function highlight(line: string) {
    if (!query) return line;
    try {
      const re = new RegExp(
        `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi",
      );
      const parts = line.split(re);
      return parts.map((p, i) =>
        re.test(p) ? (
          <mark
            key={i}
            className="bg-amber-300/40 text-amber-200 rounded px-0.5"
          >
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      );
    } catch {
      return line;
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="inline-flex shrink-0 rounded-xl p-2.5 bg-slate-900 text-emerald-300">
              <FiFileText className="size-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                {fileName || "Arquivo"}
              </h1>
              {path && (
                <p className="text-xs text-slate-500 font-mono truncate">
                  {path}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={goBack}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <FiArrowLeft />
            <span className="hidden sm:inline">Voltar</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no arquivo…"
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
            />
            {query && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                {matchCount} match(es)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setWrap((w) => !w)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                wrap
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Quebra de linha
            </button>
            <button
              onClick={copyAll}
              disabled={!content}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              {copied ? (
                <FiCheck className="text-emerald-500" />
              ) : (
                <FiCopy />
              )}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <button
              onClick={downloadFile}
              disabled={!content}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 text-white px-3 py-2 text-xs font-medium hover:bg-slate-700 transition disabled:opacity-50"
            >
              <FiDownload />
              Baixar
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="mt-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-800/60 border-b border-slate-800 text-[11px] text-slate-400">
            <span>{lines.length} linha(s)</span>
            <span className="font-mono">
              {String(content || "").length.toLocaleString("pt-BR")} caracteres
            </span>
          </div>

          {!content ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Sem conteúdo.
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <pre
                className={`font-mono text-[12px] leading-relaxed text-slate-100 ${wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"}`}
              >
                {lines.map((line, i) => (
                  <div
                    key={i}
                    className="flex hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="select-none sticky left-0 inline-block w-12 text-right pr-3 py-0.5 text-slate-500 bg-slate-900 border-r border-slate-800">
                      {i + 1}
                    </span>
                    <span className="pl-3 py-0.5 flex-1">
                      {line ? highlight(line) : " "}
                    </span>
                  </div>
                ))}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
