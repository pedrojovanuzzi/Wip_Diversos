import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { MdVideocam, MdLogout, MdAdd, MdPlayArrow, MdFolder, MdDownload, MdRefresh, MdExpandMore, MdChevronRight, MdEdit, MdDeleteSweep, MdPause, MdFiberManualRecord, MdSensors, MdSkipPrevious, MdSkipNext, MdBugReport } from "react-icons/md";
import { BsTrash } from "react-icons/bs";
import { WhepPlayer } from "./components/WhepPlayer";
import InstallPWAButton from "./components/InstallPWAButton";
import { getCamSession, getCamToken, clearCamSession } from "./cameraAuth";

interface Cam {
  id: number;
  nome: string;
  ativo: boolean;
  gravando: boolean;
  created_at: string;
}

interface RecFile {
  name: string;
  dir: string; // subpasta relativa (ex: "2026-06/08"); "" para gravações antigas
  size: number;
  mtime: string;
}

interface Storage {
  usedBytes: number;
  quotaBytes: number;
  perCameraBytes?: number;
  cameras?: { id: number; nome: string; bytes: number }[];
}

// Ferramentas de debug só aparecem quando o portal roda em localhost (dev).
const IS_LOCALHOST =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

interface DebugLog {
  state: { connected: boolean; recording: boolean; enabled: boolean };
  entries: { ts: number; type: string; msg: string }[];
}

// Rótulos e ordem dos ajustes de imagem (VideoColor). Só os que a câmera expõe.
const IMAGE_LABELS: { key: string; label: string }[] = [
  { key: "brightness", label: "Brilho" },
  { key: "contrast", label: "Contraste" },
  { key: "saturation", label: "Saturação" },
  { key: "sharpness", label: "Nitidez" },
  { key: "hue", label: "Matiz" },
];

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
  const [storageLoading, setStorageLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  // add form
  const [nome, setNome] = useState("");
  const [rtsp, setRtsp] = useState("");
  const [tipo, setTipo] = useState("intelbras"); // só Intelbras/Dahua (detecção)
  const [adding, setAdding] = useState(false);

  // editar câmera (nome, URL RTSP completa, porta HTTP)
  const [editCam, setEditCam] = useState<Cam | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", rtsp: "", httpPort: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // detecção de movimento NA CÂMERA
  interface MotionDetect {
    enable: boolean;
    recordEnable: boolean;
    recordLatch: number; // segundos gravando após o movimento (backend)
    dejitter: number; // anti-tremor da câmera: segura o evento após o movimento (s)
    sensitive: number; // 0..100 (maior = mais sensível)
    threshold: number; // 0..100 (área mínima alterada)
    region?: number[]; // 18 linhas, cada uma bitmask de 14 colunas (0..16383)
    gridRows?: number;
    gridCols?: number;
  }
  const [detectCam, setDetectCam] = useState<Cam | null>(null);
  const [detect, setDetect] = useState<MotionDetect | null>(null);
  const [detectLoading, setDetectLoading] = useState(false);
  const [detectSaving, setDetectSaving] = useState(false);
  // Ajustes de imagem (VideoColor): só os campos que a câmera expõe (0..100).
  const [image, setImage] = useState<Record<string, number>>({});
  // Editor de região: grade de células (linha × coluna) ligada/desligada.
  const GRID_ROWS = 18;
  const GRID_COLS = 14;
  const [regionGrid, setRegionGrid] = useState<boolean[][]>([]);
  const paintingRef = useRef<boolean | null>(null); // valor sendo pintado no arraste
  const [snapTs, setSnapTs] = useState(0); // cache-buster do snapshot

  // debug (só localhost): log de eventos de movimento vindos da câmera
  const [debugCam, setDebugCam] = useState<Cam | null>(null);
  const [debugLog, setDebugLog] = useState<DebugLog | null>(null);
  const [rawConfig, setRawConfig] = useState<string | null>(null);
  const [rawConfigLoading, setRawConfigLoading] = useState(false);

  // live
  const [liveCam, setLiveCam] = useState<Cam | null>(null);
  const [whepUrl, setWhepUrl] = useState<string | null>(null);

  // pasta (arquivos no disco)
  const [folderCam, setFolderCam] = useState<Cam | null>(null);
  const [files, setFiles] = useState<RecFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileVideoUrl, setFileVideoUrl] = useState<string | null>(null); // blob: URL
  const [videoLoading, setVideoLoading] = useState(false);
  const blobUrlRef = useRef<string | null>(null); // blob: atual (para revogar)
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
  const [playingKey, setPlayingKey] = useState<string | null>(null); // dir/name tocando
  const playingKeyRef = useRef<string | null>(null); // espelho de playingKey (corrida async)

  // Gravações em ordem cronológica (para a linha do tempo e o anterior/próximo).
  const filesAsc = useMemo(
    () =>
      [...files].sort(
        (a, b) => new Date(a.mtime).getTime() - new Date(b.mtime).getTime(),
      ),
    [files],
  );

  // Linha do tempo de UM dia (grupo): ordena, calcula t0..t1 e blocos de
  // atividade (segmentos com <60s de intervalo viram um bloco só, estilo Nest).
  type Timeline = {
    asc: RecFile[];
    t0: number;
    t1: number;
    span: number;
    blocks: [number, number][];
  };
  const buildTimeline = (items: RecFile[]): Timeline | null => {
    if (!items.length) return null;
    const t = (f: RecFile) => new Date(f.mtime).getTime();
    const asc = [...items].sort((a, b) => t(a) - t(b));
    const t0 = t(asc[0]);
    const t1 = t(asc[asc.length - 1]);
    const span = Math.max(1, t1 - t0);
    const GAP = 60000;
    const blocks: [number, number][] = [];
    let bs = t(asc[0]);
    let be = bs;
    for (let i = 1; i < asc.length; i++) {
      const ti = t(asc[i]);
      if (ti - be > GAP) {
        blocks.push([bs, be]);
        bs = ti;
      }
      be = ti;
    }
    blocks.push([bs, be]);
    return { asc, t0, t1, span, blocks };
  };

  // Agrupa as gravações por subpasta (dia). Pastas sem arquivo simplesmente não
  // aparecem aqui — o backend só devolve arquivos, nunca pastas vazias.
  const folderGroups = useMemo(() => {
    const map = new Map<string, RecFile[]>();
    for (const f of files) {
      const key = f.dir || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    const groups = Array.from(map.entries()).map(([dir, items]) => {
      items.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
      return {
        dir,
        items,
        totalSize: items.reduce((s, f) => s + f.size, 0),
        latest: items[0] ? new Date(items[0].mtime).getTime() : 0,
      };
    });
    groups.sort((a, b) => b.latest - a.latest); // dia mais recente primeiro
    return groups;
  }, [files]);

  // Rótulo da pasta: "2026-06/08" -> "08/06/2026". Mantém o formato cru se não casar.
  const dirLabel = (dir: string) => {
    if (!dir) return "Outras gravações";
    const m = dir.match(/(\d{4})-(\d{2})(?:\/|-)(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : dir;
  };

  const toggleDir = (dir: string) =>
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });

  // Ao carregar a lista, abre por padrão a pasta do dia mais recente. Só age
  // quando nada está aberto (não recolhe o que o usuário abriu, nem ao apagar).
  useEffect(() => {
    if (folderGroups.length) {
      setOpenDirs((prev) => (prev.size === 0 ? new Set([folderGroups[0].dir]) : prev));
    }
  }, [folderGroups]);

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
    setStorageLoading(true);
    try {
      const res = await axios.get(`${base}/cameras/storage`, {
        headers: authHeaders(),
      });
      setStorage(res.data);
    } catch (e: any) {
      handleAuthError(e); // silencioso: não bloqueia o portal por causa da barra
    } finally {
      setStorageLoading(false);
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
        { nome, rtsp_url: rtsp, tipo },
        { headers: authHeaders() },
      );
      flash(res.data.warning || "Câmera adicionada.", res.data.warning ? "err" : "ok");
      setNome("");
      setRtsp("");
      setTipo("intelbras");
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

  const toggleRecording = async (cam: Cam) => {
    const novo = !cam.gravando;
    try {
      await axios.put(
        `${base}/cameras/cameras/${cam.id}/recording`,
        { gravando: novo },
        { headers: authHeaders() },
      );
      setCams((prev) =>
        prev.map((c) => (c.id === cam.id ? { ...c, gravando: novo } : c)),
      );
      flash(novo ? "Gravação retomada." : "Gravação pausada.", "ok");
    } catch (e: any) {
      if (!handleAuthError(e)) flash("Erro ao alterar a gravação.", "err");
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
    clearVideo();
    setOpenDirs(new Set()); // reabre a pasta do dia mais recente (via useEffect)
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

  // Caminho relativo da gravação (subpasta + arquivo), com cada segmento codificado.
  const filePath = (dir: string, name: string) => {
    const sub = dir ? dir.split("/").map(encodeURIComponent).join("/") + "/" : "";
    return `${sub}${encodeURIComponent(name)}`;
  };

  // URL do arquivo (token na query, pois <video>/<a> não enviam header).
  const fileUrl = (camId: number, dir: string, name: string) =>
    `${base}/cameras/cameras/${camId}/files/${filePath(dir, name)}?token=${getCamToken()}`;

  // ---- Linha do tempo / player ----
  const segKey = (f: RecFile) => `${f.dir}/${f.name}`;

  // Fecha o player e libera o blob: atual da memória.
  const clearVideo = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setFileVideoUrl(null);
    setPlayingKey(null);
    playingKeyRef.current = null;
  }, []);

  // Libera o blob ao desmontar a página.
  useEffect(() => clearVideo, [clearVideo]);

  // Baixa a gravação INTEIRA num único GET e toca a partir da memória (blob:).
  // Assim o navegador não fatia o vídeo em dezenas de Range requests: pega o
  // arquivo completo de uma vez e o player roda sem mais idas à rede.
  const playSeg = async (f: RecFile) => {
    if (!folderCam) return;
    const key = segKey(f);
    setPlayingKey(key);
    playingKeyRef.current = key;
    setVideoLoading(true);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setFileVideoUrl(null);
    try {
      const res = await axios.get(
        `${base}/cameras/cameras/${folderCam.id}/files/${filePath(f.dir, f.name)}`,
        { headers: authHeaders(), responseType: "blob" },
      );
      // Outra gravação foi selecionada enquanto esta baixava: descarta.
      if (playingKeyRef.current !== key) return;
      const blobUrl = URL.createObjectURL(res.data as Blob);
      blobUrlRef.current = blobUrl;
      setFileVideoUrl(blobUrl);
    } catch (e: any) {
      if (playingKeyRef.current !== key) return; // já trocou: ignora erro antigo
      if (!handleAuthError(e)) flash("Erro ao carregar a gravação.", "err");
      clearVideo();
    } finally {
      if (playingKeyRef.current === key) setVideoLoading(false);
    }
  };

  // Anterior/próximo na ordem cronológica.
  const stepSeg = (dir: 1 | -1) => {
    if (!playingKey) {
      if (filesAsc.length) playSeg(dir === 1 ? filesAsc[0] : filesAsc[filesAsc.length - 1]);
      return;
    }
    const i = filesAsc.findIndex((f) => segKey(f) === playingKey);
    const ni = i + dir;
    if (ni >= 0 && ni < filesAsc.length) playSeg(filesAsc[ni]);
  };

  // Clique na barra de um dia: toca o segmento daquele dia mais próximo do instante.
  const onTimelineClick = (e: React.MouseEvent, tl: Timeline) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const target = tl.t0 + frac * tl.span;
    let best = tl.asc[0];
    let bd = Infinity;
    for (const f of tl.asc) {
      const d = Math.abs(new Date(f.mtime).getTime() - target);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    playSeg(best);
  };

  // Posição (0..1) do segmento tocando DENTRO desta barra (null se for de outro dia).
  const playingFracIn = (tl: Timeline): number | null => {
    if (!playingKey) return null;
    const f = tl.asc.find((x) => segKey(x) === playingKey);
    if (!f) return null;
    return (new Date(f.mtime).getTime() - tl.t0) / tl.span;
  };

  const fmtClock = (ms: number) =>
    new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const deleteRecording = async (f: RecFile) => {
    if (!folderCam) return;
    if (!window.confirm("Apagar esta gravação? Esta ação não pode ser desfeita.")) return;
    try {
      await axios.delete(
        `${base}/cameras/cameras/${folderCam.id}/files/${filePath(f.dir, f.name)}`,
        { headers: authHeaders() },
      );
      if (playingKey === segKey(f)) clearVideo(); // se o vídeo aberto era esse, fecha
      setFiles((prev) => prev.filter((x) => !(x.dir === f.dir && x.name === f.name)));
      loadStorage();
    } catch (e: any) {
      if (!handleAuthError(e)) flash("Erro ao apagar gravação.", "err");
    }
  };

  const openEdit = async (cam: Cam) => {
    setEditCam(cam);
    setEditForm({ nome: cam.nome, rtsp: "", httpPort: "" });
    setEditLoading(true);
    try {
      const res = await axios.get(`${base}/cameras/cameras/${cam.id}`, {
        headers: authHeaders(),
      });
      setEditForm({
        nome: res.data.nome || cam.nome,
        rtsp: res.data.rtsp_url || "",
        httpPort: res.data.http_port ? String(res.data.http_port) : "80",
      });
    } catch (e: any) {
      if (!handleAuthError(e)) flash("Erro ao carregar a câmera.", "err");
    } finally {
      setEditLoading(false);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCam) return;
    setEditSaving(true);
    try {
      await axios.put(
        `${base}/cameras/cameras/${editCam.id}`,
        {
          nome: editForm.nome,
          rtsp_url: editForm.rtsp,
          http_port: editForm.httpPort,
        },
        { headers: authHeaders() },
      );
      setEditCam(null);
      flash("Câmera atualizada.", "ok");
      await load();
    } catch (e: any) {
      if (!handleAuthError(e))
        flash(e?.response?.data?.message || "Erro ao salvar.", "err");
    } finally {
      setEditSaving(false);
    }
  };

  // ---- Detecção de movimento NA CÂMERA ----
  // região (18 ints de 14 bits) -> grade booleana [linha][coluna]
  const regionToGrid = (region?: number[]): boolean[][] =>
    Array.from({ length: GRID_ROWS }, (_, r) => {
      const v = region?.[r] ?? 0;
      return Array.from({ length: GRID_COLS }, (_, c) => ((v >> c) & 1) === 1);
    });
  // grade booleana -> região (18 ints de 14 bits)
  const gridToRegion = (grid: boolean[][]): number[] =>
    Array.from({ length: GRID_ROWS }, (_, r) => {
      let v = 0;
      for (let c = 0; c < GRID_COLS; c++) if (grid[r]?.[c]) v |= 1 << c;
      return v;
    });

  const openDetect = async (cam: Cam) => {
    setDetectCam(cam);
    setDetect(null);
    setImage({});
    setRegionGrid([]);
    setSnapTs(Date.now());
    setDetectLoading(true);
    // Ajustes de imagem (não bloqueiam o modal se falharem).
    axios
      .get(`${base}/cameras/cameras/${cam.id}/image`, { headers: authHeaders() })
      .then((r) => setImage(r.data || {}))
      .catch(() => setImage({}));
    try {
      const res = await axios.get(
        `${base}/cameras/cameras/${cam.id}/motion-detect`,
        { headers: authHeaders() },
      );
      setDetect(res.data);
      setRegionGrid(regionToGrid(res.data?.region));
    } catch (e: any) {
      if (!handleAuthError(e))
        flash(
          e?.response?.data?.message ||
            "Não foi possível conectar à câmera. Verifique o IP e a Porta HTTP em ✏️ Editar câmera.",
          "err",
        );
      setDetectCam(null);
    } finally {
      setDetectLoading(false);
    }
  };

  // Pintura da grade (clique + arraste).
  const paintCell = (r: number, c: number, value?: boolean) =>
    setRegionGrid((prev) => {
      const grid = prev.length ? prev.map((row) => row.slice()) : regionToGrid();
      const next = value ?? !grid[r][c];
      grid[r][c] = next;
      return grid;
    });
  const fillGrid = (value: boolean) =>
    setRegionGrid(
      Array.from({ length: GRID_ROWS }, () =>
        Array.from({ length: GRID_COLS }, () => value),
      ),
    );

  const saveDetect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detectCam || !detect) return;
    setDetectSaving(true);
    try {
      const region = gridToRegion(
        regionGrid.length ? regionGrid : regionToGrid(detect.region),
      );
      const res = await axios.put<{ mirroredRegion?: boolean }>(
        `${base}/cameras/cameras/${detectCam.id}/motion-detect`,
        { ...detect, region },
        { headers: authHeaders() },
      );
      // Ajustes de imagem (se houver algum campo carregado).
      if (Object.keys(image).length) {
        await axios.put(
          `${base}/cameras/cameras/${detectCam.id}/image`,
          image,
          { headers: authHeaders() },
        );
      }
      flash(
        res.data?.mirroredRegion
          ? "Salvo na câmera (região aplicada às 4 janelas)."
          : "Detecção de movimento salva na câmera.",
        "ok",
      );
      setDetectCam(null);
    } catch (e: any) {
      if (!handleAuthError(e))
        flash(e?.response?.data?.message || "A câmera recusou.", "err");
    } finally {
      setDetectSaving(false);
    }
  };

  // ---- Debug (localhost): log de eventos de movimento vindos da câmera ----
  const openDebug = (cam: Cam) => {
    setDebugCam(cam);
    setDebugLog(null);
    setRawConfig(null);
  };

  // Lê a config MotionDetect crua da câmera (pra inspecionar o Region).
  const loadRawConfig = async () => {
    if (!debugCam) return;
    setRawConfigLoading(true);
    try {
      const res = await axios.get<{ status: number; raw: string }>(
        `${base}/cameras/cameras/${debugCam.id}/motion-config-raw`,
        { headers: authHeaders() },
      );
      setRawConfig(res.data.raw || "(vazio)");
    } catch (e: any) {
      if (!handleAuthError(e))
        setRawConfig("Erro ao ler a config da câmera.");
    } finally {
      setRawConfigLoading(false);
    }
  };

  // Enquanto o painel está aberto, busca o log a cada 1,5s.
  useEffect(() => {
    if (!debugCam) return;
    let alive = true;
    const fetchLog = async () => {
      try {
        const res = await axios.get<DebugLog>(
          `${base}/cameras/cameras/${debugCam.id}/motion-debug`,
          { headers: authHeaders() },
        );
        if (alive) setDebugLog(res.data);
      } catch {
        /* mantém o último log enquanto reconecta */
      }
    };
    fetchLog();
    const t = setInterval(fetchLog, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [debugCam, base, authHeaders]);

  const clearFolder = async (dir: string, count: number) => {
    if (!folderCam || !dir) return;
    if (!window.confirm(`Apagar TODAS as ${count} gravações de ${dirLabel(dir)}?`))
      return;
    try {
      const sub = dir.split("/").map(encodeURIComponent).join("/");
      await axios.delete(`${base}/cameras/cameras/${folderCam.id}/folder/${sub}`, {
        headers: authHeaders(),
      });
      if (fileVideoUrl) clearVideo();
      setFiles((prev) => prev.filter((x) => x.dir !== dir));
      loadStorage();
    } catch (e: any) {
      if (!handleAuthError(e)) flash("Erro ao limpar a pasta.", "err");
    }
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  };

  const fmtGB = (bytes: number) => (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";

  // Adaptativo: MB abaixo de 1 GB, senão GB (para o uso por câmera).
  const fmtUsage = (bytes: number) =>
    bytes < 1024 * 1024 * 1024
      ? (bytes / 1024 / 1024).toFixed(0) + " MB"
      : (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";

  // Uso/limite de armazenamento de uma câmera (fatia da cota do cliente).
  const camStorage = (id?: number) => {
    const limit = storage?.perCameraBytes ?? storage?.quotaBytes ?? 0;
    const used = storage?.cameras?.find((c) => c.id === id)?.bytes ?? 0;
    const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
    return { used, limit, pct };
  };

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
              <div className="flex items-center gap-2">
                <span className="text-gray-500">
                  {fmtGB(storage.usedBytes)} de {fmtGB(storage.quotaBytes)}
                </span>
                <button
                  onClick={loadStorage}
                  disabled={storageLoading}
                  title="Atualizar uso de armazenamento"
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 disabled:text-gray-400"
                >
                  <MdRefresh className={storageLoading ? "animate-spin" : ""} />
                  Atualizar
                </button>
              </div>
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
          className="bg-white ring-1 ring-gray-200 rounded-lg p-4 mb-6 grid gap-3 sm:grid-cols-[1fr_auto_2fr_auto] items-end"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full ring-1 ring-gray-300 rounded-md px-3 py-2 text-sm bg-white"
              title="Marcas com suporte à detecção de movimento"
            >
              <option value="intelbras">Intelbras</option>
              <option value="dahua">Dahua</option>
            </select>
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

            {videoLoading && !fileVideoUrl && (
              <div className="w-full aspect-video bg-black rounded-md mb-3 flex items-center justify-center text-sm text-gray-300">
                Baixando gravação…
              </div>
            )}

            {fileVideoUrl && (
              <video
                key={fileVideoUrl}
                src={fileVideoUrl}
                controls
                autoPlay
                onEnded={() => stepSeg(1)} // emenda no próximo momento
                onError={() => {
                  flash(
                    "Gravação indisponível — pode ter sido removida pela limpeza por movimento.",
                    "err",
                  );
                  clearVideo();
                  if (folderCam) openFolder(folderCam); // recarrega a lista
                }}
                className="w-full aspect-video bg-black rounded-md mb-3"
              />
            )}

            {/* Controles de navegação entre momentos (anterior/próximo) */}
            {fileVideoUrl && (
              <div className="flex items-center justify-center gap-4 mb-4 text-sm">
                <button
                  onClick={() => stepSeg(-1)}
                  className="inline-flex items-center gap-1 text-gray-600 hover:text-indigo-700"
                >
                  <MdSkipPrevious /> Anterior
                </button>
                <span className="text-gray-500">
                  {playingKey
                    ? new Date(
                        filesAsc.find((f) => segKey(f) === playingKey)?.mtime || 0,
                      ).toLocaleString()
                    : ""}
                </span>
                <button
                  onClick={() => stepSeg(1)}
                  className="inline-flex items-center gap-1 text-gray-600 hover:text-indigo-700"
                >
                  Próximo <MdSkipNext />
                </button>
              </div>
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
              <div className="space-y-2 max-h-96 overflow-auto">
                {folderGroups.map((g) => {
                  const open = openDirs.has(g.dir);
                  return (
                    <div key={g.dir || "_outras"} className="ring-1 ring-gray-200 rounded-md">
                      <div className="flex items-center px-3 py-2 text-sm hover:bg-gray-50">
                        <button
                          onClick={() => toggleDir(g.dir)}
                          className="flex-1 flex items-center justify-between gap-2 min-w-0"
                        >
                          <span className="flex items-center gap-2 font-medium text-gray-700 min-w-0">
                            {open ? <MdExpandMore /> : <MdChevronRight />}
                            <MdFolder className="text-indigo-600" />
                            {dirLabel(g.dir)}
                          </span>
                          <span className="text-gray-400 text-xs shrink-0">
                            {g.items.length}{" "}
                            {g.items.length === 1 ? "gravação" : "gravações"} ·{" "}
                            {fmtSize(g.totalSize)}
                          </span>
                        </button>
                        {g.dir && (
                          <button
                            onClick={() => clearFolder(g.dir, g.items.length)}
                            title="Limpar pasta (apaga todas as gravações do dia)"
                            className="ml-3 inline-flex items-center gap-1 text-red-500 hover:text-red-700 shrink-0"
                          >
                            <MdDeleteSweep /> Limpar
                          </button>
                        )}
                      </div>
                      {open && (() => {
                        const tl = buildTimeline(g.items);
                        return (
                          <div className="border-t">
                            {/* Linha do tempo deste dia (clique para reproduzir) */}
                            {tl && (
                              <div className="px-3 py-3 border-b">
                                <div
                                  onClick={(e) => onTimelineClick(e, tl)}
                                  title="Clique para reproduzir a partir deste horário"
                                  className="relative h-8 bg-gray-100 rounded cursor-pointer overflow-hidden"
                                >
                                  {tl.blocks.map(([s, e2], i) => (
                                    <div
                                      key={i}
                                      className="absolute top-1 bottom-1 bg-indigo-500/70 rounded-sm"
                                      style={{
                                        left: `${((s - tl.t0) / tl.span) * 100}%`,
                                        width: `${Math.max(0.4, ((e2 - s) / tl.span) * 100)}%`,
                                      }}
                                    />
                                  ))}
                                  {playingFracIn(tl) != null && (
                                    <div
                                      className="absolute top-0 bottom-0 w-0.5 bg-red-600"
                                      style={{ left: `${playingFracIn(tl)! * 100}%` }}
                                    />
                                  )}
                                </div>
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                  <span>{fmtClock(tl.t0)}</span>
                                  <span>{fmtClock(tl.t1)}</span>
                                </div>
                              </div>
                            )}
                            <ul className="divide-y">
                              {g.items.map((f) => (
                                <li
                                  key={`${f.dir}/${f.name}`}
                                  className="flex items-center justify-between py-2 px-3 text-sm gap-2"
                                >
                              <div className="min-w-0">
                                <p className="truncate font-medium">{f.name}</p>
                                <p className="text-gray-400 text-xs">
                                  {new Date(f.mtime).toLocaleString()} · {fmtSize(f.size)}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <button
                                  onClick={() => playSeg(f)}
                                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                                >
                                  <MdPlayArrow /> Ver
                                </button>
                                <a
                                  href={fileUrl(folderCam.id, f.dir, f.name)}
                                  download={f.name}
                                  className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                                >
                                  <MdDownload /> Baixar
                                </a>
                                <button
                                  onClick={() => deleteRecording(f)}
                                  className="inline-flex items-center gap-1 text-red-500 hover:text-red-700"
                                >
                                  <BsTrash /> Excluir
                                </button>
                              </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
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
                  <h3 className="font-semibold flex items-center gap-2">
                    <span
                      title={cam.gravando ? "Gravando" : "Gravação pausada"}
                      className={`inline-block w-2 h-2 rounded-full ${
                        cam.gravando ? "bg-red-500" : "bg-gray-300"
                      }`}
                    />
                    {cam.nome}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openDetect(cam)}
                      className="text-gray-500 hover:text-emerald-600"
                      title="Detecção de movimento (na câmera)"
                    >
                      <MdSensors />
                    </button>
                    {IS_LOCALHOST && (
                      <button
                        onClick={() => openDebug(cam)}
                        className="text-gray-500 hover:text-amber-600"
                        title="Debug — eventos de movimento (localhost)"
                      >
                        <MdBugReport />
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(cam)}
                      className="text-gray-500 hover:text-indigo-600"
                      title="Editar (nome, IP, porta)"
                    >
                      <MdEdit />
                    </button>
                    <button
                      onClick={() => removeCamera(cam.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Remover"
                    >
                      <BsTrash />
                    </button>
                  </div>
                </div>

                {/* Armazenamento desta câmera (uso x fatia da cota) */}
                {storage && (() => {
                  const { used, limit, pct } = camStorage(cam.id);
                  return (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Armazenamento</span>
                        <span>
                          {fmtUsage(used)} de {fmtGB(limit)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            pct >= 95 ? "bg-red-500" : "bg-indigo-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

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
                <button
                  onClick={() => toggleRecording(cam)}
                  className={`mt-2 inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm ring-1 ${
                    cam.gravando
                      ? "ring-gray-300 text-gray-700 hover:bg-gray-50"
                      : "ring-red-300 text-red-600 bg-red-50 hover:bg-red-100"
                  }`}
                >
                  {cam.gravando ? (
                    <>
                      <MdPause /> Pausar gravação
                    </>
                  ) : (
                    <>
                      <MdFiberManualRecord /> Retomar gravação
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal: editar câmera (nome, IP, porta) */}
      {editCam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !editSaving && setEditCam(null)}
        >
          <form
            onSubmit={saveEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-lg p-5 space-y-4"
          >
            <h2 className="font-semibold flex items-center gap-2 text-gray-800">
              <MdEdit className="text-indigo-600" /> Editar câmera
            </h2>

            {editLoading ? (
              <p className="flex items-center gap-2 text-gray-500 py-6 justify-center">
                <AiOutlineLoading3Quarters className="animate-spin" /> Carregando...
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    value={editForm.nome}
                    onChange={(e) => setEditForm((s) => ({ ...s, nome: e.target.value }))}
                    required
                    className="w-full ring-1 ring-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL RTSP
                  </label>
                  <input
                    value={editForm.rtsp}
                    onChange={(e) => setEditForm((s) => ({ ...s, rtsp: e.target.value }))}
                    required
                    placeholder="rtsp://usuario:senha@ip:554/stream"
                    className="w-full ring-1 ring-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Porta HTTP
                  </label>
                  <input
                    value={editForm.httpPort}
                    onChange={(e) => setEditForm((s) => ({ ...s, httpPort: e.target.value }))}
                    inputMode="numeric"
                    placeholder="80"
                    className="w-full ring-1 ring-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  A URL inclui usuário, senha, IP, porta RTSP e caminho do stream. A
                  Porta HTTP é a da interface/eventos da câmera (padrão 80; mude se
                  usar port-forward).
                </p>
              </>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setEditCam(null)}
                disabled={editSaving}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editSaving || editLoading}
                className="bg-indigo-600 disabled:bg-gray-300 text-white rounded-md px-4 py-2 text-sm"
              >
                {editSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: detecção de movimento NA CÂMERA */}
      {detectCam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !detectSaving && setDetectCam(null)}
        >
          <form
            onSubmit={saveDetect}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="font-semibold flex items-center gap-2 text-gray-800">
              <MdSensors className="text-emerald-600" /> Detecção de movimento —{" "}
              {detectCam.nome}
            </h2>
            <p className="text-sm text-gray-500">
              A detecção é feita pela própria câmera. Marque abaixo a área a
              vigiar e ajuste a sensibilidade.
            </p>

            {detectLoading || !detect ? (
              <p className="flex items-center gap-2 text-gray-500 py-6 justify-center">
                <AiOutlineLoading3Quarters className="animate-spin" /> Carregando da câmera...
              </p>
            ) : (
              <>
                <label className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">Detecção ativada</span>
                  <input
                    type="checkbox"
                    checked={detect.enable}
                    onChange={(e) =>
                      setDetect({ ...detect, enable: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                </label>

                <label className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">Gravar ao detectar</span>
                  <input
                    type="checkbox"
                    checked={detect.recordEnable}
                    onChange={(e) =>
                      setDetect({ ...detect, recordEnable: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                </label>

                <div>
                  <label className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">Sensibilidade</span>
                    <span className="text-gray-400">{detect.sensitive}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={detect.sensitive}
                    onChange={(e) =>
                      setDetect({ ...detect, sensitive: Number(e.target.value) })
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400">Maior = detecta movimentos menores.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Limiar (área)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={detect.threshold}
                      onChange={(e) =>
                        setDetect({ ...detect, threshold: Number(e.target.value) })
                      }
                      className="w-full ring-1 ring-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gravar após (s)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={600}
                      value={detect.recordLatch}
                      onChange={(e) =>
                        setDetect({ ...detect, recordLatch: Number(e.target.value) })
                      }
                      className="w-full ring-1 ring-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Tempo que segue gravando após o movimento parar.{" "}
                      <b>0 = para na hora.</b>
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Anti-tremor (s)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={detect.dejitter}
                    onChange={(e) =>
                      setDetect({ ...detect, dejitter: Number(e.target.value) })
                    }
                    className="w-full ring-1 ring-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Quanto a câmera segura o evento ativo DEPOIS que o movimento
                    para (estica o clipe). <b>Recomendado: 1–2.</b>
                  </p>
                </div>

                {/* Imagem (VideoColor): só os campos que a câmera expõe. */}
                {Object.keys(image).length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Imagem</p>
                    <div className="space-y-2">
                      {IMAGE_LABELS.filter((f) => image[f.key] !== undefined).map(
                        (f) => (
                          <div key={f.key}>
                            <label className="flex items-center justify-between text-sm mb-0.5">
                              <span className="text-gray-700">{f.label}</span>
                              <span className="text-gray-400">{image[f.key]}</span>
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={image[f.key]}
                              onChange={(e) =>
                                setImage((s) => ({
                                  ...s,
                                  [f.key]: Number(e.target.value),
                                }))
                              }
                              className="w-full"
                            />
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* Editor de região: clique/arraste sobre a imagem para marcar
                    onde detectar. Verde = detecta; vazio = ignora. */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">
                      Área de detecção
                    </span>
                    <span className="flex gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => fillGrid(true)}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        Tudo
                      </button>
                      <button
                        type="button"
                        onClick={() => fillGrid(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        Limpar
                      </button>
                      <button
                        type="button"
                        onClick={() => setSnapTs(Date.now())}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        Atualizar imagem
                      </button>
                    </span>
                  </div>
                  <div
                    className="relative w-full aspect-video bg-black rounded-md overflow-hidden select-none"
                    onMouseLeave={() => (paintingRef.current = null)}
                    onMouseUp={() => (paintingRef.current = null)}
                  >
                    <img
                      src={`${base}/cameras/cameras/${detectCam.id}/snapshot?token=${getCamToken()}&t=${snapTs}`}
                      alt="snapshot"
                      draggable={false}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    />
                    <div
                      className="absolute inset-0 grid"
                      style={{
                        gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                        gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
                      }}
                    >
                      {Array.from({ length: GRID_ROWS }).map((_, r) =>
                        Array.from({ length: GRID_COLS }).map((__, c) => {
                          const on = regionGrid[r]?.[c];
                          return (
                            <div
                              key={`${r}-${c}`}
                              onMouseDown={() => {
                                const v = !regionGrid[r]?.[c];
                                paintingRef.current = v;
                                paintCell(r, c, v);
                              }}
                              onMouseEnter={() => {
                                if (paintingRef.current !== null)
                                  paintCell(r, c, paintingRef.current);
                              }}
                              className={`border border-white/10 cursor-pointer ${
                                on ? "bg-emerald-500/40" : "hover:bg-white/10"
                              }`}
                            />
                          );
                        }),
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Clique e arraste para marcar a área. A mesma área vale para as
                    4 janelas da câmera.
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDetectCam(null)}
                disabled={detectSaving}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={detectSaving || detectLoading || !detect}
                className="bg-emerald-600 disabled:bg-gray-300 text-white rounded-md px-4 py-2 text-sm"
              >
                {detectSaving ? "Salvando..." : "Salvar na câmera"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Painel de DEBUG (só localhost): eventos de movimento vindos da câmera */}
      {debugCam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDebugCam(null)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <MdBugReport className="text-amber-600" /> Debug — {debugCam.nome}
              </h3>
              <button
                onClick={() => setDebugCam(null)}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                Fechar
              </button>
            </div>

            {/* Estado atual da conexão/gravação */}
            <div className="flex flex-wrap gap-2 px-5 py-3 border-b text-xs">
              {[
                {
                  on: debugLog?.state.connected,
                  yes: "Conectada à câmera",
                  no: "Sem conexão",
                },
                {
                  on: debugLog?.state.enabled,
                  yes: "Gravação por movimento ativa",
                  no: "Gravação por movimento pausada",
                },
                {
                  on: debugLog?.state.recording,
                  yes: "Gravando agora",
                  no: "Parada",
                },
              ].map((b, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
                    b.on ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      b.on ? "bg-emerald-500" : "bg-gray-400"
                    }`}
                  />
                  {b.on ? b.yes : b.no}
                </span>
              ))}
            </div>

            {/* Config crua da câmera (inspecionar o Region) */}
            <div className="px-5 py-2 border-b">
              <button
                onClick={loadRawConfig}
                disabled={rawConfigLoading}
                className="text-xs text-amber-700 hover:text-amber-900 underline disabled:opacity-50"
              >
                {rawConfigLoading
                  ? "Lendo config da câmera…"
                  : "Ver config crua (MotionDetect / Region)"}
              </button>
              {rawConfig && (
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all bg-gray-900 text-gray-100 rounded p-2 text-[11px] leading-snug">
                  {rawConfig}
                </pre>
              )}
            </div>

            {/* Log */}
            <div className="flex-1 overflow-y-auto px-5 py-3 font-mono text-xs leading-relaxed bg-gray-50">
              {!debugLog ? (
                <div className="text-gray-400">Carregando…</div>
              ) : debugLog.entries.length === 0 ? (
                <div className="text-gray-400">
                  Nenhum evento ainda. Gere movimento na frente da câmera para ver
                  os eventos aparecerem aqui (atualiza a cada 1,5s).
                </div>
              ) : (
                debugLog.entries
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <div
                      key={i}
                      className={`py-0.5 ${
                        e.type === "error"
                          ? "text-red-600"
                          : e.type === "raw"
                          ? "text-teal-700"
                          : e.type === "motion"
                          ? "text-gray-900"
                          : e.type === "record"
                          ? "text-indigo-700"
                          : "text-gray-500"
                      }`}
                    >
                      <span className="text-gray-400">
                        {new Date(e.ts).toLocaleTimeString()}
                      </span>
                      {e.type === "raw" ? (
                        // Payload exato da câmera (pode ser JSON multi-linha).
                        <pre className="mt-0.5 whitespace-pre-wrap break-all bg-white/60 rounded px-2 py-1 ring-1 ring-teal-100">
                          {e.msg}
                        </pre>
                      ) : (
                        <span> {e.msg}</span>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
