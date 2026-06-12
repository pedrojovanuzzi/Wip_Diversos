import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import AppDataSource from "../database/DataSource";
import { Camera } from "../entities/Camera";

dotenv.config();

/**
 * Cota de armazenamento de gravações por cliente-câmera.
 *
 * O MediaMTX grava 24/7 e só faz retenção por TEMPO (recordDeleteAfter). Aqui
 * complementamos com retenção por TAMANHO: cada cliente tem um limite fixo
 * (5 GB), dividido em FATIAS IGUAIS entre as câmeras (5 GB / nº de câmeras).
 * Cada câmera só poda as PRÓPRIAS gravações ao passar da sua fatia — assim uma
 * câmera movimentada não consome todo o espaço e zera o histórico das outras.
 */

// Pasta no host onde o MediaMTX grava (mesmo valor usado em Camera.ts).
const RECORDINGS_PATH =
  process.env.MEDIAMTX_RECORDINGS_PATH ||
  "/var/lib/docker/volumes/backend_mediamtx_recordings/_data";

// Cota fixa por cliente: 5 GB (provisório). Constante pública (sem .env).
export const STORAGE_QUOTA_GB = 5;
export const STORAGE_QUOTA_BYTES = STORAGE_QUOTA_GB * 1024 * 1024 * 1024;

interface SegmentFile {
  fullPath: string;
  size: number;
  mtimeMs: number;
}

/** Lista recursivamente os arquivos .mp4 de uma pasta de câmera (com tamanho e mtime). */
function listSegmentFiles(dir: string): SegmentFile[] {
  const out: SegmentFile[] = [];
  if (!dir.startsWith(RECORDINGS_PATH)) return out;
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSegmentFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".mp4")) {
      try {
        const st = fs.statSync(full);
        out.push({ fullPath: full, size: st.size, mtimeMs: st.mtimeMs });
      } catch {
        /* arquivo removido entre o readdir e o stat — ignora */
      }
    }
  }
  return out;
}

class CameraStorageService {
  /** Diretório de gravações de uma câmera. */
  private camDir(pathName: string): string {
    return path.join(RECORDINGS_PATH, pathName);
  }

  /**
   * Uso em disco de um cliente (soma de todas as suas câmeras), em bytes,
   * mais o detalhamento por câmera.
   */
  public async getClienteUsage(cid: number): Promise<{
    usedBytes: number;
    quotaBytes: number;
    cameras: { id: number; nome: string; bytes: number }[];
  }> {
    const repo = AppDataSource.getRepository(Camera);
    const cameras = await repo.find({ where: { cliente_id: cid } });

    let usedBytes = 0;
    const detalhe = cameras.map((cam) => {
      const bytes = listSegmentFiles(this.camDir(cam.path_name)).reduce(
        (acc, f) => acc + f.size,
        0,
      );
      usedBytes += bytes;
      return { id: cam.id!, nome: cam.nome, bytes };
    });

    return {
      usedBytes,
      quotaBytes: STORAGE_QUOTA_BYTES,
      cameras: detalhe,
    };
  }

  /**
   * Garante que o cliente esteja dentro da cota, com FATIA JUSTA por câmera:
   * a cota total é dividida igualmente entre as câmeras e cada câmera só pode
   * exceder a SUA fatia. Assim uma câmera que grava muito não consome todo o
   * espaço e zera as gravações das outras — cada câmera mantém seu próprio
   * rodízio (apaga o mais antigo dela ao passar da fatia).
   * Retorna quantos bytes foram liberados no total.
   */
  public async enforceQuotaForCliente(cid: number): Promise<number> {
    const repo = AppDataSource.getRepository(Camera);
    const cameras = await repo.find({ where: { cliente_id: cid } });
    if (!cameras.length) return 0;

    const perCameraQuota = Math.floor(STORAGE_QUOTA_BYTES / cameras.length);
    let freed = 0;

    for (const cam of cameras) {
      const segments = listSegmentFiles(this.camDir(cam.path_name)).sort(
        (a, b) => a.mtimeMs - b.mtimeMs, // mais antigo primeiro
      );
      let used = segments.reduce((acc, f) => acc + f.size, 0);
      if (used <= perCameraQuota) continue;

      for (const seg of segments) {
        if (used <= perCameraQuota) break;
        try {
          fs.rmSync(seg.fullPath, { force: true });
          used -= seg.size;
          freed += seg.size;
        } catch (e: any) {
          console.error("enforceQuota: falha ao apagar", seg.fullPath, e?.message);
        }
      }
    }

    if (freed > 0) {
      console.log(
        `🗄️  Cota de câmeras: cliente ${cid} (${cameras.length} câmera(s), ` +
          `${(perCameraQuota / 1024 / 1024 / 1024).toFixed(2)} GB cada) — ` +
          `liberados ${(freed / 1024 / 1024).toFixed(1)} MB.`,
      );
    }
    return freed;
  }
}

export default new CameraStorageService();
