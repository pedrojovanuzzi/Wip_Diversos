import { Client } from "ssh2";
import SftpClient from "ssh2-sftp-client";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const BEGIN_MARKER = "# === MEDIAMTX_STREAM_BEGIN ===";
const END_MARKER = "# === MEDIAMTX_STREAM_END ===";

function buildNginxBlock(): string {
  return `    ${BEGIN_MARKER}
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

function getSshOptions() {
  const host = process.env.NGINX_SSH_HOST;
  const username = process.env.NGINX_SSH_USER || "root";
  const port = Number(process.env.NGINX_SSH_PORT || 22);
  const keyPath = process.env.NGINX_SSH_KEY_PATH;
  const password = process.env.NGINX_SSH_PASSWORD;

  if (!host) throw new Error("NGINX_SSH_HOST não configurado no .env");

  const opts: any = { host, port, username, readyTimeout: 10000 };
  if (keyPath) {
    opts.privateKey = fs.readFileSync(keyPath);
  } else if (password) {
    opts.password = password;
  } else {
    throw new Error("Configure NGINX_SSH_KEY_PATH ou NGINX_SSH_PASSWORD no .env");
  }
  return opts;
}

/** Roda um comando via SSH e retorna stdout+stderr. */
function sshExec(command: string): Promise<string> {
  const opts = getSshOptions();
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = "";
    conn
      .on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) { conn.end(); return reject(err); }
          stream
            .on("close", (code: number) => {
              conn.end();
              if (code !== 0) return reject(new Error(`exit ${code}:\n${output}`));
              resolve(output);
            })
            .on("data", (d: Buffer) => { output += d.toString(); })
            .stderr.on("data", (d: Buffer) => { output += d.toString(); });
        });
      })
      .on("error", reject)
      .connect(opts);
  });
}

/** Encontra o arquivo nginx que contém o domínio wipdiversos. */
async function findNginxConf(): Promise<string> {
  const output = await sshExec(
    `grep -rl 'wipdiversos.wiptelecomunicacoes.com.br' ` +
    `/etc/nginx/sites-enabled/ /etc/nginx/sites-available/ /etc/nginx/conf.d/ 2>/dev/null | head -1`,
  );
  const path = output.trim();
  if (!path) throw new Error("Arquivo de config nginx não encontrado para o domínio.");
  return path;
}

/** Insere/substitui o bloco do MediaMTX no conteúdo do nginx, antes do último `}`. */
function patchNginxContent(content: string): string {
  const block = buildNginxBlock();

  // Remove bloco anterior se existir
  const beginIdx = content.indexOf(BEGIN_MARKER);
  const endIdx = content.indexOf(END_MARKER);
  if (beginIdx !== -1 && endIdx !== -1) {
    const before = content.slice(0, content.lastIndexOf("\n", beginIdx) + 1);
    const after = content.slice(content.indexOf("\n", endIdx) + 1);
    content = before + after;
  }

  // Insere antes do último } (fechamento do server block)
  const lastBrace = content.lastIndexOf("\n}");
  if (lastBrace === -1) throw new Error("Não encontrou o fechamento do server block no nginx.");
  return content.slice(0, lastBrace) + "\n\n" + block + "\n" + content.slice(lastBrace);
}

class NginxService {
  /**
   * Lê o arquivo nginx via SFTP, insere/substitui o bloco do MediaMTX,
   * escreve de volta e recarrega o nginx — tudo sem tocar no servidor manualmente.
   */
  public async applyMediaMtxBlock(): Promise<{ ok: boolean; output: string; confPath?: string }> {
    const sftp = new SftpClient();
    const logs: string[] = [];
    try {
      const opts = getSshOptions();

      // 1. Acha o arquivo de config
      logs.push("Localizando arquivo nginx...");
      const confPath = await findNginxConf();
      logs.push(`Arquivo: ${confPath}`);

      // 2. Lê o conteúdo via SFTP
      await sftp.connect(opts);
      const buffer = await sftp.get(confPath) as Buffer;
      const original = buffer.toString("utf8");
      logs.push(`Lido: ${original.length} bytes`);

      // 3. Faz backup e aplica o patch em memória
      const patched = patchNginxContent(original);

      // 4. Salva o backup e o arquivo novo via SFTP
      await sftp.put(Buffer.from(original, "utf8"), confPath + ".bak");
      await sftp.put(Buffer.from(patched, "utf8"), confPath);
      await sftp.end();
      logs.push("Arquivo escrito. Testando nginx...");

      // 5. nginx -t + reload via SSH
      const reloadOut = await sshExec("nginx -t 2>&1 && systemctl reload nginx && echo OK_RELOAD");
      logs.push(reloadOut.trim());

      if (!reloadOut.includes("OK_RELOAD")) {
        // Rollback
        await sftp.connect(opts);
        await sftp.put(Buffer.from(original, "utf8"), confPath);
        await sftp.end();
        throw new Error("nginx -t falhou, config restaurada do backup:\n" + reloadOut);
      }

      return { ok: true, output: logs.join("\n"), confPath };
    } catch (e: any) {
      try { await sftp.end(); } catch {}
      return { ok: false, output: [...logs, e?.message || String(e)].join("\n") };
    }
  }

  /** Verifica se o bloco já está aplicado e o status do nginx. */
  public async checkStatus(): Promise<{ ok: boolean; blockPresent: boolean; nginxActive: boolean; output: string }> {
    try {
      const confPath = await findNginxConf();
      const [blockOut, statusOut] = await Promise.all([
        sshExec(`grep -l '${BEGIN_MARKER}' '${confPath}' 2>/dev/null || echo AUSENTE`),
        sshExec("systemctl is-active nginx"),
      ]);
      return {
        ok: true,
        blockPresent: !blockOut.includes("AUSENTE"),
        nginxActive: statusOut.trim() === "active",
        output: `Conf: ${confPath}\nBloco: ${blockOut.trim()}\nnginx: ${statusOut.trim()}`,
      };
    } catch (e: any) {
      return { ok: false, blockPresent: false, nginxActive: false, output: e?.message || String(e) };
    }
  }
}

export default new NginxService();
