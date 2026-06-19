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

export interface RemoteSegment {
  /** Caminho relativo à pasta da câmera, ex: "2026-06/08/14-43-19-000000.mp4". */
  rel: string;
  size: number;
  mtimeMs: number;
}

/** Aspas simples seguras para POSIX (escapa aspas simples internas). */
function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

// Forma mínima do client ssh2 (exposto por ssh2-sftp-client em `.client`) usada
// só para o `exec` da listagem — evita depender de @types/ssh2.
interface SshExecStream {
  on(event: "close", cb: (code: number | null) => void): SshExecStream;
  on(event: "data", cb: (d: Buffer) => void): SshExecStream;
  stderr: { on(event: "data", cb: (d: Buffer) => void): unknown };
}
interface SshClient {
  exec(cmd: string, cb: (err: Error | undefined, stream: SshExecStream) => void): void;
}

class CameraRemoteStorageService {
  /** O offload/leitura remota só agem se houver servidor configurado. */
  public isEnabled(): boolean {
    return Boolean(HOST && USER && BASE);
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
    const client = new SftpClient();
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

  /** Roda um comando no servidor remoto e devolve {code, stdout, stderr}. */
  private exec(
    c: SftpClient,
    cmd: string,
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    const ssh = (c as unknown as { client: SshClient }).client;
    return new Promise((resolve, reject) => {
      ssh.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        let stdout = "";
        let stderr = "";
        stream
          .on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }))
          .on("data", (d) => (stdout += d.toString()))
          .stderr.on("data", (d) => (stderr += d.toString()));
      });
    });
  }

  /**
   * Lista recursivamente os .mp4 da pasta de uma câmera (rel + size + mtime).
   *
   * Usa UM `find` no servidor em vez de um `list` SFTP por pasta: a árvore
   * inteira volta em um único round-trip, o que evita dezenas de idas-e-voltas
   * por câmera (e as rajadas de conexão que isso causava). Requer `find` do GNU
   * (`-printf`) no servidor de storage. Campos: %s=tamanho, %T@=mtime em
   * segundos.fração, %P=caminho relativo à base. O rel vai por ÚLTIMO por ser o
   * único campo que poderia conter espaços.
   */
  public async listSegments(pathName: string): Promise<RemoteSegment[]> {
    const base = this.remotePath(pathName);
    return this.withClient(async (c) => {
      const cmd =
        `find ${shQuote(base)} -type f -name '*.mp4' ` + `-printf '%s\\t%T@\\t%P\\n'`;
      const { code, stdout, stderr } = await this.exec(c, cmd);
      if (code !== 0) {
        // Pasta inexistente (câmera nova/sem gravação) → lista vazia, como antes.
        // Outro erro real é logado, mas não derruba o caller (uso/cota seguem).
        if (stderr.trim() && !/No such file or directory/i.test(stderr)) {
          console.error("listSegments (find):", pathName, stderr.trim());
        }
        return [];
      }
      const out: RemoteSegment[] = [];
      for (const line of stdout.split("\n")) {
        if (!line) continue;
        const tab1 = line.indexOf("\t");
        const tab2 = line.indexOf("\t", tab1 + 1);
        if (tab1 < 0 || tab2 < 0) continue;
        const size = Number(line.slice(0, tab1));
        const mtime = Number(line.slice(tab1 + 1, tab2)); // segundos (com fração)
        const rel = line.slice(tab2 + 1);
        if (!rel || !Number.isFinite(size) || !Number.isFinite(mtime)) continue;
        out.push({ rel, size, mtimeMs: Math.round(mtime * 1000) });
      }
      return out;
    });
  }

  /**
   * Faz streaming do arquivo remoto para um Writable (ex.: res do Express),
   * resolvendo o TAMANHO na MESMA conexão — assim o playback abre apenas UM
   * handshake SSH (antes eram dois: um só pro `stat` e outro pro envio), o que
   * reduzia muito o tempo até o primeiro byte. `onSize` é chamado antes de
   * começar a enviar (use para setar o Content-Length). Retorna false se o
   * arquivo não existir.
   */
  public async streamTo(
    pathName: string,
    rel: string,
    dst: Writable,
    onSize?: (size: number) => void,
  ): Promise<boolean> {
    return this.withClient(async (c) => {
      const remote = this.remotePath(pathName, rel);
      let size = -1;
      try {
        size = (await c.stat(remote)).size;
      } catch {
        return false; // não existe / sem permissão
      }
      if (size < 0) return false;
      onSize?.(size);
      await c.get(remote, dst);
      return true;
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
