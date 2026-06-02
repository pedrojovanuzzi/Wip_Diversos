import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { FaRegFolder } from "react-icons/fa";
import { FiArrowLeft, FiFileText, FiArchive, FiSearch } from "react-icons/fi";
import { NavBar } from "../../../components/navbar/NavBar";
import { useAuth } from "../../../context/AuthContext";
import { Folder } from "../../../types";

interface FoldersProps {
  folders: Folder[];
}

const ROOT = "/var/log/cgnat/syslog";

const isFile = (name: string) =>
  name.endsWith(".gz") || name.endsWith(".log");

const fileIcon = (name: string) =>
  name.endsWith(".gz") ? FiArchive : FiFileText;

export default function FolderList({ folders }: FoldersProps) {
  const { user } = useAuth();
  const token = user?.token;
  const location = useLocation();
  const navigate = useNavigate();

  const initialPath = (location.state?.path as string) || ROOT;
  const [path, setPath] = useState(initialPath);
  const [projects, setProjects] = useState<Folder[]>(folders || []);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchFolders() {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.post(
          `${process.env.REACT_APP_URL}/ServerLogs/FoldersRecursion`,
          { path },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!cancelled) setProjects(response.data);
      } catch (e) {
        if (!cancelled) setError("Falha ao listar diretório.");
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchFolders();
    return () => {
      cancelled = true;
    };
  }, [path, token]);

  async function accessFolder(folderName: string) {
    const newPath = `${path}/${folderName}`;
    try {
      if (isFile(folderName)) {
        setLoading(true);
        const response = await axios.post(
          `${process.env.REACT_APP_URL}/ServerLogs/AccessFile`,
          { path: newPath },
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 60000,
          },
        );
        navigate("/LogViewer", {
          state: {
            fileName: folderName,
            content: response.data.content,
            path,
          },
        });
      } else {
        setPath(newPath);
      }
    } catch (e) {
      console.error(e);
      setPath(initialPath);
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    setPath((prev) => {
      const parts = prev.split("/").filter(Boolean);
      const rootParts = ROOT.split("/").filter(Boolean);
      if (parts.length <= rootParts.length) return ROOT;
      return "/" + parts.slice(0, -1).join("/");
    });
  }

  const crumbs = useMemo(() => {
    const parts = path.split("/").filter(Boolean);
    return parts.map((name, i) => ({
      name,
      fullPath: "/" + parts.slice(0, i + 1).join("/"),
    }));
  }, [path]);

  const filteredProjects = useMemo(() => {
    if (!query) return projects;
    const q = query.toLowerCase();
    return projects.filter((p) => String(p).toLowerCase().includes(q));
  }, [projects, query]);

  const folderItems = filteredProjects.filter((p) => !isFile(String(p)));
  const fileItems = filteredProjects.filter((p) => isFile(String(p)));

  const atRoot = path === ROOT;

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="inline-flex shrink-0 rounded-xl p-2.5 bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200">
              <FaRegFolder className="size-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Logs do Servidor
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Navegue pelos diretórios e abra arquivos de log.
              </p>
            </div>
          </div>
          <button
            onClick={goBack}
            disabled={atRoot}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiArrowLeft />
            <span className="hidden sm:inline">Voltar</span>
          </button>
        </div>

        {/* Breadcrumb + busca */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col gap-2">
          <nav className="flex flex-wrap items-center gap-1 text-xs font-mono text-slate-600 px-1">
            <span className="text-slate-400">/</span>
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              const rootDepth = ROOT.split("/").filter(Boolean).length;
              const aboveRoot = i < rootDepth - 1;
              const clickable = !last && !aboveRoot;
              return (
                <span key={c.fullPath} className="inline-flex items-center">
                  <button
                    onClick={() => clickable && setPath(c.fullPath)}
                    disabled={!clickable}
                    title={aboveRoot ? "Acima da raiz permitida" : undefined}
                    className={`px-1.5 py-0.5 rounded transition ${
                      last
                        ? "text-slate-900 font-semibold"
                        : aboveRoot
                          ? "text-slate-400 cursor-not-allowed"
                          : "text-cyan-700 hover:bg-cyan-50"
                    }`}
                  >
                    {c.name}
                  </button>
                  {!last && <span className="text-slate-300">/</span>}
                </span>
              );
            })}
          </nav>

          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar pastas e arquivos…"
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
            />
          </div>
        </div>

        {/* Estados */}
        {loading && (
          <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-500">
            <div className="inline-flex items-center gap-2">
              <span className="size-4 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin" />
              Carregando…
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="mt-4 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {!loading && !error && filteredProjects.length === 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-500">
            {projects.length === 0
              ? "Diretório vazio."
              : "Nenhum item corresponde à busca."}
          </div>
        )}

        {/* Pastas */}
        {!loading && folderItems.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Pastas ({folderItems.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {folderItems.map((project) => {
                const name = String(project);
                return (
                  <button
                    key={`f-${name}`}
                    onClick={() => accessFolder(name)}
                    className="group relative aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-cyan-300 hover:shadow-md hover:-translate-y-0.5 transition"
                    title={name}
                  >
                    <FaRegFolder className="size-10 text-cyan-600 group-hover:text-cyan-700 transition" />
                    <span className="text-xs font-medium text-slate-700 truncate max-w-[90%] text-center">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Arquivos */}
        {!loading && fileItems.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Arquivos ({fileItems.length})
            </h2>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {fileItems.map((project) => {
                const name = String(project);
                const Icon = fileIcon(name);
                const ext = name.endsWith(".gz") ? "gz" : "log";
                const extCls =
                  ext === "gz"
                    ? "bg-amber-50 text-amber-700 ring-amber-200"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200";
                return (
                  <button
                    key={`file-${name}`}
                    onClick={() => accessFolder(name)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition"
                  >
                    <span
                      className={`inline-flex shrink-0 rounded-lg p-2 ${ext === "gz" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="flex-1 text-sm font-mono text-slate-800 truncate">
                      {name}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset ${extCls}`}
                    >
                      .{ext}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
