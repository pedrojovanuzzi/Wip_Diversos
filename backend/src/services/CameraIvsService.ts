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
  connected: boolean; // stream de eventos da câmera aberto (200)
  req?: http.ClientRequest;
  stopTimer?: NodeJS.Timeout; // desligar a gravação após o latch
  reconnectTimer?: NodeJS.Timeout;
  stopped: boolean;
}

/** Uma linha do log de debug (movimento/conexão/gravação) de uma câmera. */
interface DebugEntry {
  ts: number;
  type: "raw" | "motion" | "record" | "conn" | "error";
  msg: string;
}
const DEBUG_MAX = 500; // linhas mantidas por câmera (ring buffer)

class CameraIvsService {
  private conns = new Map<string, CamConn>();
  // Log de debug por câmera (sobrevive a reconexões enquanto o processo vive).
  private debugLogs = new Map<string, DebugEntry[]>();

  // ---------------- log de debug ----------------
  private pushDebug(pathName: string, type: DebugEntry["type"], msg: string): void {
    let arr = this.debugLogs.get(pathName);
    if (!arr) {
      arr = [];
      this.debugLogs.set(pathName, arr);
    }
    arr.push({ ts: Date.now(), type, msg });
    if (arr.length > DEBUG_MAX) arr.splice(0, arr.length - DEBUG_MAX);
  }

  /** Snapshot do estado + linhas de debug de uma câmera (para o painel de debug). */
  public getDebug(pathName: string): {
    state: { connected: boolean; recording: boolean; enabled: boolean };
    entries: DebugEntry[];
  } {
    const conn = this.conns.get(pathName);
    return {
      state: {
        connected: conn?.connected ?? false,
        recording: conn?.recording ?? false,
        enabled: conn?.enabled ?? false,
      },
      entries: this.debugLogs.get(pathName) ?? [],
    };
  }

  // ---------------- controle de gravação ----------------
  private async setRecord(conn: CamConn, on: boolean): Promise<void> {
    if (conn.recording === on) return;
    conn.recording = on;
    try {
      await MediaMtxService.setRecord(conn.pathName, on);
      this.pushDebug(conn.pathName, "record", on ? "▶ gravação LIGADA" : "⏹ gravação desligada");
    } catch (e: any) {
      console.error(`CameraIvs: falha ao alternar gravação de ${conn.pathName}:`, e?.message);
      this.pushDebug(conn.pathName, "error", `falha ao ${on ? "ligar" : "desligar"} gravação: ${e?.message}`);
      conn.recording = !on; // reverte o estado para tentar de novo depois
    }
  }

  private onMotionStart(conn: CamConn): void {
    if (conn.stopTimer) {
      clearTimeout(conn.stopTimer);
      conn.stopTimer = undefined;
    }
    this.pushDebug(
      conn.pathName,
      "motion",
      conn.enabled ? "🟢 movimento DETECTADO" : "🟡 movimento (ignorado — gravação pausada)",
    );
    if (conn.enabled) void this.setRecord(conn, true);
  }

  private onMotionStop(conn: CamConn): void {
    if (conn.stopTimer) clearTimeout(conn.stopTimer);
    this.pushDebug(
      conn.pathName,
      "motion",
      `⚪ movimento parou — mantém gravando por ${RECORD_LATCH_MS / 1000}s`,
    );
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
      connected: false,
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
    this.pushDebug(pathName, "record", enabled ? "⏯ gravação por movimento RETOMADA" : "⏸ gravação por movimento PAUSADA");
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

  /** Marca como desconectado (uma vez) e agenda a reconexão. */
  private onDisconnect(conn: CamConn, reason: string): void {
    if (conn.connected) {
      conn.connected = false;
      this.pushDebug(conn.pathName, "conn", `🔌 desconectado (${reason}) — reconectando…`);
    }
    this.scheduleReconnect(conn);
  }

  private connect(conn: CamConn): void {
    if (conn.stopped) return;
    const opts = { host: conn.host, port: conn.port, path: this.uri() };

    const challenge = http.get(opts, (res) => {
      if (res.statusCode !== 401) {
        res.resume();
        this.pushDebug(conn.pathName, "error", `resposta inesperada da câmera (HTTP ${res.statusCode})`);
        this.onDisconnect(conn, `HTTP ${res.statusCode}`);
        return;
      }
      const c = this.parseChallenge(res.headers["www-authenticate"] || "");
      res.resume();
      if (!c.nonce || !c.realm) {
        this.pushDebug(conn.pathName, "error", "challenge Digest inválido (sem nonce/realm)");
        this.onDisconnect(conn, "auth inválida");
        return;
      }
      const auth = this.digestHeader(conn, c);
      const stream = http.get(
        { ...opts, headers: { Authorization: auth } },
        (r2) => {
          if (r2.statusCode !== 200) {
            r2.resume();
            this.pushDebug(conn.pathName, "error", `autenticação falhou (HTTP ${r2.statusCode}) — confira usuário/senha`);
            this.onDisconnect(conn, `HTTP ${r2.statusCode}`);
            return;
          }
          conn.connected = true;
          this.pushDebug(conn.pathName, "conn", "📡 conectado — escutando eventos de movimento da câmera");
          // O eventManager.cgi responde em multipart/x-mixed-replace: cada evento
          // vem entre marcadores de boundary. Fatiamos por boundary para capturar
          // o CORPO BRUTO de cada evento (incl. o data={...} JSON) sem quebrá-lo.
          const ctype = String(r2.headers["content-type"] || "");
          const bm = /boundary=([^;\s]+)/i.exec(ctype);
          const boundary = bm ? `--${bm[1].trim()}` : null;
          let buf = "";
          r2.setEncoding("utf8");
          r2.on("data", (d: string) => {
            buf += d;
            if (boundary) {
              let idx: number;
              while ((idx = buf.indexOf(boundary)) >= 0) {
                const part = buf.slice(0, idx);
                if (part.trim()) this.handleEvent(conn, part);
                buf = buf.slice(idx + boundary.length);
              }
              if (buf.length > 65536) buf = buf.slice(-8192);
            } else {
              // Sem boundary (câmera não-multipart): trata linha a linha.
              let i: number;
              while ((i = buf.indexOf("\n")) >= 0) {
                this.handleEvent(conn, buf.slice(0, i));
                buf = buf.slice(i + 1);
              }
              if (buf.length > 8192) buf = buf.slice(-1024);
            }
          });
          r2.on("end", () => this.onDisconnect(conn, "fim do stream"));
          r2.on("close", () => this.onDisconnect(conn, "conexão fechada"));
          r2.on("error", (e: any) => this.onDisconnect(conn, e?.message || "erro"));
        },
      );
      stream.on("error", (e: any) => this.onDisconnect(conn, e?.message || "erro"));
      conn.req = stream;
    });
    challenge.on("error", (e: any) => this.onDisconnect(conn, e?.message || "erro de rede"));
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

  /**
   * Processa um evento bruto do eventManager (um bloco multipart já sem o
   * boundary). Registra o CORPO EXATO que a câmera enviou (cabeçalhos +
   * Code=...;action=...;data={...}) e, em paralelo, aciona a gravação.
   */
  private handleEvent(conn: CamConn, segment: string): void {
    // Separa cabeçalhos do corpo (corpo = depois da 1ª linha em branco).
    let body = segment;
    const sep = segment.search(/\r?\n\r?\n/);
    if (sep >= 0) body = segment.slice(segment.indexOf("\n", sep) + 1);
    body = body.replace(/^[\r\n]+|[\r\n]+$/g, "");
    if (!body) return;

    // Log EXATO do que veio da câmera (preserva o JSON do data={...}).
    this.pushDebug(conn.pathName, "raw", body);

    const m = body.match(/Code=VideoMotion;action=(\w+)/);
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
