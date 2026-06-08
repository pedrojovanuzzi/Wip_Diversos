import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import AppDataSource from "../database/DataSource";
import { Camera } from "../entities/Camera";

dotenv.config();

/**
 * Poda de gravações por detecção de movimento.
 *
 * O MediaMTX grava continuamente em segmentos curtos (recordSegmentDuration).
 * Aqui complementamos: a cada ciclo analisamos os segmentos .mp4 já FINALIZADOS
 * com o ffmpeg (detecção de mudança de cena) e APAGAMOS os que não têm movimento.
 * Resultado: o disco guarda apenas os trechos com movimento.
 *
 * O backend roda no host (npm start) e lê a pasta de gravações via bind mount,
 * então o ffmpeg do host é usado diretamente — o backend não decodifica vídeo
 * em outro lugar.
 */

// Pasta no host onde o MediaMTX grava (mesmo valor usado em Camera.ts).
const RECORDINGS_PATH =
  process.env.MEDIAMTX_RECORDINGS_PATH ||
  "/var/lib/docker/volumes/backend_mediamtx_recordings/_data";

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";

// Liga/desliga a poda por movimento (default: ligado).
const ENABLED =
  (process.env.CAMERA_MOTION_PRUNE_ENABLED ?? "true").toLowerCase() !== "false";

// Sensibilidade: pontuação de mudança de cena (0..1). Quanto menor, mais sensível.
const SCENE_THRESHOLD = Number(process.env.CAMERA_MOTION_SCENE_THRESHOLD || 0.1);

// Quantos frames acima do limiar bastam para considerar que houve movimento.
const MIN_MOTION_FRAMES = Math.max(
  1,
  Number(process.env.CAMERA_MOTION_MIN_FRAMES || 1),
);

// Só analisa segmentos cujo mtime já passou desta janela — evita pegar o
// segmento que o MediaMTX ainda está escrevendo.
const SETTLE_MS =
  Number(process.env.CAMERA_MOTION_SETTLE_SECONDS || 120) * 1000;

// fps reduzido para a análise (decodifica menos frames = menos CPU).
const ANALYZE_FPS = Number(process.env.CAMERA_MOTION_ANALYZE_FPS || 2);

// Cursor por câmera (último mtime já analisado), para não reprocessar.
const STATE_FILE = path.join(RECORDINGS_PATH, ".motion-state.json");

interface MotionState {
  [pathName: string]: number; // último mtimeMs processado
}

class CameraMotionService {
  private running = false;

  private readState(): MotionState {
    try {
      if (!fs.existsSync(STATE_FILE)) return {};
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as MotionState;
    } catch {
      return {};
    }
  }

  private writeState(state: MotionState): void {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(state), "utf8");
    } catch (e: any) {
      console.error("CameraMotion: falha ao salvar estado:", e?.message);
    }
  }

  /**
   * Conta quantos frames de um segmento ultrapassam o limiar de mudança de cena.
   * Retorna -1 se o ffmpeg falhar (nesse caso o chamador mantém o arquivo).
   */
  private analyzeSegment(file: string): Promise<number> {
    return new Promise((resolve) => {
      // Reduz fps e resolução antes de medir a cena: menos decodificação.
      // A vírgula dentro de gt(scene,...) precisa ser escapada (\,) para não
      // ser lida como separador de filtros do filtergraph.
      const vf =
        `fps=${ANALYZE_FPS},scale=320:-2,` +
        `select=gt(scene\\,${SCENE_THRESHOLD}),metadata=print`;
      const args = [
        "-hide_banner",
        "-nostats",
        "-threads",
        "1",
        "-i",
        file,
        "-an",
        "-vf",
        vf,
        "-f",
        "null",
        "-",
      ];

      let buf = "";
      let failed = false;
      const proc = spawn(FFMPEG_PATH, args);
      proc.stderr.on("data", (d: Buffer) => {
        buf += d.toString();
      });
      proc.on("error", () => {
        failed = true;
        resolve(-1);
      });
      proc.on("close", () => {
        if (failed) return;
        // metadata=print imprime uma linha "lavfi.scene_score=..." por frame
        // que passou pelo select (ou seja, acima do limiar).
        const matches = buf.match(/lavfi\.scene_score/g);
        resolve(matches ? matches.length : 0);
      });
    });
  }

  /** Poda os segmentos de uma câmera. Atualiza o cursor em `state`. */
  private async pruneCamera(
    pathName: string,
    state: MotionState,
  ): Promise<{ deleted: number; freed: number }> {
    const result = { deleted: 0, freed: 0 };
    if (!pathName) return result;

    const dir = path.join(RECORDINGS_PATH, pathName);
    if (!dir.startsWith(RECORDINGS_PATH)) return result;
    if (!fs.existsSync(dir)) return result;

    const now = Date.now();
    const last = state[pathName] || 0;
    let maxProcessed = last;

    // As gravações ficam em subpastas por dia (recordPath: %path/%Y-%m-%d/...).
    // Coleta os .mp4 recursivamente; ainda lê os antigos, gravados sem subpasta.
    const collect = (d: string): { full: string; size: number; mtimeMs: number }[] => {
      const acc: { full: string; size: number; mtimeMs: number }[] = [];
      let dirents: fs.Dirent[];
      try {
        dirents = fs.readdirSync(d, { withFileTypes: true });
      } catch {
        return acc;
      }
      for (const e of dirents) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) {
          acc.push(...collect(full));
        } else if (e.isFile() && e.name.endsWith(".mp4")) {
          try {
            const st = fs.statSync(full);
            acc.push({ full, size: st.size, mtimeMs: st.mtimeMs });
          } catch {
            /* removido entre o readdir e o stat — ignora */
          }
        }
      }
      return acc;
    };

    // Mais antigo primeiro, para o cursor avançar de forma monotônica.
    const files = collect(dir).sort((a, b) => a.mtimeMs - b.mtimeMs);

    for (const f of files) {
      if (f.mtimeMs <= last) continue; // já analisado
      if (f.mtimeMs > now - SETTLE_MS) continue; // recente demais (pode estar gravando)

      const motion = await this.analyzeSegment(f.full);
      if (motion < 0) {
        // ffmpeg falhou: mantém o arquivo e salva o progresso até aqui para
        // tentar este segmento de novo no próximo ciclo.
        state[pathName] = maxProcessed;
        return result;
      }

      if (motion < MIN_MOTION_FRAMES) {
        try {
          fs.rmSync(f.full, { force: true });
          result.deleted++;
          result.freed += f.size;
        } catch (e: any) {
          console.error("CameraMotion: falha ao apagar", f.full, e?.message);
        }
      }

      if (f.mtimeMs > maxProcessed) maxProcessed = f.mtimeMs;
    }

    state[pathName] = maxProcessed;
    return result;
  }

  /** Analisa e poda as gravações de todas as câmeras. Seguro contra sobreposição. */
  public async pruneAll(): Promise<void> {
    if (!ENABLED) return;
    if (this.running) return;
    this.running = true;
    try {
      const repo = AppDataSource.getRepository(Camera);
      const cameras = await repo.find();

      const state = this.readState();
      let totalDeleted = 0;
      let totalFreed = 0;

      for (const cam of cameras) {
        const r = await this.pruneCamera(cam.path_name, state);
        totalDeleted += r.deleted;
        totalFreed += r.freed;
      }

      this.writeState(state);

      if (totalDeleted > 0) {
        console.log(
          `🎥 Poda por movimento: ${totalDeleted} segmento(s) sem movimento ` +
            `removido(s) (${(totalFreed / 1024 / 1024).toFixed(1)} MB liberados).`,
        );
      }
    } catch (e: any) {
      console.error("CameraMotion: falha na poda:", e?.message);
    } finally {
      this.running = false;
    }
  }
}

export default new CameraMotionService();
