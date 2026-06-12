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
 * (5 GB), gerido de forma HÍBRIDA — cada câmera tem uma RESERVA garantida
 * (suas gravações mais recentes) que nunca é apagada, e o excedente mais antigo
 * de todas vira um POOL compartilhado podado por idade. Assim nenhuma câmera é
 * zerada E o espaço livre das câmeras quietas é aproveitado pelas movimentadas.
 */

// Pasta no host onde o MediaMTX grava (mesmo valor usado em Camera.ts).
const RECORDINGS_PATH =
  process.env.MEDIAMTX_RECORDINGS_PATH ||
  "/var/lib/docker/volumes/backend_mediamtx_recordings/_data";

// Cota fixa por cliente: 5 GB (provisório). Constante pública (sem .env).
export const STORAGE_QUOTA_GB = 5;
export const STORAGE_QUOTA_BYTES = STORAGE_QUOTA_GB * 1024 * 1024 * 1024;

// Fração da fatia igual (cota/Nº de câmeras) que cada câmera tem GARANTIDA para
// suas gravações mais recentes (reserva). O resto é um pool compartilhado.
const RESERVE_FRACTION = 0.5;

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
    reserveBytes: number;
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
      // Mínimo garantido por câmera (reserva do modelo híbrido).
      reserveBytes: this.reserveBytes(cameras.length),
      cameras: detalhe,
    };
  }

  /** Bytes reservados (garantidos) por câmera = fração da fatia igual. */
  private reserveBytes(cameraCount: number): number {
    if (cameraCount <= 0) return STORAGE_QUOTA_BYTES;
    return Math.floor(
      (STORAGE_QUOTA_BYTES / cameraCount) * RESERVE_FRACTION,
    );
  }

  /**
   * Garante a cota do cliente com modelo HÍBRIDO:
   *  - Cada câmera tem uma RESERVA (suas gravações mais recentes, até
   *    `reserveBytes`) que nunca é apagada → nenhuma câmera é zerada.
   *  - O excedente (mais antigo) de TODAS as câmeras forma um POOL
   *    compartilhado, podado do mais antigo quando o total passa da cota →
   *    a câmera movimentada aproveita o espaço que as quietas não usam.
   * Retorna quantos bytes foram liberados no total.
   */
  public async enforceQuotaForCliente(cid: number): Promise<number> {
    const repo = AppDataSource.getRepository(Camera);
    const cameras = await repo.find({ where: { cliente_id: cid } });
    if (!cameras.length) return 0;

    const reserve = this.reserveBytes(cameras.length);
    let totalUsed = 0;
    const deletable: SegmentFile[] = []; // excedente fora da reserva (pool)

    for (const cam of cameras) {
      const segs = listSegmentFiles(this.camDir(cam.path_name)).sort(
        (a, b) => b.mtimeMs - a.mtimeMs, // mais NOVO primeiro
      );
      let protectedSize = 0;
      for (const seg of segs) {
        totalUsed += seg.size;
        if (protectedSize < reserve) {
          protectedSize += seg.size; // protege as gravações recentes da câmera
        } else {
          deletable.push(seg); // o resto (mais antigo) vai pro pool compartilhado
        }
      }
    }

    if (totalUsed <= STORAGE_QUOTA_BYTES) return 0;

    deletable.sort((a, b) => a.mtimeMs - b.mtimeMs); // mais antigo primeiro (global)

    let freed = 0;
    for (const seg of deletable) {
      if (totalUsed <= STORAGE_QUOTA_BYTES) break;
      try {
        fs.rmSync(seg.fullPath, { force: true });
        totalUsed -= seg.size;
        freed += seg.size;
      } catch (e: any) {
        console.error("enforceQuota: falha ao apagar", seg.fullPath, e?.message);
      }
    }

    if (freed > 0) {
      console.log(
        `🗄️  Cota de câmeras: cliente ${cid} (${cameras.length} câmera(s), ` +
          `reserva ${(reserve / 1024 / 1024 / 1024).toFixed(2)} GB cada + pool) — ` +
          `liberados ${(freed / 1024 / 1024).toFixed(1)} MB.`,
      );
    }
    return freed;
  }
}

export default new CameraStorageService();
