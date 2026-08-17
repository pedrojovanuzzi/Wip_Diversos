import { EventEmitter } from "events";
import { Client, ClientChannel } from "ssh2";
import { ServidorConexao } from "./servidorAcesso.service";

/**
 * Sessão de CLI da OLT por SSH.
 *
 * A OLT é interativa (prompt, paginação, "cd onu"), então trabalhamos com um
 * shell aberto e não com comandos avulsos. A interface (`on("data")`, `send`,
 * `exec`, `end`) é a mesma que o código já usava com Telnet, para a troca de
 * transporte não espalhar mudança pelos handlers.
 */
export class SessaoOlt extends EventEmitter {
  private conn = new Client();
  private canal: ClientChannel | null = null;
  /** Falso depois que o equipamento fecha o canal. */
  viva = true;

  /** Fim de resposta: prompt do equipamento, ex.: "Admin\onu#" ou "OLT>". */
  private static PROMPT = /[#>]\s*$/;

  static abrir(olt: ServidorConexao, timeout = 15000): Promise<SessaoOlt> {
    const sessao = new SessaoOlt();
    return new Promise((resolve, reject) => {
      sessao.conn
        .on("ready", () => {
          sessao.conn.shell({ term: "vt100" }, (err, canal) => {
            if (err) return reject(err);
            sessao.canal = canal;
            canal.on("data", (dados: Buffer) => {
              const texto = dados.toString();
              // Paginação da Huawei: segue a listagem sem intervenção.
              if (/Press any key|---- More/i.test(texto)) {
                canal.write(" ");
              }
              sessao.emit("data", dados);
            });
            canal.on("close", () => {
              sessao.viva = false;
              sessao.emit("close");
            });
            // O equipamento cospe banner e prompt ao abrir a sessão; espera
            // isso terminar para não confundir com a resposta do 1º comando.
            sessao.aguardarSilencio(canal, 800).then(() => resolve(sessao));
          });
        })
        .on("error", (err) => {
          sessao.viva = false;
          reject(err);
        })
        .connect({
          host: olt.host,
          port: olt.porta,
          username: olt.login,
          password: olt.senha,
          readyTimeout: timeout,
          // Equipamento derruba sessão ociosa; o keepalive segura o canal
          // enquanto a fila de comandos ainda tem trabalho.
          keepaliveInterval: 15000,
          keepaliveCountMax: 4,
          // OLTs costumam anunciar algoritmos antigos.
          algorithms: {
            kex: [
              "diffie-hellman-group1-sha1",
              "diffie-hellman-group14-sha1",
              "diffie-hellman-group-exchange-sha1",
              "diffie-hellman-group14-sha256",
              "diffie-hellman-group16-sha512",
              "ecdh-sha2-nistp256",
            ] as any,
            cipher: [
              "aes128-cbc",
              "3des-cbc",
              "aes192-cbc",
              "aes256-cbc",
              "aes128-ctr",
              "aes192-ctr",
              "aes256-ctr",
            ] as any,
          },
        });
    });
  }

  /** Envia uma linha e devolve o controle sem esperar a resposta completa. */
  async send(texto: string, espera = 300): Promise<void> {
    if (!this.canal) throw new Error("Sessão da OLT não está aberta.");
    // Ctrl+C não leva Enter junto.
    this.canal.write(texto === "\x03" ? texto : `${texto}\n`);
    await new Promise((resolve) => setTimeout(resolve, espera));
  }

  /**
   * Envia o comando e acumula a saída até o prompt voltar — ou até a OLT ficar
   * em silêncio, que é o que acontece quando o comando não imprime prompt.
   */
  exec(
    comando: string,
    opcoes: {
      execTimeout?: number;
      /** Tempo sem resposta que encerra a leitura. */
      silencio?: number;
      /** Aceitos por compatibilidade com as chamadas antigas do Telnet. */
      timeout?: number;
      stripControls?: boolean;
    } = {},
  ): Promise<string> {
    const { silencio = 1200 } = opcoes;
    const execTimeout = opcoes.execTimeout ?? opcoes.timeout ?? 30000;
    if (!this.canal) return Promise.reject(new Error("Sessão da OLT não está aberta."));
    const canal = this.canal;

    return new Promise((resolve, reject) => {
      let buffer = "";
      let ocioso: NodeJS.Timeout | null = null;
      // O prompt só vale depois que o equipamento ecoou o comando: senão o
      // prompt que já estava na tela encerraria a leitura na hora.
      let viuEco = false;

      const encerrar = () => {
        if (ocioso) clearTimeout(ocioso);
        clearTimeout(limite);
        canal.removeListener("data", aoReceber);
        // Remove o eco do comando, como o stripShellPrompt do Telnet fazia.
        const semEco = buffer.replace(/\r/g, "");
        const quebra = semEco.indexOf("\n");
        const limpo =
          semEco.slice(0, quebra).includes(comando.slice(0, 20)) && quebra >= 0
            ? semEco.slice(quebra + 1)
            : semEco;
        resolve(limpo);
      };

      const aoReceber = (dados: Buffer) => {
        buffer += dados.toString();
        if (!viuEco && buffer.includes(comando.slice(0, 20))) viuEco = true;
        if (ocioso) clearTimeout(ocioso);
        if (viuEco && SessaoOlt.PROMPT.test(buffer.trimEnd())) return encerrar();
        ocioso = setTimeout(encerrar, silencio);
      };

      const limite = setTimeout(() => {
        canal.removeListener("data", aoReceber);
        if (ocioso) clearTimeout(ocioso);
        reject(new Error(`Tempo esgotado ao executar "${comando}" na OLT.`));
      }, execTimeout);

      canal.on("data", aoReceber);
      canal.write(`${comando}\n`);
    });
  }

  /** Espera o equipamento parar de escrever (banner, prompt, paginação). */
  private aguardarSilencio(canal: ClientChannel, ms: number): Promise<void> {
    return new Promise((resolve) => {
      let ocioso = setTimeout(finalizar, ms);
      function aoReceber() {
        clearTimeout(ocioso);
        ocioso = setTimeout(finalizar, ms);
      }
      function finalizar() {
        canal.removeListener("data", aoReceber);
        resolve();
      }
      canal.on("data", aoReceber);
    });
  }

  async end(): Promise<void> {
    this.viva = false;
    try {
      this.canal?.end();
      this.conn.end();
    } catch {
      /* encerramento é best-effort */
    }
  }
}


/**
 * Uma sessão por equipamento, reaproveitada entre chamadas.
 *
 * Abrir um SSH por comando estourava o limite de VTYs do Huawei — daí os
 * "Unable to open shell" e ECONNRESET. Aqui as chamadas entram em fila,
 * dividem a mesma sessão e ela fica aberta por um tempo curto depois do
 * último uso.
 */
const OCIOSA_MS = 30000;

type Aberta = {
  sessao: SessaoOlt;
  fila: Promise<unknown>;
  ocioso: NodeJS.Timeout | null;
};

const abertas = new Map<string, Aberta>();

const chaveDe = (servidor: ServidorConexao) =>
  `${servidor.host}:${servidor.porta}:${servidor.login}`;

function agendarFechamento(chave: string) {
  const atual = abertas.get(chave);
  if (!atual) return;
  if (atual.ocioso) clearTimeout(atual.ocioso);
  atual.ocioso = setTimeout(() => {
    abertas.delete(chave);
    atual.sessao.end().catch(() => undefined);
  }, OCIOSA_MS);
}

/** Executa na sessão do equipamento, serializando com quem já está usando. */
export async function comSessaoOlt<T>(
  servidor: ServidorConexao,
  tarefa: (sessao: SessaoOlt) => Promise<T>,
): Promise<T> {
  const chave = chaveDe(servidor);

  const executar = async (tentativa = 1): Promise<T> => {
    let atual = abertas.get(chave);
    if (atual && !atual.sessao.viva) {
      abertas.delete(chave);
      atual = undefined;
    }

    if (!atual) {
      const sessao = await SessaoOlt.abrir(servidor);
      atual = { sessao, fila: Promise.resolve(), ocioso: null };
      abertas.set(chave, atual);
    }
    if (atual.ocioso) {
      clearTimeout(atual.ocioso);
      atual.ocioso = null;
    }

    const emFila = atual.fila.then(
      () => tarefa(atual!.sessao),
      () => tarefa(atual!.sessao),
    );
    atual.fila = emFila.catch(() => undefined);

    try {
      return await emFila;
    } catch (erro: any) {
      // Sessão caiu no meio: derruba o cache e tenta uma vez com uma nova.
      const caiu =
        /ECONNRESET|Unable to open shell|not connected|closed/i.test(
          String(erro?.message || erro),
        );
      abertas.delete(chave);
      await atual.sessao.end().catch(() => undefined);
      if (caiu && tentativa === 1) return executar(2);
      throw erro;
    } finally {
      agendarFechamento(chave);
    }
  };

  return executar();
}
