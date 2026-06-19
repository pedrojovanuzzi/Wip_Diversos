import path from "path";
import { Writable } from "stream";
import SftpClient from "ssh2-sftp-client";
import dotenv from "dotenv";

dotenv.config();

/**
 * Armazenamento REMOTO das gravações de câmeras (servidor de storage via SFTP).
 *
 * Estratégia (ver CameraOffloadService): o MediaMTX grava o segmento .mp4 no
 * disco local (staging); assim que o arquivo é finalizado, ele é enviado para
 * este servidor remoto e apagado localmente. A partir daí o servidor remoto é
 * a FONTE DA VERDADE — listagem, download (playback), exclusão e cota passam a
 * operar aqui.
 *
 * Config no .env: CAMERA_STORAGE_HOST / PORT / USER / PASSWORD / PATH.
 * Se CAMERA_STORAGE_HOST estiver vazio, o recurso fica DESLIGADO e o sistema
 * continua usando o disco local (comportamento antigo) — útil em dev local.
 */

const HOST = process.env.CAMERA_STORAGE_HOST || "";
const PORT = Number(process.env.CAMERA_STORAGE_PORT || 22);
const USER = process.env.CAMERA_STORAGE_USER || "";
const PASSWORD = process.env.CAMERA_STORAGE_PASSWORD || "";
// Base remota onde a árvore de gravações é espelhada (mesmo layout do local:
// <base>/<path_name>/<YYYY-MM>/<DD>/<arquivo>.mp4).
const BASE = (process.env.CAMERA_STORAGE_PATH || "").replace(/\/+$/, "");
// Teto GLOBAL de conexões SFTP simultâneas. O modelo é "uma conexão curta por
// operação" (ver withClient), mas vários callers podem disparar em rajada ao
// mesmo tempo: até MAX_CONCURRENT uploads do offload + um Promise.all por
// câmera ao abrir a tela de armazenamento + a varredura de cota. Sem teto, uma
// rajada (ex.: cliente com 15 câmeras) abre 15+ handshakes de uma vez e o sshd
// derruba os excedentes antes do handshake (MaxStartups, padrão 10:30:100),
// gerando "Connection lost before handshake" / timeouts. Mantemos 5 (< 10) para
// ficar folgado abaixo do limite de conexões não autenticadas do servidor.
const MAX_CONNECTIONS = Math.max(1, Number(process.env.CAMERA_STORAGE_MAX_CONNECTIONS || 5));

export interface RemoteSegment {
  /** Caminho relativo à pasta da câmera, ex: "2026-06/08/14-43-19-000000.mp4". */
  rel: string;
  size: number;
  mtimeMs: number;
}

class CameraRemoteStorageService {
  // Semáforo global de conexões: quantas vagas restam e a fila de quem espera.
  private slots = MAX_CONNECTIONS;
  private waiters: (() => void)[] = [];

  /** O offload/leitura remota só agem se houver servidor configurado. */
  public isEnabled(): boolean {
    return Boolean(HOST && USER && BASE);
  }

  /** Reserva uma vaga de conexão (espera em FIFO se todas estiverem ocupadas). */
  private acquire(): Promise<void> {
    if (this.slots > 0) {
      this.slots--;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /** Libera uma vaga, passando-a ao próximo da fila (se houver) sem abrir folga. */
  private release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.slots++;
  }

  private config(): SftpClient.ConnectOptions {
    return {
      host: HOST,
      port: PORT,
      username: USER,
      password: PASSWORD,
      // Reconexão/keepalive ajudam em uploads longos e redes instáveis.
      keepaliveInterval: 15000,
      readyTimeout: 20000,
    };
  }

  /** Caminho remoto absoluto (POSIX) da pasta de uma câmera + rel opcional. */
  public remotePath(pathName: string, rel = ""): string {
    const parts = [BASE, pathName, rel].filter(Boolean);
    return parts.join("/").replace(/\\/g, "/").replace(/\/+/g, "/");
  }

  /**
   * Abre uma conexão dedicada, executa `fn` e fecha. Conexões curtas evitam
   * estado compartilhado bugado e permitem uploads/downloads concorrentes
   * (cada operação tem a sua). O custo do handshake é irrelevante para o
   * volume do CFTV (1 segmento/min por câmera).
   */
  private async withClient<T>(fn: (c: SftpClient) => Promise<T>): Promise<T> {
    // Espera uma vaga ANTES do handshake e só a devolve após fechar, de modo que
    // nunca existam mais de MAX_CONNECTIONS sockets SFTP abertos ao mesmo tempo.
    await this.acquire();
    const client = new SftpClient();
    try {
      await client.connect(this.config());
      try {
        return await fn(client);
      } finally {
        try {
          await client.end();
        } catch {
          /* ignora erro ao encerrar */
        }
      }
    } finally {
      this.release();
    }
  }

  /** Envia um arquivo local para o remoto (cria as pastas remotas se preciso). */
  public async upload(localPath: string, pathName: string, rel: string): Promise<void> {
    const remoteFile = this.remotePath(pathName, rel);
    const remoteDir = remoteFile.slice(0, remoteFile.lastIndexOf("/"));
    await this.withClient(async (c) => {
      if (!(await c.exists(remoteDir))) {
        await c.mkdir(remoteDir, true);
      }
      await c.fastPut(localPath, remoteFile);
    });
  }

  /** Tamanho do arquivo remoto (bytes) ou -1 se não existir. */
  public async size(pathName: string, rel: string): Promise<number> {
    return this.withClient(async (c) => {
      try {
        const st = await c.stat(this.remotePath(pathName, rel));
        return st.size;
      } catch {
        return -1;
      }
    });
  }

  /** Lista recursivamente os .mp4 da pasta de uma câmera (rel + size + mtime). */
  public async listSegments(pathName: string): Promise<RemoteSegment[]> {
    const base = this.remotePath(pathName);
    return this.withClient(async (c) => {
      const out: RemoteSegment[] = [];
      const walk = async (dir: string, rel: string) => {
        let entries: SftpClient.FileInfo[];
        try {
          entries = await c.list(dir);
        } catch {
          return; // pasta inexistente/sem permissão — ignora
        }
        for (const e of entries) {
          const childRel = rel ? `${rel}/${e.name}` : e.name;
          if (e.type === "d") {
            await walk(`${dir}/${e.name}`, childRel);
          } else if (e.type === "-" && e.name.endsWith(".mp4")) {
            out.push({ rel: childRel, size: e.size, mtimeMs: e.modifyTime });
          }
        }
      };
      if (await c.exists(base)) await walk(base, "");
      return out;
    });
  }

  /**
   * Faz streaming do arquivo remoto para um Writable (ex.: res do Express).
   * Resolve quando termina o envio. Lança se o arquivo não existir.
   */
  public async pipeTo(pathName: string, rel: string, dst: Writable): Promise<void> {
    await this.withClient(async (c) => {
      await c.get(this.remotePath(pathName, rel), dst);
    });
  }

  /** Existe o arquivo remoto? */
  public async exists(pathName: string, rel: string): Promise<boolean> {
    return this.withClient(async (c) => Boolean(await c.exists(this.remotePath(pathName, rel))));
  }

  /** Apaga um arquivo remoto e poda as pastas-pai que ficarem vazias. */
  public async deleteFile(pathName: string, rel: string): Promise<void> {
    await this.withClient(async (c) => {
      const file = this.remotePath(pathName, rel);
      if (await c.exists(file)) await c.delete(file);
      await this.pruneEmptyDirs(c, pathName, path.posix.dirname(rel));
    });
  }

  /** Apaga uma subpasta remota inteira (ex.: um dia) e poda os pais vazios. */
  public async deleteDir(pathName: string, rel: string): Promise<void> {
    await this.withClient(async (c) => {
      const dir = this.remotePath(pathName, rel);
      if (await c.exists(dir)) await c.rmdir(dir, true);
      await this.pruneEmptyDirs(c, pathName, path.posix.dirname(rel));
    });
  }

  /** Apaga a pasta inteira de uma câmera (ao remover a câmera). */
  public async deleteCamera(pathName: string): Promise<void> {
    await this.withClient(async (c) => {
      const dir = this.remotePath(pathName);
      if (await c.exists(dir)) await c.rmdir(dir, true);
    });
  }

  /**
   * Apaga vários segmentos numa única conexão (usado pela cota). Retorna a soma
   * dos bytes de quem realmente apagou.
   */
  public async deleteSegments(
    pathName: string,
    segs: { rel: string; size: number }[],
  ): Promise<number> {
    if (!segs.length) return 0;
    return this.withClient(async (c) => {
      let freed = 0;
      const dirs = new Set<string>();
      for (const s of segs) {
        try {
          await c.delete(this.remotePath(pathName, s.rel));
          freed += s.size;
          dirs.add(path.posix.dirname(s.rel));
        } catch {
          /* arquivo já removido — ignora */
        }
      }
      for (const d of dirs) await this.pruneEmptyDirs(c, pathName, d);
      return freed;
    });
  }

  /** Sobe removendo pastas vazias até a raiz da câmera (sem ultrapassá-la). */
  private async pruneEmptyDirs(
    c: SftpClient,
    pathName: string,
    relDir: string,
  ): Promise<void> {
    let rel = relDir;
    while (rel && rel !== "." && rel !== "/") {
      const dir = this.remotePath(pathName, rel);
      try {
        if (!(await c.exists(dir))) break;
        const entries = await c.list(dir);
        if (entries.length > 0) break;
        await c.rmdir(dir, false);
      } catch {
        break;
      }
      rel = path.posix.dirname(rel);
    }
  }
}

export default new CameraRemoteStorageService();
