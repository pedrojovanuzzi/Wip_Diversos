import { exec } from "child_process";
import fs from "fs";
import { promisify } from "util";
import dotenv from "dotenv";

dotenv.config();

const execAsync = promisify(exec);

const BEGIN_MARKER = "# === MEDIAMTX_STREAM_BEGIN ===";
const END_MARKER = "# === MEDIAMTX_STREAM_END ===";

function buildNginxBlock(): string {
  return `    ${BEGIN_MARKER}
    # Portal de Câmeras (wip-cams) — backend dedicado na porta 3003, banco wip_cams.
    # SEM barra final no proxy_pass: preserva o URI /api/cameras/... que o backend
    # espera (app.ts monta as rotas sob /api/cameras). Como o prefixo é mais
    # específico que /api/, o nginx o casa antes do proxy do backend antigo.
    location /api/cameras/ {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
    }

    # MediaMTX — playback de gravações (precisa vir antes de /stream/)
    location /stream/playback/ {
        proxy_pass http://127.0.0.1:9996/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_buffering off;
    }

    # MediaMTX — WebRTC/WHEP ao vivo
    location /stream/ {
        proxy_pass http://127.0.0.1:8889/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 600s;
    }
    ${END_MARKER}`;
}

/** Encontra o arquivo nginx que contém o domínio wipdiversos. */
async function findNginxConf(): Promise<string> {
  const dirs = [
    "/etc/nginx/sites-enabled",
    "/etc/nginx/sites-available",
    "/etc/nginx/conf.d",
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = `${dir}/${file}`;
      try {
        const content = fs.readFileSync(fullPath, "utf8");
        if (content.includes("wipdiversos.wiptelecomunicacoes.com.br")) {
          return fullPath;
        }
      } catch {}
    }
  }

  // Fallback: nginx.conf raiz
  if (fs.existsSync("/etc/nginx/nginx.conf")) {
    const content = fs.readFileSync("/etc/nginx/nginx.conf", "utf8");
    if (content.includes("wipdiversos.wiptelecomunicacoes.com.br")) {
      return "/etc/nginx/nginx.conf";
    }
  }

  throw new Error("Arquivo de config nginx não encontrado para o domínio.");
}

/**
 * Insere/substitui o bloco do MediaMTX no server block HTTPS.
 * Ancora no `location /api/` (que está sempre no server 443), evitando inserir
 * por engano no server de redirect (porta 80).
 */
function patchNginxContent(content: string): string {
  const block = buildNginxBlock();

  // Remove bloco anterior se existir (entre os marcadores)
  const beginIdx = content.indexOf(BEGIN_MARKER);
  const endIdx = content.indexOf(END_MARKER);
  if (beginIdx !== -1 && endIdx !== -1) {
    const lineStart = content.lastIndexOf("\n", beginIdx);
    const lineEnd = content.indexOf("\n", endIdx);
    content = content.slice(0, lineStart) + content.slice(lineEnd);
  }

  // Anchor 1: antes do `location /api/` (garante o server HTTPS correto)
  const apiIdx = content.indexOf("location /api/");
  if (apiIdx !== -1) {
    const lineStart = content.lastIndexOf("\n", apiIdx) + 1;
    return content.slice(0, lineStart) + block + "\n\n" + content.slice(lineStart);
  }

  // Anchor 2 (fallback): antes do `listen 443`
  const listenIdx = content.indexOf("listen 443");
  if (listenIdx !== -1) {
    const lineStart = content.lastIndexOf("\n", listenIdx) + 1;
    return content.slice(0, lineStart) + block + "\n\n" + content.slice(lineStart);
  }

  throw new Error(
    "Não encontrei 'location /api/' nem 'listen 443' para ancorar o bloco /stream.",
  );
}

class NginxService {
  public async applyMediaMtxBlock(): Promise<{ ok: boolean; output: string; confPath?: string }> {
    const logs: string[] = [];
    try {
      logs.push("Localizando arquivo nginx...");
      const confPath = await findNginxConf();
      logs.push(`Arquivo: ${confPath}`);

      const original = fs.readFileSync(confPath, "utf8");
      logs.push(`Lido: ${original.length} bytes`);

      // Backup
      fs.writeFileSync(confPath + ".bak", original, "utf8");
      logs.push("Backup salvo.");

      const patched = patchNginxContent(original);
      fs.writeFileSync(confPath, patched, "utf8");
      logs.push("Arquivo atualizado. Testando nginx...");

      // nginx -t
      const { stdout: testOut, stderr: testErr } = await execAsync("nginx -t 2>&1 || true");
      const testResult = (testOut + testErr).trim();
      logs.push(testResult);

      if (!testResult.includes("test is successful") && !testResult.includes("syntax is ok")) {
        // Rollback
        fs.writeFileSync(confPath, original, "utf8");
        logs.push("ERRO: config inválida — backup restaurado.");
        return { ok: false, output: logs.join("\n"), confPath };
      }

      await execAsync("systemctl reload nginx");
      logs.push("nginx recarregado com sucesso.");

      return { ok: true, output: logs.join("\n"), confPath };
    } catch (e: any) {
      logs.push("ERRO: " + (e?.message || String(e)));
      return { ok: false, output: logs.join("\n") };
    }
  }

  public async checkStatus(): Promise<{ ok: boolean; blockPresent: boolean; nginxActive: boolean; output: string }> {
    try {
      const confPath = await findNginxConf();
      const content = fs.readFileSync(confPath, "utf8");
      const blockPresent = content.includes(BEGIN_MARKER);

      const { stdout } = await execAsync("systemctl is-active nginx 2>/dev/null || echo inactive");
      const nginxActive = stdout.trim() === "active";

      return {
        ok: true,
        blockPresent,
        nginxActive,
        output: `Conf: ${confPath}\nBloco /stream: ${blockPresent ? "presente" : "ausente"}\nnginx: ${stdout.trim()}`,
      };
    } catch (e: any) {
      return { ok: false, blockPresent: false, nginxActive: false, output: e?.message || String(e) };
    }
  }
}

export default new NginxService();
