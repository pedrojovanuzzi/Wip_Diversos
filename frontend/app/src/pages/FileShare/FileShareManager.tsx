import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import {
  BsTrash,
  BsClipboard,
  BsCheck,
  BsCloudUploadFill,
  BsDownload,
  BsFileEarmarkFill,
} from "react-icons/bs";

interface FileItem {
  id: number;
  token: string;
  originalName: string;
  storedName: string;
  mimeType: string | null;
  size: number;
  downloads: number;
  created_at: string;
}

function formatSize(bytes: number): string {
  const b = Number(bytes);
  if (!b || b < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export const FileShareManager: React.FC = () => {
  const base = process.env.REACT_APP_URL; // ex.: http://localhost:3000/api

  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(
    null
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const flash = (text: string, type: "ok" | "err") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 5000);
  };

  const downloadUrl = (token: string) => `${base}/files/d/${token}`;

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${base}/files/list`);
      setItems(res.data || []);
    } catch (e: any) {
      flash(e?.response?.data?.erro || "Erro ao carregar arquivos", "err");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const form = new FormData();
      form.append("file", file);
      await axios.post(`${base}/files/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (ev) => {
          if (ev.total) {
            setProgress(Math.round((ev.loaded * 100) / ev.total));
          }
        },
      });
      flash("Arquivo enviado com sucesso!", "ok");
      await fetchList();
    } catch (e: any) {
      flash(e?.response?.data?.erro || "Erro ao enviar arquivo", "err");
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const copyLink = async (item: FileItem) => {
    const url = downloadUrl(item.token);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback simples
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const removeItem = async (item: FileItem) => {
    if (!window.confirm(`Excluir "${item.originalName}"? O link deixará de funcionar.`))
      return;
    try {
      await axios.delete(`${base}/files/${item.id}`);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      flash("Arquivo excluído.", "ok");
    } catch (e: any) {
      flash(e?.response?.data?.erro || "Erro ao excluir", "err");
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 text-white flex">
      <NavBar />

      <div className="flex-1 p-4 sm:p-8 max-w-5xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <BsCloudUploadFill className="text-green-400" />
          Compartilhar Arquivos
        </h1>
        <p className="text-stone-400 text-sm mb-6">
          Envie um arquivo e gere um link público de download para compartilhar.
        </p>

        {msg && (
          <div
            className={`mb-4 p-3 rounded-md text-sm ${
              msg.type === "ok"
                ? "bg-green-600/20 border border-green-600 text-green-300"
                : "bg-red-600/20 border border-red-600 text-red-300"
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Área de upload */}
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`cursor-pointer border-2 border-dashed rounded-xl p-10 text-center transition-all ${
            dragOver
              ? "border-green-400 bg-green-400/10"
              : "border-stone-600 hover:border-green-500 hover:bg-stone-800"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleSelect}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <AiOutlineLoading3Quarters className="animate-spin size-8 text-green-400" />
              <span>Enviando… {progress}%</span>
              <div className="w-full max-w-xs bg-stone-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-green-500 h-2 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-stone-300">
              <BsCloudUploadFill className="size-10 text-green-400" />
              <span className="font-medium">
                Clique ou arraste um arquivo aqui
              </span>
              <span className="text-xs text-stone-500">
                Limite de 1 GB por arquivo
              </span>
            </div>
          )}
        </div>

        {/* Lista de arquivos */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">
            Arquivos enviados {items.length > 0 && `(${items.length})`}
          </h2>

          {loading ? (
            <div className="flex items-center gap-2 text-stone-400">
              <AiOutlineLoading3Quarters className="animate-spin" />
              Carregando…
            </div>
          ) : items.length === 0 ? (
            <p className="text-stone-500 text-sm">Nenhum arquivo enviado ainda.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-stone-800 border border-stone-700 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <BsFileEarmarkFill className="size-6 text-green-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate" title={item.originalName}>
                        {item.originalName}
                      </p>
                      <p className="text-xs text-stone-400">
                        {formatSize(item.size)} · {item.downloads} download
                        {item.downloads === 1 ? "" : "s"} ·{" "}
                        {new Date(item.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copyLink(item)}
                      className="flex items-center gap-1 bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-md text-sm transition-colors"
                      title="Copiar link de download"
                    >
                      {copiedId === item.id ? (
                        <>
                          <BsCheck className="size-4" /> Copiado
                        </>
                      ) : (
                        <>
                          <BsClipboard className="size-4" /> Copiar link
                        </>
                      )}
                    </button>
                    <a
                      href={downloadUrl(item.token)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 bg-stone-700 hover:bg-stone-600 px-3 py-1.5 rounded-md text-sm transition-colors"
                      title="Abrir/baixar"
                    >
                      <BsDownload className="size-4" />
                    </a>
                    <button
                      onClick={() => removeItem(item)}
                      className="flex items-center gap-1 bg-red-600/80 hover:bg-red-600 px-3 py-1.5 rounded-md text-sm transition-colors"
                      title="Excluir"
                    >
                      <BsTrash className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileShareManager;
