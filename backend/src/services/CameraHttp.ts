import http from "http";
import crypto from "crypto";

/**
 * Cliente HTTP com autenticação Digest para falar com a câmera (Intelbras/Dahua),
 * ex.: configManager.cgi (ler/gravar a configuração de detecção de movimento).
 */

const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");

/** Porta HTTP padrão das câmeras Intelbras/Dahua. */
export const CAMERA_HTTP_PORT = 80;

/** Extrai host/usuário/senha de uma URL rtsp://user:pass@host:porta/... */
export function parseRtspCreds(
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

function parseChallenge(h: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of h.matchAll(/(\w+)="?([^",]+)"?/g)) out[m[1]] = m[2];
  return out;
}

function digestHeader(
  user: string,
  pass: string,
  uri: string,
  c: Record<string, string>,
): string {
  const cnonce = crypto.randomBytes(8).toString("hex");
  const nc = "00000001";
  const qop = c.qop || "auth";
  const ha1 = md5(`${user}:${c.realm}:${pass}`);
  const ha2 = md5(`GET:${uri}`);
  const response = md5(`${ha1}:${c.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  return (
    `Digest username="${user}", realm="${c.realm}", nonce="${c.nonce}", ` +
    `uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", ` +
    `response="${response}"` + (c.opaque ? `, opaque="${c.opaque}"` : "")
  );
}

/**
 * GET com Digest (desafio 401 -> requisição autenticada). Resolve com o corpo
 * completo da resposta (as CGIs da câmera respondem texto curto).
 */
export function digestGet(
  host: string,
  port: number,
  user: string,
  pass: string,
  uri: string,
  timeoutMs = 8000,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const opts = { host, port, path: uri, timeout: timeoutMs };
    const challenge = http.get(opts, (res) => {
      if (res.statusCode !== 401) {
        // sem desafio: lê o corpo e devolve (algumas câmeras liberam sem auth)
        let b = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (b += d));
        res.on("end", () => resolve({ status: res.statusCode || 0, body: b }));
        return;
      }
      const c = parseChallenge(res.headers["www-authenticate"] || "");
      res.resume();
      if (!c.nonce || !c.realm) {
        reject(new Error("desafio Digest inválido"));
        return;
      }
      const auth = digestHeader(user, pass, uri, c);
      const r2 = http.get({ ...opts, headers: { Authorization: auth } }, (resp) => {
        let body = "";
        resp.setEncoding("utf8");
        resp.on("data", (d) => (body += d));
        resp.on("end", () => resolve({ status: resp.statusCode || 0, body }));
      });
      r2.on("timeout", () => r2.destroy(new Error("timeout")));
      r2.on("error", reject);
    });
    challenge.on("timeout", () => challenge.destroy(new Error("timeout")));
    challenge.on("error", reject);
  });
}
