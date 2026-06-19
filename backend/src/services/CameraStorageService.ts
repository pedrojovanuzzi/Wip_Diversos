import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import AppDataSource from "../database/DataSource";
import { Camera } from "../entities/Camera";
import { CameraCliente } from "../entities/CameraCliente";
import { DEFAULT_STORAGE_GB } from "../config/cameraStoragePlans";
import RemoteStorage from "./CameraRemoteStorageService";

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

const GB = 1024 * 1024 * 1024;

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

  /** Cota do cliente (bytes) a partir do plano salvo em camera_clientes.storage_gb. */
  private async quotaBytesForCliente(cid: number): Promise<number> {
    const repo = AppDataSource.getRepository(CameraCliente);
    const cliente = await repo.findOne({ where: { id: cid } });
    const gb = cliente?.storage_gb || DEFAULT_STORAGE_GB;
    return gb * GB;
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
    const quotaBytes = await this.quotaBytesForCliente(cid);

    // Remoto: uma ÚNICA conexão calcula o total por câmera no servidor (antes
    // era uma conexão por câmera + baixar a lista inteira só pra somar).
    const remoteUsage = RemoteStorage.isEnabled()
      ? await RemoteStorage.usageByCamera(cameras.map((c) => c.path_name))
      : null;

    let usedBytes = 0;
    const detalhe = cameras.map((cam) => {
      const bytes = remoteUsage
        ? remoteUsage.get(cam.path_name) ?? 0
        : listSegmentFiles(this.camDir(cam.path_name)).reduce(
            (acc, f) => acc + f.size,
            0,
          );
      usedBytes += bytes;
      return { id: cam.id!, nome: cam.nome, bytes };
    });

    return {
      usedBytes,
      quotaBytes,
      // Mínimo garantido por câmera (reserva do modelo híbrido).
      reserveBytes: this.reserveBytes(cameras.length, quotaBytes),
      cameras: detalhe,
    };
  }

  /** Bytes reservados (garantidos) por câmera = fração da fatia igual. */
  private reserveBytes(cameraCount: number, quotaBytes: number): number {
    if (cameraCount <= 0) return quotaBytes;
    return Math.floor((quotaBytes / cameraCount) * RESERVE_FRACTION);
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

    const remote = RemoteStorage.isEnabled();
    const quotaBytes = await this.quotaBytesForCliente(cid);
    const reserve = this.reserveBytes(cameras.length, quotaBytes);
    let totalUsed = 0;
    // Excedente fora da reserva (pool). `ref` = como apagar: caminho local OU
    // (pathName, rel) no servidor remoto.
    const deletable: {
      size: number;
      mtimeMs: number;
      fullPath?: string;
      pathName?: string;
      rel?: string;
    }[] = [];

    for (const cam of cameras) {
      const segs = remote
        ? (await RemoteStorage.listSegments(cam.path_name)).map((s) => ({
            size: s.size,
            mtimeMs: s.mtimeMs,
            pathName: cam.path_name,
            rel: s.rel,
          }))
        : listSegmentFiles(this.camDir(cam.path_name)).map((s) => ({
            size: s.size,
            mtimeMs: s.mtimeMs,
            fullPath: s.fullPath,
          }));
      segs.sort((a, b) => b.mtimeMs - a.mtimeMs); // mais NOVO primeiro
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

    if (totalUsed <= quotaBytes) return 0;

    deletable.sort((a, b) => a.mtimeMs - b.mtimeMs); // mais antigo primeiro (global)

    // Seleciona, do mais antigo, o que precisa sair para voltar à cota.
    const toDelete: typeof deletable = [];
    for (const seg of deletable) {
      if (totalUsed <= quotaBytes) break;
      toDelete.push(seg);
      totalUsed -= seg.size;
    }

    let freed = 0;
    if (remote) {
      // Agrupa por câmera para apagar em lote numa conexão por câmera.
      const byCam = new Map<string, { rel: string; size: number }[]>();
      for (const seg of toDelete) {
        const arr = byCam.get(seg.pathName!) ?? [];
        arr.push({ rel: seg.rel!, size: seg.size });
        byCam.set(seg.pathName!, arr);
      }
      for (const [pathName, segs] of byCam) {
        try {
          freed += await RemoteStorage.deleteSegments(pathName, segs);
        } catch (e: any) {
          console.error("enforceQuota (remoto): falha ao apagar", pathName, e?.message);
        }
      }
    } else {
      for (const seg of toDelete) {
        try {
          fs.rmSync(seg.fullPath!, { force: true });
          freed += seg.size;
        } catch (e: any) {
          console.error("enforceQuota: falha ao apagar", seg.fullPath, e?.message);
        }
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

  /**
   * Apaga as gravações MAIS ANTIGAS de UMA câmera até liberar ~`targetBytes`.
   * Vai do mais antigo para o mais novo e para assim que atinge o alvo (não
   * apaga mais do que o pedido). Opera no servidor remoto quando ligado, senão
   * no disco local. Retorna quanto foi liberado e quantos arquivos saíram.
   */
  public async deleteOldestBytesForCamera(
    pathName: string,
    targetBytes: number,
  ): Promise<{ freedBytes: number; deletedCount: number }> {
    if (targetBytes <= 0) return { freedBytes: 0, deletedCount: 0 };

    if (RemoteStorage.isEnabled()) {
      const segs = (await RemoteStorage.listSegments(pathName)).sort(
        (a, b) => a.mtimeMs - b.mtimeMs, // mais ANTIGO primeiro
      );
      const toDelete: { rel: string; size: number }[] = [];
      let planned = 0;
      for (const s of segs) {
        if (planned >= targetBytes) break;
        toDelete.push({ rel: s.rel, size: s.size });
        planned += s.size;
      }
      const freedBytes = await RemoteStorage.deleteSegments(pathName, toDelete);
      return { freedBytes, deletedCount: toDelete.length };
    }

    const segs = listSegmentFiles(this.camDir(pathName)).sort(
      (a, b) => a.mtimeMs - b.mtimeMs, // mais ANTIGO primeiro
    );
    let freedBytes = 0;
    let deletedCount = 0;
    for (const seg of segs) {
      if (freedBytes >= targetBytes) break;
      try {
        fs.rmSync(seg.fullPath, { force: true });
        freedBytes += seg.size;
        deletedCount++;
      } catch (e: any) {
        console.error("deleteOldestBytes: falha ao apagar", seg.fullPath, e?.message);
      }
    }
    return { freedBytes, deletedCount };
  }

  /**
   * Aplica a cota de TODOS os clientes que têm câmeras. Usado por uma varredura
   * periódica para manter o storage remoto limitado mesmo que ninguém abra a
   * tela de armazenamento (antes, a retenção por tempo era feita pelo MediaMTX
   * no disco local — que agora é apenas staging).
   */
  public async enforceQuotaAll(): Promise<void> {
    const repo = AppDataSource.getRepository(Camera);
    const rows = await repo
      .createQueryBuilder("c")
      .select("DISTINCT c.cliente_id", "cid")
      .getRawMany<{ cid: number }>();
    for (const { cid } of rows) {
      try {
        await this.enforceQuotaForCliente(cid);
      } catch (e: any) {
        console.error("enforceQuotaAll: cliente", cid, e?.message);
      }
    }
  }
}

export default new CameraStorageService();
