import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { NavBar } from "../../components/navbar/NavBar";
import { FaRegFolder, FaFileExcel, FaSearch } from "react-icons/fa";

export const ClientLogsSearch = () => {
  const { user } = useAuth();
  const token = user?.token;

  const [folders, setFolders] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
    today.getDate()
  )}`;

  const [startDate, setStartDate] = useState(`${todayStr}T00:00`);
  const [endDate, setEndDate] = useState(`${todayStr}T23:59`);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [progress, setProgress] = useState<{
    status: "idle" | "running" | "done" | "error";
    totalFiles: number;
    processedFiles: number;
    hits: number;
    currentFile: string;
    message: string;
  }>({
    status: "idle",
    totalFiles: 0,
    processedFiles: 0,
    hits: 0,
    currentFile: "",
    message: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_URL}/ServerLogs`,
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 60000,
          }
        );
        setFolders(response.data || []);
      } catch (error) {
        console.error(error);
        setErrorMsg("Falha ao carregar pastas do servidor de logs.");
      }
    })();
  }, [token]);

  const filteredFolders = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.toLowerCase().includes(q));
  }, [folders, filter]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filteredFolders.forEach((f) => next.add(f));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const submit = async () => {
    setErrorMsg(null);
    setInfo(null);

    if (!startDate || !endDate) {
      setErrorMsg("Informe a data/hora de início e fim.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setErrorMsg("A data inicial deve ser anterior à data final.");
      return;
    }
    if (selected.size === 0) {
      setErrorMsg("Selecione pelo menos uma pasta.");
      return;
    }

    setLoading(true);
    setProgress({
      status: "running",
      totalFiles: 0,
      processedFiles: 0,
      hits: 0,
      currentFile: "",
      message: "Iniciando...",
    });

    try {
      const startResp = await axios.post(
        `${process.env.REACT_APP_URL}/ServerLogs/SearchClientLogs/start`,
        {
          startDate,
          endDate,
          folders: Array.from(selected),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const jobId: string = startResp.data?.jobId;
      if (!jobId) throw new Error("Falha ao criar o job.");

      // Polling de progresso
      const poll = async (): Promise<void> => {
        while (true) {
          await new Promise((r) => setTimeout(r, 1000));
          const p = await axios.get(
            `${process.env.REACT_APP_URL}/ServerLogs/SearchClientLogs/progress/${jobId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const data = p.data || {};
          setProgress({
            status: data.status,
            totalFiles: data.totalFiles || 0,
            processedFiles: data.processedFiles || 0,
            hits: data.hits || 0,
            currentFile: data.currentFile || "",
            message: data.message || "",
          });
          if (data.status === "done") return;
          if (data.status === "error") {
            throw new Error(data.error || "Erro durante o processamento.");
          }
        }
      };

      await poll();

      // Download
      const dl = await axios.get(
        `${process.env.REACT_APP_URL}/ServerLogs/SearchClientLogs/download/${jobId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
          timeout: 0,
        }
      );

      const totalHits = dl.headers["x-total-hits"];
      const filesProcessed = dl.headers["x-files-processed"];

      const blob = new Blob([dl.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .substring(0, 19);
      link.href = url;
      link.download = `logs-clientes-${stamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setInfo(
        `Relatório gerado. Ocorrências encontradas: ${
          totalHits ?? "?"
        } · Arquivos processados: ${filesProcessed ?? "?"}.`
      );
    } catch (err: any) {
      console.error(err);
      let msg = err?.message || "Falha ao gerar o relatório.";
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          msg = json?.error || msg;
        } catch (_) {
          /* noop */
        }
      } else if (err?.response?.data?.error) {
        msg = err.response.data.error;
      }
      setErrorMsg(msg);
      setProgress((p) => ({ ...p, status: "error" }));
    } finally {
      setLoading(false);
    }
  };

  const pct =
    progress.totalFiles > 0
      ? Math.min(
          100,
          Math.round((progress.processedFiles / progress.totalFiles) * 100)
        )
      : progress.status === "done"
      ? 100
      : 0;

  return (
    <div className="bg-slate-200 min-h-screen overflow-auto">
      <NavBar />
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow p-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">
            Busca de Conexões de Clientes
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Selecione o intervalo de data/hora e as pastas (concentradores) onde
            deseja buscar os logs de autenticação. O resultado é exportado em
            Excel com os dados completos do cliente para envio à Polícia de
            Crimes Cibernéticos.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Início
              </label>
              <input
                type="datetime-local"
                step={1}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fim
              </label>
              <input
                type="datetime-local"
                step={1}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <FaSearch className="text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar pastas..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllVisible}
                className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
              >
                Selecionar todas visíveis
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
              >
                Limpar seleção
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 mb-2">
            {selected.size} pasta(s) selecionada(s) de {folders.length}
          </div>

          <div className="border border-slate-200 rounded-xl p-3 max-h-80 overflow-auto bg-slate-50">
            {filteredFolders.length === 0 ? (
              <div className="text-sm text-slate-500 p-4 text-center">
                Nenhuma pasta encontrada.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {filteredFolders.map((name) => {
                  const checked = selected.has(name);
                  return (
                    <label
                      key={name}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all ${
                        checked
                          ? "bg-blue-50 border-blue-400"
                          : "bg-white border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(name)}
                        className="accent-blue-600"
                      />
                      <FaRegFolder className="text-slate-500 shrink-0" />
                      <span
                        className="text-sm text-slate-700 truncate"
                        title={name}
                      >
                        {name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {(loading || progress.status === "running" || progress.status === "done") && (
            <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700">
                  {progress.status === "done"
                    ? "Concluído"
                    : progress.message || "Processando..."}
                </span>
                <span className="text-sm font-mono text-slate-600">
                  {progress.processedFiles}/{progress.totalFiles} ({pct}%)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    progress.status === "done"
                      ? "bg-emerald-500"
                      : "bg-blue-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span className="truncate max-w-[70%]" title={progress.currentFile}>
                  {progress.currentFile || "—"}
                </span>
                <span>Ocorrências: {progress.hits}</span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
              {errorMsg}
            </div>
          )}
          {info && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm">
              {info}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FaFileExcel />
              {loading ? "Gerando relatório..." : "Buscar e gerar Excel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
