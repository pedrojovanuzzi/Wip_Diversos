import dotenv from "dotenv";
import path from "path";
import { RouterOSAPI } from "node-routeros";

import { Client } from "ssh2";
import { TlsOptions } from "tls";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

type RosRow = Record<string, unknown>;

export default class DosProtect {
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

  private createRosClient() {
    return new RouterOSAPI({
      host: this.host,
      user: this.login,
      password: this.password,
      port: this.port,
      timeout: 8000,
    });
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

  /system script add name=top5_pppoe_rx_tx_pps source={ :local TOP 5; :local ids [/interface find where type="pppoe-in"]; :local N [:len $ids]; :if ($N=0) do={ :put "Sem pppoe-in"; return; }; :if ($TOP>$N) do={ :set TOP $N }; :local pairs []; :foreach i in=$ids do={ /interface monitor-traffic $i once do={ :local nm [/interface get $i name]; :local rx $"rx-packets-per-second"; :local tx $"tx-packets-per-second"; :if ([:typeof $rx]="nothing") do={ :set rx 0 }; :if ([:typeof $tx]="nothing") do={ :set tx 0 }; :set pairs ($pairs, ($nm."|".$rx."|".$tx)) } }; :local pairsRx $pairs; :local pairsTx $pairs; :put ("=== TOP ".$TOP." PPPoE-in por RxPPS ==="); :for t from=1 to=$TOP do={ :local bestIndex -1; :local bestPps -1; :local idx 0; :foreach e in=$pairsRx do={ :local sep1 [:find $e "|"]; :local sep2 [:find $e "|" ($sep1+1)]; :local rxv [:tonum [:pick $e ($sep1+1) $sep2]]; :if ($rxv>$bestPps) do={ :set bestPps $rxv; :set bestIndex $idx }; :set idx ($idx+1) }; :if ($bestIndex!=-1) do={ :local e [:pick $pairsRx $bestIndex]; :local sep1 [:find $e "|"]; :local sep2 [:find $e "|" ($sep1+1)]; :local nm [:pick $e 0 $sep1]; :local rxv [:pick $e ($sep1+1) $sep2]; :local txv [:pick $e ($sep2+1) [:len $e]]; :put ($t.". ". $nm ." - RxPPS: ". $rxv ."  TxPPS: ". $txv); :local newPairs []; :local idx2 0; :foreach x in=$pairsRx do={ :if ($idx2!=$bestIndex) do={ :set newPairs ($newPairs,$x) }; :set idx2 ($idx2+1) }; :set pairsRx $newPairs } }; :put ("=== TOP ".$TOP." PPPoE-in por TxPPS ==="); :for t from=1 to=$TOP do={ :local bestIndex -1; :local bestPps -1; :local idx 0; :foreach e in=$pairsTx do={ :local sep1 [:find $e "|"]; :local sep2 [:find $e "|" ($sep1+1)]; :local txv [:tonum [:pick $e ($sep2+1) [:len $e]]]; :if ($txv>$bestPps) do={ :set bestPps $txv; :set bestIndex $idx }; :set idx ($idx+1) }; :if ($bestIndex!=-1) do={ :local e [:pick $pairsTx $bestIndex]; :local sep1 [:find $e "|"]; :local sep2 [:find $e "|" ($sep1+1)]; :local nm [:pick $e 0 $sep1]; :local rxv [:pick $e ($sep1+1) $sep2]; :local txv [:pick $e ($sep2+1) [:len $e]]; :put ($t.". ". $nm ." - TxPPS: ". $txv ."  RxPPS: ". $rxv); :local newPairs []; :local idx2 0; :foreach x in=$pairsTx do={ :if ($idx2!=$bestIndex) do={ :set newPairs ($newPairs,$x) }; :set idx2 ($idx2+1) }; :set pairsTx $newPairs } } }
  */

  private async pppoeClientGrantestPacket(targetIface: string) {
    const ros = this.createRosClient();
    await ros.connect();
    try {
      const result = (await ros.write(
        "/system/script/run", // caminho API que executa um script
        [
          "=name=top5_pppoe_rx_tx_pps", // executa o script pelo NOME (exatamente como cadastrado no RouterOS)
          "=.tag=runTop5", // (opcional) tag para correlacionar esta chamada nas respostas
        ]
      )) as RosRow[]; 

      await ros.close();

      console.log(result);
      

    } catch (error) {
      console.log(error);
      return;
    }
  }

  private async checkPacketCount(): Promise<number> {
    if (this.isDDos) {
    }

    return 0;
  }

  private blockIp() {}
}

//Teste das Funções

const test = new DosProtect();
console.log(test.startFunctions());
