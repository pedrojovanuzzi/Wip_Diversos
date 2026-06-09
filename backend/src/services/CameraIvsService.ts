import http from "http";
import crypto from "crypto";
import dotenv from "dotenv";
import AppDataSource from "../database/DataSource";
import { Camera } from "../entities/Camera";
import MediaMtxService from "./MediaMtxService";
import { CAMERA_HTTP_PORT } from "./CameraHttp";

dotenv.config();

/**
 * Gravação DISPARADA POR MOVIMENTO (event-triggered).
 *
 * Para cada câmera ativa, mantém uma conexão HTTP persistente em
 * /cgi-bin/eventManager.cgi?action=attach (Digest) e recebe VideoMotion
 * Start/Stop em tempo real. Enquanto há movimento, LIGA a gravação no MediaMTX;
 * quando para, mantém gravando por mais alguns segundos (latch) e desliga.
 *
 * Nada é decodificado nem apagado — o MediaMTX simplesmente só grava nos
 * períodos com movimento. O "gravando" (pausar/retomar) é o interruptor mestre:
 * pausado, a gravação não liga nem com movimento.
 */

const RECONNECT_MS = 5000;
// Tempo que continua gravando DEPOIS que o movimento para (o "rabo").
const RECORD_LATCH_MS = 8000;
const EVENT_CODES = "VideoMotion";

const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");

/** Extrai host/usuário/senha de uma URL rtsp://user:pass@host:porta/... */
function parseRtspCreds(
  url: string,
): { host: string; user: string; pass: string } | null {
  const m = url.match(/^rtsps?:\/\/(?:([^@/]+)@)?([^:/?#]+)/i);
  if (!m) return null;
  const host = m[2];
  let user = "";
  let pass = "";
  if (m[1]) {
    const idx = m[1].indexOf(":");
    user = idx >= 0 ? m[1].slice(0, idx) : m[1];
    pass = idx >= 0 ? m[1].slice(idx + 1) : "";
  }
  return { host, user, pass };
}

interface CamConn {
  pathName: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  enabled: boolean; // interruptor mestre (= camera.gravando)
  recording: boolean; // estado atual da gravação no MediaMTX
  req?: http.ClientRequest;
  stopTimer?: NodeJS.Timeout; // desligar a gravação após o latch
  reconnectTimer?: NodeJS.Timeout;
  stopped: boolean;
}

class CameraIvsService {
  private conns = new Map<string, CamConn>();

  // ---------------- controle de gravação ----------------
  private async setRecord(conn: CamConn, on: boolean): Promise<void> {
    if (conn.recording === on) return;
    conn.recording = on;
    try {
      await MediaMtxService.setRecord(conn.pathName, on);
    } catch (e: any) {
      console.error(`CameraIvs: falha ao alternar gravação de ${conn.pathName}:`, e?.message);
      conn.recording = !on; // reverte o estado para tentar de novo depois
    }
  }

  private onMotionStart(conn: CamConn): void {
    if (conn.stopTimer) {
      clearTimeout(conn.stopTimer);
      conn.stopTimer = undefined;
    }
    if (conn.enabled) void this.setRecord(conn, true);
  }

  private onMotionStop(conn: CamConn): void {
    if (conn.stopTimer) clearTimeout(conn.stopTimer);
    conn.stopTimer = setTimeout(() => {
      conn.stopTimer = undefined;
      void this.setRecord(conn, false);
    }, RECORD_LATCH_MS);
  }

  // ---------------- ciclo de vida ----------------
  public async startAll(): Promise<void> {
    try {
      const repo = AppDataSource.getRepository(Camera);
      const cameras = await repo.find({ where: { ativo: true } });
      for (const cam of cameras) this.startCamera(cam);
      if (cameras.length) {
        console.log(
          `📡 Gravação por movimento: escutando ${cameras.length} câmera(s).`,
        );
      }
    } catch (e: any) {
      console.error("CameraIvs: falha no startAll:", e?.message);
    }
  }

  public startCamera(cam: Camera): void {
    if (!cam?.path_name || !cam.rtsp_url) return;
    this.stopCamera(cam.path_name);
    const creds = parseRtspCreds(cam.rtsp_url);
    if (!creds) {
      console.error(`CameraIvs: URL inválida para ${cam.path_name}`);
      return;
    }
    const conn: CamConn = {
      pathName: cam.path_name,
      host: creds.host,
      port: cam.http_port || CAMERA_HTTP_PORT,
      user: creds.user,
      pass: creds.pass,
      enabled: cam.gravando !== false,
      recording: false,
      stopped: false,
    };
    this.conns.set(cam.path_name, conn);
    this.connect(conn);
  }

  public stopCamera(pathName: string): void {
    const conn = this.conns.get(pathName);
    if (!conn) return;
    conn.stopped = true;
    if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
    if (conn.stopTimer) clearTimeout(conn.stopTimer);
    try {
      conn.req?.destroy();
    } catch {
      /* noop */
    }
    this.conns.delete(pathName);
  }

  /** Liga/desliga o interruptor mestre (pausar/retomar gravação). */
  public setEnabled(pathName: string, enabled: boolean): void {
    const conn = this.conns.get(pathName);
    if (!conn) return;
    conn.enabled = enabled;
    if (!enabled) {
      // Pausado: cancela qualquer latch e desliga a gravação agora.
      if (conn.stopTimer) {
        clearTimeout(conn.stopTimer);
        conn.stopTimer = undefined;
      }
      void this.setRecord(conn, false);
    }
    // Se reativado, não liga agora — espera o próximo movimento.
  }

  // ---------------- conexão de eventos (Digest, stream) ----------------
  private scheduleReconnect(conn: CamConn): void {
    if (conn.stopped || conn.reconnectTimer) return;
    conn.reconnectTimer = setTimeout(() => {
      conn.reconnectTimer = undefined;
      this.connect(conn);
    }, RECONNECT_MS);
  }

  private uri(): string {
    return `/cgi-bin/eventManager.cgi?action=attach&codes=%5B${encodeURIComponent(
      EVENT_CODES,
    )}%5D`;
  }

  private connect(conn: CamConn): void {
    if (conn.stopped) return;
    const opts = { host: conn.host, port: conn.port, path: this.uri() };

    const challenge = http.get(opts, (res) => {
      if (res.statusCode !== 401) {
        res.resume();
        this.scheduleReconnect(conn);
        return;
      }
      const c = this.parseChallenge(res.headers["www-authenticate"] || "");
      res.resume();
      if (!c.nonce || !c.realm) {
        this.scheduleReconnect(conn);
        return;
      }
      const auth = this.digestHeader(conn, c);
      const stream = http.get(
        { ...opts, headers: { Authorization: auth } },
        (r2) => {
          if (r2.statusCode !== 200) {
            r2.resume();
            this.scheduleReconnect(conn);
            return;
          }
          let buf = "";
          r2.setEncoding("utf8");
          r2.on("data", (d: string) => {
            buf += d;
            let i: number;
            while ((i = buf.indexOf("\n")) >= 0) {
              this.handleLine(conn, buf.slice(0, i));
              buf = buf.slice(i + 1);
            }
            if (buf.length > 8192) buf = buf.slice(-1024);
          });
          r2.on("end", () => this.scheduleReconnect(conn));
          r2.on("close", () => this.scheduleReconnect(conn));
          r2.on("error", () => this.scheduleReconnect(conn));
        },
      );
      stream.on("error", () => this.scheduleReconnect(conn));
      conn.req = stream;
    });
    challenge.on("error", () => this.scheduleReconnect(conn));
  }

  private parseChallenge(h: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const m of h.matchAll(/(\w+)="?([^",]+)"?/g)) out[m[1]] = m[2];
    return out;
  }

  private digestHeader(conn: CamConn, c: Record<string, string>): string {
    const uri = this.uri();
    const cnonce = crypto.randomBytes(8).toString("hex");
    const nc = "00000001";
    const qop = c.qop || "auth";
    const ha1 = md5(`${conn.user}:${c.realm}:${conn.pass}`);
    const ha2 = md5(`GET:${uri}`);
    const response = md5(`${ha1}:${c.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    return (
      `Digest username="${conn.user}", realm="${c.realm}", nonce="${c.nonce}", ` +
      `uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", ` +
      `response="${response}"` + (c.opaque ? `, opaque="${c.opaque}"` : "")
    );
  }

  private handleLine(conn: CamConn, line: string): void {
    const m = line.match(/Code=VideoMotion;action=(\w+)/);
    if (!m) return;
    const action = m[1];
    if (action === "Start") this.onMotionStart(conn);
    else if (action === "Stop") this.onMotionStop(conn);
    else if (action === "Pulse") {
      // momentâneo: liga e agenda o desligamento após o latch
      this.onMotionStart(conn);
      this.onMotionStop(conn);
    }
  }
}

export default new CameraIvsService();
