import * as path from "path";
import { Client } from "ssh2";

/**
 * Envio da logo do canal para o servidor do TV_WIP2.
 *
 * O sistema em PHP grava o arquivo em `/var/www/html/admin/canais/logo/` e
 * guarda no banco o caminho relativo `canais/logo/<arquivo>` — é esse caminho
 * que o aplicativo monta para exibir. Aqui reproduzimos exatamente isso.
 *
 * O envio é sempre por SFTP: o backend roda em outra máquina, e gravar em um
 * diretório local nunca colocaria o arquivo onde o PHP vai procurar.
 * Configuração em TVWIP_LOGO_SSH_HOST / _PORT / _USER / _PASSWORD, e o
 * diretório de destino em TVWIP_LOGO_DIR.
 */

/** Diretório, no servidor da TV, onde o PHP espera encontrar as logos. */
export const DIRETORIO_PADRAO = "/var/www/html/admin/canais/logo/";

/** Prefixo gravado em `tb_canais.imagens`. */
export const PREFIXO_RELATIVO = "canais/logo/";

const EXTENSOES = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];

/**
 * Nome de arquivo seguro: sem acento, sem espaço e sem barra — o valor vai
 * para um caminho no servidor e para dentro de uma URL.
 */
export function nomeDeArquivoSeguro(original: string): string {
  const ext = path.extname(original).toLowerCase();
  const base = path
    .basename(original, path.extname(original))
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60);

  const extensao = EXTENSOES.includes(ext) ? ext : ".png";
  // Sufixo de tempo: dois canais com "logo.png" não podem se sobrescrever.
  return `${base || "logo"}_${Date.now()}${extensao}`;
}

function diretorioDestino(): string {
  const dir = process.env.TVWIP_LOGO_DIR || DIRETORIO_PADRAO;
  return dir.endsWith("/") ? dir : `${dir}/`;
}

/** Envia por SFTP quando o backend está em outra máquina. */
function enviarPorSftp(destino: string, conteudo: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const conexao = new Client();
    let encerrado = false;

    const terminar = (erro?: Error) => {
      if (encerrado) return;
      encerrado = true;
      conexao.end();
      erro ? reject(erro) : resolve();
    };

    conexao
      .on("ready", () => {
        conexao.sftp((erro, sftp) => {
          if (erro) return terminar(erro);
          const escrita = sftp.createWriteStream(destino);
          escrita.on("close", () => terminar());
          escrita.on("error", (e: Error) => terminar(e));
          escrita.end(conteudo);
        });
      })
      .on("error", (e) => terminar(e))
      .connect({
        host: process.env.TVWIP_LOGO_SSH_HOST,
        port: Number(process.env.TVWIP_LOGO_SSH_PORT) || 22,
        username: process.env.TVWIP_LOGO_SSH_USER,
        password: process.env.TVWIP_LOGO_SSH_PASSWORD,
        readyTimeout: 20000,
      });
  });
}

/**
 * Grava a logo e devolve o caminho relativo para guardar em `tb_canais.imagens`.
 */
export async function salvarLogo(
  conteudo: Buffer,
  nomeOriginal: string,
): Promise<string> {
  if (!process.env.TVWIP_LOGO_SSH_HOST || !process.env.TVWIP_LOGO_SSH_USER) {
    throw new Error(
      "Envio de logo não configurado: defina TVWIP_LOGO_SSH_HOST, " +
        "TVWIP_LOGO_SSH_USER e TVWIP_LOGO_SSH_PASSWORD no .env.",
    );
  }

  const arquivo = nomeDeArquivoSeguro(nomeOriginal);
  const destino = `${diretorioDestino()}${arquivo}`;

  await enviarPorSftp(destino, conteudo);

  return `${PREFIXO_RELATIVO}${arquivo}`;
}
