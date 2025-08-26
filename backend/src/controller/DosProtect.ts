import dotenv from "dotenv";
import path from "path";
import { RouterOSAPI } from "node-routeros";
import { Client } from "ssh2";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

type RosRow = Record<string, unknown>;

export default class DosProtect {
  private isDDos = false;

  private hostBgp = process.env.BGP_IP as string;
  private loginBgp = process.env.MIKROTIK_LOGIN as string;
  private passwordBgp = process.env.MIKROTIK_PASSWORD as string;
  private portBgp = Number(process.env.PORT_MIKROTIK_API);

  private pppoe1hostBgp = process.env.MIKROTIK_PPPOE1 as string;
  private pppoe1loginBgp = process.env.MIKROTIK_LOGIN as string;
  private pppoe1passwordBgp = process.env.MIKROTIK_PASSWORD as string;
  private pppoe1portBgp = Number(process.env.PORT_MIKROTIK_API);

  private pppoe2hostBgp = process.env.MIKROTIK_PPPOE2 as string;
  private pppoe2loginBgp = process.env.MIKROTIK_LOGIN as string;
  private pppoe2passwordBgp = process.env.MIKROTIK_PASSWORD as string;
  private pppoe2portBgp = Number(process.env.PORT_MIKROTIK_API);

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
    const ros = this.createRosClient(
      this.hostBgp,
      this.loginBgp,
      this.passwordBgp,
      this.portBgp
    );
    await ros.connect();

    try {
      // ros.write(path, args) envia um comando RouterOS pela API.

      // O path é "/interface/monitor-traffic" → o mesmo comando da CLI do MikroTik.

      // O segundo parâmetro é um array de strings no formato =chave=valor (padrão da API RouterOS).

      // `=interface=${targetIface}` define qual interface monitorar (ex.: sfp-sfpplus1).

      // "=once=" é um flag booleano por presença (não tem valor), dizendo: “me dê uma amostra e finalize” (em vez de stream contínuo).

      // O await espera a resposta da API e o as RosRow[] faz um cast para “array de objetos genéricos (campo:string→valor:unknown)”.

      const result = (await ros.write("/interface/monitor-traffic", [
        `=interface=${targetIface}`, // define a interface desejada (ex.: sfp-sfpplus1)
        "=once=", // flag 'once' (presença da chave liga o comportamento "uma amostra")
      ])) as RosRow[];

      await ros.close();

      if (!result || result.length === 0)
        return { ok: false, reason: "sem_resultado" };

      const row = result[0];

      const rxBps = this.asNumber(row["rx-bits-per-second"]);
      const txBps = this.asNumber(row["tx-bits-per-second"]);
      const name = String(row["name"] ?? targetIface);

      return { ok: true, targetIface: name, rxBps, txBps };
    } catch (error) {
      console.log(error);
      return;
    }
  }

  private createRosClient(
    host: string,
    user: string,
    password: string,
    port: number
  ) {
    return new RouterOSAPI({
      host,
      user,
      password,
      port,
      timeout: 8000,
    });
  }

  private async executarSSH(host: string, comando: string): Promise<string> {
    try {
      return new Promise((resolve, reject) => {
        const conn = new Client();
        let output = "";

        // ////console.log(`[DEBUG] Tentando conectar no host: ${host}`);

        conn
          .on("ready", () => {
            // ////console.log(`[DEBUG] Conectado com sucesso no ${host}`);
            conn.exec(comando, (err, stream) => {
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
            username: process.env.MIKROTIK_LOGIN!,
            password: process.env.MIKROTIK_PASSWORD!,
            readyTimeout: 5000,
          });
      });
    } catch (error) {
      //console.log(error);
      return "";
    }
  }

  private async queryGBPS() {
    // Verifica se uma interface tem mais de 10GBPS para ativar a proxima função
    const responseRxBytes = await this.getMonitorTrafficOnce("sfp-sfpplus1");

    if (!responseRxBytes?.txBps) return;
    const Gbps = responseRxBytes?.txBps / 1000000000;

    console.log(Gbps.toFixed(2));

    const packetCount = await this.checkPacketCount();

    if (!packetCount) return;
    // se sim vai para a proxima etapa
    if (responseRxBytes.txBps >= 8 || packetCount > 20000) {
      this.blockIp();
    }

    return;
  }

  /*
  /system script run top5_pppoe_rx_tx_pps

  :local TOP 5;:local ids [/interface find where type="pppoe-in"];:local N [:len $ids];:if ($N=0) do={:put "Sem pppoe-in";:global top5Result "Sem pppoe-in";return};:if ($TOP>$N) do={:set TOP $N};:local pairs [];:foreach i in=$ids do={/interface monitor-traffic $i once do={:local nm [/interface get $i name];:local rx $"rx-packets-per-second";:local tx $"tx-packets-per-second";:if ([:typeof $rx]="nothing") do={:set rx 0};:if ([:typeof $tx]="nothing") do={:set tx 0};:set pairs ($pairs, ($nm."|".$rx."|".$tx))}};:local pairsRx $pairs;:local pairsTx $pairs;:local output "";:for t from=1 to=$TOP do={:local bestIndex -1;:local bestPps -1;:local idx 0;:foreach e in=$pairsRx do={:local sep1 [:find $e "|"];:local sep2 [:find $e "|" ($sep1+1)];:local rxv [:tonum [:pick $e ($sep1+1) $sep2]];:if ($rxv>$bestPps) do={:set bestPps $rxv;:set bestIndex $idx};:set idx ($idx+1)};:if ($bestIndex!=-1) do={:local e [:pick $pairsRx $bestIndex];:local sep1 [:find $e "|"];:local sep2 [:find $e "|" ($sep1+1)];:local nm [:pick $e 0 $sep1];:local rxv [:pick $e ($sep1+1) $sep2];:local txv [:pick $e ($sep2+1) [:len $e]];:set output ($output.$t.". ".$nm." - RxPPS: ".$rxv." TxPPS: ".$txv."\n");:local newPairs [];:local idx2 0;:foreach x in=$pairsRx do={:if ($idx2!=$bestIndex) do={:set newPairs ($newPairs,$x)};:set idx2 ($idx2+1)};:set pairsRx $newPairs}};:for t from=1 to=$TOP do={:local bestIndex -1;:local bestPps -1;:local idx 0;:foreach e in=$pairsTx do={:local sep1 [:find $e "|"];:local sep2 [:find $e "|" ($sep1+1)];:local txv [:tonum [:pick $e ($sep2+1) [:len $e]]];:if ($txv>$bestPps) do={:set bestPps $txv;:set bestIndex $idx};:set idx ($idx+1)};:if ($bestIndex!=-1) do={:local e [:pick $pairsTx $bestIndex];:local sep1 [:find $e "|"];:local sep2 [:find $e "|" ($sep1+1)];:local nm [:pick $e 0 $sep1];:local rxv [:pick $e ($sep1+1) $sep2];:local txv [:pick $e ($sep2+1) [:len $e]];:set output ($output.$t.". ".$nm." - TxPPS: ".$txv." RxPPS: ".$rxv."\n");:local newPairs [];:local idx2 0;:foreach x in=$pairsTx do={:if ($idx2!=$bestIndex) do={:set newPairs ($newPairs,$x)};:set idx2 ($idx2+1)};:set pairsTx $newPairs}};:global top5Result $output

  */

  private async pppoeClientGreatestPacket(
    host: string,
    user: string,
    password: string,
    port: number
  ) {
    const ros = this.createRosClient(host, user, password, port);
    await ros.connect();
    try {
      try {
        // Não funciona via API
        await this.executarSSH(host, "/system script run top5_pppoe_rx_tx_pps");
      } catch (e: any) {
        if (e?.errno === "UNKNOWNREPLY") {
          console.log("Script executado (retorno vazio !empty)");
        } else {
          throw e;
        }
      }

      // agora lê a variável global
      const envs = (await ros.write("/system/script/environment/print", [
        "?name=top5Result",
      ])) as RosRow[];

      if (envs.length > 0) {
        const env = envs[0];
        const result = (env.value ?? env.val ?? "").toString();
        let arrayResult = result
          .split(/[-\n]/)
          .filter((f) => f.trim().startsWith("Tx") || f.trim().startsWith("Rx"))
          .map((line) => {
            const match = line.match(/RxPPS:\s*(\d+)\s*TxPPS:\s*(\d+)/);
            if (!match) return { rx: 0, tx: 0 }; // ou lançar erro se quiser
            const [, rx, tx] = match;
            let x = 1;
            console.log(x++);
            
            return { rx: Number(rx), tx: Number(tx) };
          });
        console.log(arrayResult);
        return arrayResult;
      } else {
        console.log("Nenhum resultado encontrado em top5Result");
        return null;
      }
    } catch (error) {
      console.error("Erro:", error);
      return null;
    } finally {
      await ros.close().catch(() => {});
    }
  }

  private async checkPacketCount(): Promise<number> {
    await this.pppoeClientGreatestPacket(
      this.pppoe1hostBgp,
      this.pppoe1loginBgp,
      this.pppoe1passwordBgp,
      this.pppoe1portBgp
    );
    await this.pppoeClientGreatestPacket(
      this.pppoe2hostBgp,
      this.pppoe2loginBgp,
      this.pppoe2passwordBgp,
      this.pppoe2portBgp
    );
    return 0;
  }

  private blockIp() {}
}

//Teste das Funções

const test = new DosProtect();
console.log(test.startFunctions());
