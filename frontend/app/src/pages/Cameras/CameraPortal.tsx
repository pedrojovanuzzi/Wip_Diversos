import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { MdVideocam, MdLogout, MdAdd, MdPlayArrow, MdFolder, MdDownload } from "react-icons/md";
import { BsTrash } from "react-icons/bs";
import { WhepPlayer } from "./components/WhepPlayer";
import InstallPWAButton from "./components/InstallPWAButton";
import { getCamSession, getCamToken, clearCamSession } from "./cameraAuth";

interface Cam {
  id: number;
  nome: string;
  ativo: boolean;
  created_at: string;
}

interface RecFile {
  name: string;
  size: number;
  mtime: string;
}

interface Storage {
  usedBytes: number;
  quotaBytes: number;
}

export default function CameraPortal() {
  const navigate = useNavigate();
  const base = process.env.REACT_APP_URL;
  const session = getCamSession();

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${getCamToken()}` }),
    [],
  );

  const [cams, setCams] = useState<Cam[]>([]);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  // add form
  const [nome, setNome] = useState("");
  const [rtsp, setRtsp] = useState("");
  const [adding, setAdding] = useState(false);

  // live
  const [liveCam, setLiveCam] = useState<Cam | null>(null);
  const [whepUrl, setWhepUrl] = useState<string | null>(null);

  // pasta (arquivos no disco)
  const [folderCam, setFolderCam] = useState<Cam | null>(null);
  const [files, setFiles] = useState<RecFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileVideoUrl, setFileVideoUrl] = useState<string | null>(null);

  const flash = (text: string, type: "ok" | "err") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleAuthError = useCallback(
    (e: any) => {
      if (e?.response?.status === 401) {
        clearCamSession();
        navigate("/Cameras/Login");
        return true;
      }
      return false;
    },
    [navigate],
  );

  const loadStorage = useCallback(async () => {
    try {
      const res = await axios.get(`${base}/cameras/storage`, {
        headers: authHeaders(),
      });
      setStorage(res.data);
    } catch (e: any) {
      handleAuthError(e); // silencioso: não bloqueia o portal por causa da barra
    }
  }, [base, authHeaders, handleAuthError]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${base}/cameras/cameras`, {
        headers: authHeaders(),
      });
      setCams(res.data.items || []);
      loadStorage();
    } catch (e: any) {
      if (!handleAuthError(e)) flash("Erro ao carregar câmeras.", "err");
    } finally {
      setLoading(false);
    }
  }, [base, authHeaders, handleAuthError, loadStorage]);

  useEffect(() => {
    load();
  }, [load]);

  const addCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await axios.post(
        `${base}/cameras/cameras`,
        { nome, rtsp_url: rtsp },
        { headers: authHeaders() },
      );
      flash(res.data.warning || "Câmera adicionada.", res.data.warning ? "err" : "ok");
      setNome("");
      setRtsp("");
      await load();
    } catch (e: any) {
      if (!handleAuthError(e))
        flash(e?.response?.data?.message || "Erro ao adicionar.", "err");
    } finally {
      setAdding(false);
    }
  };

  const removeCamera = async (id: number) => {
    if (!window.confirm("Remover esta câmera?")) return;
    try {
      await axios.delete(`${base}/cameras/cameras/${id}`, { headers: authHeaders() });
      if (liveCam?.id === id) closeLive();
      if (folderCam?.id === id) setFolderCam(null);
      await load();
    } catch (e: any) {
      if (!handleAuthError(e)) flash("Erro ao remover.", "err");
    }
  };

  const openLive = async (cam: Cam) => {
    setFolderCam(null);
    setLiveCam(cam);
    setWhepUrl(null);
    try {
      const res = await axios.get(`${base}/cameras/cameras/${cam.id}/stream`, {
        headers: authHeaders(),
      });
      setWhepUrl(res.data.whepUrl);
    } catch (e: any) {
      if (!handleAuthError(e)) flash("Erro ao iniciar o vídeo.", "err");
      setLiveCam(null);
    }
  };

  const closeLive = () => {
    setLiveCam(null);
    setWhepUrl(null);
  };

  const openFolder = async (cam: Cam) => {
    closeLive();
    setFolderCam(cam);
    setFileVideoUrl(null);
    setFilesLoading(true);
    try {
      const res = await axios.get(`${base}/cameras/cameras/${cam.id}/files`, {
        headers: authHeaders(),
      });
      setFiles(res.data.items || []);
    } catch (e: any) {
      if (!handleAuthError(e)) flash("Erro ao abrir a pasta.", "err");
    } finally {
      setFilesLoading(false);
    }
  };

  // URL do arquivo (token na query, pois <video> não envia header).
  const fileUrl = (camId: number, name: string) =>
    `${base}/cameras/cameras/${camId}/files/${encodeURIComponent(name)}?token=${getCamToken()}`;

  const fmtSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  };

  const fmtGB = (bytes: number) => (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";

  const logout = () => {
    clearCamSession();
    navigate("/Cameras/Login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white ring-1 ring-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="flex items-center gap-2 font-bold text-gray-800">
            <MdVideocam className="text-indigo-600 text-xl" /> Minhas Câmeras
          </h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <InstallPWAButton />
            <span>{session?.login}</span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1 text-red-600 hover:text-red-800"
            >
              <MdLogout /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
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

        {/* Uso de armazenamento (cota por cliente) */}
        {storage && (
          <div className="bg-white ring-1 ring-gray-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-gray-700">Armazenamento</span>
              <span className="text-gray-500">
                {fmtGB(storage.usedBytes)} de {fmtGB(storage.quotaBytes)}
              </span>
            </div>
            {(() => {
              const pct = storage.quotaBytes
                ? Math.min(100, (storage.usedBytes / storage.quotaBytes) * 100)
                : 0;
              const cor =
                pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-indigo-600";
              return (
                <>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${cor} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Ao atingir o limite, as gravações mais antigas são apagadas
                    automaticamente.
                  </p>
                </>
              );
            })()}
          </div>
        )}

        {/* Adicionar câmera */}
        <form
          onSubmit={addCamera}
          className="bg-white ring-1 ring-gray-200 rounded-lg p-4 mb-6 grid gap-3 sm:grid-cols-[1fr_2fr_auto] items-end"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Portão, Garagem..."
              className="w-full ring-1 ring-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL RTSP
            </label>
            <input
              value={rtsp}
              onChange={(e) => setRtsp(e.target.value)}
              required
              placeholder="rtsp://usuario:senha@ip:554/stream"
              className="w-full ring-1 ring-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center justify-center gap-1 bg-indigo-600 disabled:bg-gray-300 text-white rounded-md px-4 py-2 text-sm h-[38px]"
          >
            <MdAdd /> {adding ? "..." : "Adicionar"}
          </button>
        </form>

        {/* Player ao vivo */}
        {liveCam && (
          <div className="mb-6 bg-white ring-1 ring-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Ao vivo — {liveCam.nome}</h2>
              <button onClick={closeLive} className="text-sm text-gray-500 hover:text-gray-800">
                Fechar
              </button>
            </div>
            {whepUrl ? (
              <WhepPlayer whepUrl={whepUrl} className="aspect-video w-full" />
            ) : (
              <p className="flex items-center gap-2 text-gray-500 py-10 justify-center">
                <AiOutlineLoading3Quarters className="animate-spin" /> Iniciando...
              </p>
            )}
          </div>
        )}

        {/* Pasta (arquivos gravados) */}
        {folderCam && (
          <div className="mb-6 bg-white ring-1 ring-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <MdFolder className="text-indigo-600" /> Pasta — {folderCam.nome}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => openFolder(folderCam)}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Atualizar
                </button>
                <button
                  onClick={() => setFolderCam(null)}
                  className="text-sm text-gray-500 hover:text-gray-800"
                >
                  Fechar
                </button>
              </div>
            </div>

            {fileVideoUrl && (
              <video
                key={fileVideoUrl}
                src={fileVideoUrl}
                controls
                autoPlay
                className="w-full aspect-video bg-black rounded-md mb-3"
              />
            )}

            {filesLoading ? (
              <p className="flex items-center gap-2 text-gray-500">
                <AiOutlineLoading3Quarters className="animate-spin" /> Carregando...
              </p>
            ) : files.length === 0 ? (
              <p className="text-gray-400 text-sm">
                Nenhum arquivo gravado ainda. As gravações aparecem aqui conforme o
                MediaMTX grava (pode levar alguns minutos).
              </p>
            ) : (
              <ul className="divide-y max-h-80 overflow-auto">
                {files.map((f) => (
                  <li
                    key={f.name}
                    className="flex items-center justify-between py-2 text-sm gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{f.name}</p>
                      <p className="text-gray-400 text-xs">
                        {new Date(f.mtime).toLocaleString()} · {fmtSize(f.size)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => setFileVideoUrl(fileUrl(folderCam.id, f.name))}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                      >
                        <MdPlayArrow /> Ver
                      </button>
                      <a
                        href={fileUrl(folderCam.id, f.name)}
                        download={f.name}
                        className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                      >
                        <MdDownload /> Baixar
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Lista de câmeras */}
        {loading ? (
          <p className="flex items-center gap-2 text-gray-500">
            <AiOutlineLoading3Quarters className="animate-spin" /> Carregando...
          </p>
        ) : cams.length === 0 ? (
          <p className="text-gray-400 text-center py-10">
            Você ainda não cadastrou câmeras.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cams.map((cam) => (
              <div
                key={cam.id}
                className="bg-white ring-1 ring-gray-200 rounded-lg p-4 flex flex-col"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold">{cam.nome}</h3>
                  <button
                    onClick={() => removeCamera(cam.id)}
                    className="text-red-500 hover:text-red-700"
                    title="Remover"
                  >
                    <BsTrash />
                  </button>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => openLive(cam)}
                    className="flex-1 bg-indigo-600 text-white rounded-md px-3 py-1.5 text-sm"
                  >
                    Ao vivo
                  </button>
                  <button
                    onClick={() => openFolder(cam)}
                    className="flex-1 inline-flex items-center justify-center gap-1 ring-1 ring-gray-300 rounded-md px-3 py-1.5 text-sm"
                  >
                    <MdFolder /> Pasta
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
