import dotenv from "dotenv";
import path from "path";
import { RouterOSAPI } from "node-routeros";

import { Client } from "ssh2";
import { TlsOptions } from "tls";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });


type RosRow = Record<string, unknown>;


export default class DosProtect {
  private isDos = false;
  private isDDos = false;
  private host = process.env.BGP_IP as string;
  private login = process.env.MIKROTIK_LOGIN as string;
  private password = process.env.MIKROTIK_PASSWORD as string;
  private port = Number(process.env.PORT_MIKROTIK_API);

  public async startFunctions() {
    // Inicia as funções utilizando cronjob a cada 1 minuto
    await this.queryGBPS();
    return;
  }

  private asNumber(val: unknown): number {
  // Se já for número, retorna direto
  if (typeof val === "number") return val;
  // Se for string, tenta converter; números grandes vêm em string
  if (typeof val === "string") return Number(val.trim().replace(/\s+/g, ""));
  // Qualquer outro tipo vira 0
  return 0;
}

  private async getMonitorTrafficOnce(targetIface: string) {
    const ros = this.createRosClient();
    await ros.connect();

    try {

      const result = await ros.write(
        "/interface/monitor-traffic",
        [
          `=interface=${targetIface}`, // define a interface desejada (ex.: sfp-sfpplus1)
          "=once=", // flag 'once' (presença da chave liga o comportamento "uma amostra")
        ]
      ) as RosRow[];

      await ros.close();

      if (!result || result.length === 0) return { ok: false, reason: "sem_resultado" };

      const row = result[0];

      const rxBps = this.asNumber(row['rx-bits-per-second']);
      const txBps = this.asNumber(row['tx-bits-per-second']);
      const name = String(row['name'] ?? targetIface);

      return {ok: true, targetIface: name, rxBps, txBps};
      
    } catch (error) {
      console.log(error);
      return;
    }
  }

  private createRosClient() {
    return new RouterOSAPI({
      host: this.host,
      user: this.login,
      password: this.password,
      port: this.port,
      tls: "TLSv1.3" as TlsOptions,
      timeout: 8000,
    });
  }

  private async queryGBPS() {
    // Verifica se uma interface tem mais de 10GBPS para ativar a proxima função
    const responseRxBytes = await this.getMonitorTrafficOnce('sfp-sfpplus1');

    if (!responseRxBytes?.txBps) return;
    const Gbps = responseRxBytes?.txBps / 1000000000;
    
    console.log(Gbps.toFixed(2));
    

    // se sim vai para a proxima etapa
    if (responseRxBytes.txBps >= 8) {
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

  private blockIp() {}
}

//Teste das Funções

const test = new DosProtect();
console.log(test.startFunctions());
