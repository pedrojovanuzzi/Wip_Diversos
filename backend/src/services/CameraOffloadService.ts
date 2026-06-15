import fs from "fs";
import path from "path";
import chokidar, { FSWatcher } from "chokidar";
import dotenv from "dotenv";
import remote from "./CameraRemoteStorageService";
import CameraStorageService from "./CameraStorageService";

dotenv.config();

/**
 * Move as gravações para o servidor remoto e libera o disco local.
 *
 * O MediaMTX grava os segmentos .mp4 em RECORDINGS_PATH (staging). Este serviço
 * observa a pasta; quando um segmento é FINALIZADO (o MediaMTX para de escrever),
 * ele é enviado por SFTP para o servidor remoto e, após verificação de tamanho,
 * apagado localmente. Assim o disco local nunca acumula gravações.
 *
 * - Ligado apenas se CAMERA_STORAGE_HOST estiver configurado (ver CameraRemoteStorageService).
 * - `ignoreInitial: false`: ao iniciar, também envia o que tiver ficado para trás
 *   (ex.: arquivos acumulados durante uma queda do backend).
 * - `awaitWriteFinish`: só dispara quando o tamanho do arquivo estabiliza, então
 *   não enviamos um segmento ainda sendo escrito.
 * - Uma varredura periódica reprocessa o que tenha falhado (rede caiu etc.).
 */

const RECORDINGS_PATH =
  process.env.MEDIAMTX_RECORDINGS_PATH ||
  "/var/lib/docker/volumes/backend_mediamtx_recordings/_data";

// Quantos uploads simultâneos no máximo (cada um abre sua conexão SFTP).
const MAX_CONCURRENT = 3;
// Reprocessa arquivos que sobraram no disco a cada 5 min (rede de volta etc.).
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
// Idade mínima para o sweep considerar um arquivo "parado" (não sendo escrito).
const SWEEP_MIN_AGE_MS = 90 * 1000;
// Aplica a cota (5 GB/cliente) no remoto periodicamente, mantendo-o limitado
// mesmo sem ninguém abrir a tela de armazenamento.
const QUOTA_INTERVAL_MS = 30 * 60 * 1000;

class CameraOffloadService {
  private watcher: FSWatcher | null = null;
  private sweepTimer: NodeJS.Timeout | null = null;
  private quotaTimer: NodeJS.Timeout | null = null;
  private inFlight = new Set<string>(); // arquivos em processamento (anti-duplicação)
  private active = 0; // uploads correndo agora
  private queue: string[] = []; // fila de localPaths aguardando vaga

  public start(): void {
    if (!remote.isEnabled()) {
      console.log("📦 Offload de gravações desligado (CAMERA_STORAGE_HOST vazio).");
      return;
    }
    if (this.watcher) return;

    fs.mkdirSync(RECORDINGS_PATH, { recursive: true });

    this.watcher = chokidar.watch(RECORDINGS_PATH, {
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 10000, pollInterval: 2000 },
      // Só nos interessam os .mp4 (ignora arquivos temporários do MediaMTX).
      ignored: (p: string) => {
        // Ignora se for arquivo e não terminar em .mp4.
        return /\.[^/\\]+$/.test(p) && !p.endsWith(".mp4");
      },
    });

    this.watcher
      .on("add", (p) => this.enqueue(p))
      .on("error", (e) => console.error("offload watcher:", (e as Error)?.message));

    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    if (this.sweepTimer.unref) this.sweepTimer.unref();

    this.quotaTimer = setInterval(() => {
      CameraStorageService.enforceQuotaAll().catch((e) =>
        console.error("offload quota:", e?.message),
      );
    }, QUOTA_INTERVAL_MS);
    if (this.quotaTimer.unref) this.quotaTimer.unref();

    console.log(`📦 Offload de gravações ATIVO: ${RECORDINGS_PATH} → ${remote.remotePath("")}`);
  }

  public async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    if (this.quotaTimer) {
      clearInterval(this.quotaTimer);
      this.quotaTimer = null;
    }
  }

  /** Enfileira um arquivo para upload, respeitando o limite de concorrência. */
  private enqueue(localPath: string): void {
    if (!localPath.endsWith(".mp4")) return;
    if (this.inFlight.has(localPath)) return;
    this.inFlight.add(localPath);
    this.queue.push(localPath);
    this.pump();
  }

  private pump(): void {
    while (this.active < MAX_CONCURRENT && this.queue.length) {
      const localPath = this.queue.shift()!;
      this.active++;
      this.offload(localPath)
        .catch((e) => console.error("offload:", localPath, e?.message))
        .finally(() => {
          this.active--;
          this.inFlight.delete(localPath);
          this.pump();
        });
    }
  }

  /** Envia um segmento para o remoto e, se confirmado, apaga o local. */
  private async offload(localPath: string): Promise<void> {
    let local: fs.Stats;
    try {
      local = fs.statSync(localPath);
    } catch {
      return; // sumiu antes da hora — nada a fazer
    }
    if (!local.isFile() || local.size === 0) return;

    // rel relativo à pasta da câmera: <path_name>/<...>/arquivo.mp4
    const relFull = path
      .relative(RECORDINGS_PATH, localPath)
      .replace(/\\/g, "/");
    const slash = relFull.indexOf("/");
    if (slash < 0) return; // arquivo solto na raiz, sem câmera — ignora
    const pathName = relFull.slice(0, slash);
    const rel = relFull.slice(slash + 1);

    await remote.upload(localPath, pathName, rel);

    // Verifica que o tamanho remoto bate antes de apagar o local.
    const remoteSize = await remote.size(pathName, rel);
    if (remoteSize !== local.size) {
      throw new Error(
        `tamanho divergente (local=${local.size}, remoto=${remoteSize}) — mantém local`,
      );
    }

    try {
      fs.rmSync(localPath, { force: true });
      this.pruneEmptyDirs(path.dirname(localPath));
    } catch (e: any) {
      console.error("offload: falha ao remover local", localPath, e?.message);
    }
  }

  /** Sobe removendo pastas locais vazias até RECORDINGS_PATH (sem ultrapassá-lo). */
  private pruneEmptyDirs(dir: string): void {
    const base = path.resolve(RECORDINGS_PATH);
    let cur = path.resolve(dir);
    while (cur !== base && cur.startsWith(base + path.sep)) {
      try {
        if (fs.readdirSync(cur).length > 0) break;
        fs.rmdirSync(cur);
      } catch {
        break;
      }
      cur = path.dirname(cur);
    }
  }

  /** Reenfileira .mp4 que sobraram no disco (uploads que falharam antes). */
  private sweep(): void {
    const now = Date.now();
    const walk = (dir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.isFile() && e.name.endsWith(".mp4")) {
          try {
            // Só os "parados" (não sendo escritos) para não competir com o MediaMTX.
            if (now - fs.statSync(full).mtimeMs >= SWEEP_MIN_AGE_MS) this.enqueue(full);
          } catch {
            /* ignora */
          }
        }
      }
    };
    walk(RECORDINGS_PATH);
  }
}

export default new CameraOffloadService();
