import * as dotenv from "dotenv";

import { Client } from "ssh2";

dotenv.config();

export default class DosProtect {
  private isDos = false;
  private isDDos = false;

  public startFunctions() {
    // Inicia as funções utilizando cronjob a cada 1 minuto
    this.queryGBPS();
  }

  private async queryGBPS() {
    const comandoRx = "interface/ethernet/ print stats";
    // Verifica se uma interface tem mais de 10GBPS para ativar a proxima função
    const response = await this.accessMikrotik(
      process.env.BGP_IP as string,
      comandoRx
    );

    const responseRxBytes = this.extractRxBytes(response as string, 'sfp-sfpplus1');

    if(!responseRxBytes) return;
    // se sim vai para a proxima etapa
    if (responseRxBytes >= 200000) {
      this.checkConnectionsCount();
    }

    return;
  }

  private checkPPPoeServers() {
    this.checkConnectionsCount();
  }

  private checkConnectionsCount() {
    // Verifica a quantidade de conexões existentes utilizando o mesmo DST address
    // SRC > 200 && SRC = SRC && DST = DST Considere DOS
    // SRC > 200 && SRC != SRC && DST = DST Considere DDOS
    if (this.isDDos || this.isDos) {
      this.blockIp();
    }

    return;
  }

  private async accessMikrotik(
    host: string,
    command: string
  ): Promise<string | void> {
    try {
      return new Promise((resolve, reject) => {
        const conn = new Client();
        let output = "";

        // ////console.log(`[DEBUG] Tentando conectar no host: ${host}`);

        conn
          .on("ready", () => {
            // ////console.log(`[DEBUG] Conectado com sucesso no ${host}`);
            conn.exec(command, (err, stream) => {
              if (err) {
                console.error(
                  `[ERRO] Erro ao executar comando no ${host}:`,
                  err
                );
                conn.end();
                return reject(err);
              }

              stream
                .on("close", (code: number, signal: string) => {
                  console
                    .log
                    // `[DEBUG] Conexão fechada - Código: ${code}, Sinal: ${signal}`
                    ();
                  conn.end();
                  resolve(output);
                })
                .on("data", (data: Buffer) => {
                  // console.log(`[DEBUG] STDOUT (${host}):\n${data.toString()}`);
                  output += data.toString();
                })
                .stderr.on("data", (data: Buffer) => {
                  console
                    .error
                    // `[DEBUG] STDERR (${host}):\n${data.toString()}`
                    ();
                  output += data.toString();
                });
            });
          })
          .on("error", (err) => {
            console.error(`[ERRO] Erro de conexão com ${host}:`, err);
            reject(err);
          })
          .connect({
            host,
            port: 2004,
            username: process.env.MIKROTIK_LOGIN,
            password: process.env.MIKROTIK_PASSWORD,
            readyTimeout: 5000,
          });
      });
    } catch (error) {
      console.log(error);
      return;
    }
  }

  private extractRxBytes(output: string, iface: string): number | null {
    const namesLine = output.split('\n').find((line) => line.trim().startsWith("name:"));
    const rxLine = output.split('\n').find((line) => line.trim().startsWith('rx-bytes'));

    if(!namesLine || !rxLine) return null;

     // 3. Quebra os nomes e os valores em arrays
    const interfaces = namesLine.replace("name:", "").trim().split(/\s+/);
    const rxValues = rxLine.replace('rx-bytes:', '').trim().split(/\s+/);

     // 4. Cria um mapa {interface -> valor}
    const map: Record<string, number> = {};
    interfaces.forEach((name, i) => {
        // remove espaços internos do número e converte para number
        const cleanValue = rxValues[i]?.replace(/\s+/g, '') ?? "0";
        map[name] = Number(cleanValue);
    });

    // 5. Retorna já como number
    return map[iface] ?? null;

  }

  private blockIp() {}
}


//Teste das Funções

const test = new DosProtect();

console.log(test.startFunctions());
