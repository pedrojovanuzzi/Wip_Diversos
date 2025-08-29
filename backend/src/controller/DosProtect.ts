import dotenv from "dotenv";
import path from "path";
import { RouterOSAPI } from "node-routeros";
import { Client } from "ssh2";
import axios from "axios";
import AppDataSource from "../database/DataSource";
import { DDDOS_MonitoringEntities } from "../entities/DDDOS_Monitoring";
import { RequestHandler } from "express";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const url = `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;
const urlMedia = `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/media`;
const token = process.env.CLOUD_API_ACCESS_TOKEN;
const dosRepository = AppDataSource.getRepository(DDDOS_MonitoringEntities);

type RosRow = Record<string, unknown>;

interface PacketResponse {
  dddosActive: boolean;
  offenders?: Array<{ pppoe: string; rx: number; tx: number; server: string }>;
}

class DosProtect {
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
    try {
      // Inicia as funções utilizando cronjob a cada 1 minuto
      await this.queryGBPS();
      console.log('Dddos Concluido');
      
      return;
    } catch (error) {
      console.log(error);
      return;
    }
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
    await ros!.connect();

    try {
      // ros!.write(path, args) envia um comando RouterOS pela API.

      // O path é "/interface/monitor-traffic" → o mesmo comando da CLI do MikroTik.

      // O segundo parâmetro é um array de strings no formato =chave=valor (padrão da API RouterOS).

      // `=interface=${targetIface}` define qual interface monitorar (ex.: sfp-sfpplus1).

      // "=once=" é um flag booleano por presença (não tem valor), dizendo: “me dê uma amostra e finalize” (em vez de stream contínuo).

      // O await espera a resposta da API e o as RosRow[] faz um cast para “array de objetos genéricos (campo:string→valor:unknown)”.

      const result = (await ros!.write("/interface/monitor-traffic", [
        `=interface=${targetIface}`, // define a interface desejada (ex.: sfp-sfpplus1)
        "=once=", // flag 'once' (presença da chave liga o comportamento "uma amostra")
      ])) as RosRow[];

      await ros!.close();

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
    try {
      return new RouterOSAPI({
        host,
        user,
        password,
        port,
        timeout: 8000,
      });
    } catch (error) {
      console.log(error);
      return;
    }
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
    try {
      // Verifica se uma interface tem mais de 10GBPS para ativar a proxima função
      const responseRxBytes = await this.getMonitorTrafficOnce("sfp-sfpplus1");

      if (!responseRxBytes?.txBps) return;
      const Gbps = responseRxBytes?.txBps / 1000000000;

      console.log(Gbps.toFixed(2));

      const packetCountOver = await this.checkPacketCount();

      if (!packetCountOver) return;
      // se sim vai para a proxima etapa
      if (responseRxBytes.txBps >= 8 || packetCountOver.dddosActive) {
        await this.blockIp(packetCountOver);
      }

      return;
    } catch (error) {
      console.log(error);
    }
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
    await ros!.connect();
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
      const envs = (await ros!.write("/system/script/environment/print", [
        "?name=top5Result",
      ])) as RosRow[];

      // Verifica se há itens em 'envs'
      if (envs.length > 0) {
        // Pega o primeiro item
        const env = envs[0]; // item de onde vem a string
        // Garante string (usa value, ou val, ou vazio) e converte
        const result = (env.value ?? env.val ?? "").toString(); // texto completo com várias linhas

        // Regex global para capturar PPPoE (grupo 1) e Rx/Tx em qualquer ordem:
        //  - Se vier "Rx ... Tx": grupos (2=rx, 3=tx)
        //  - Se vier "Tx ... Rx": grupos (4=tx, 5=rx)
        const re =
          /<pppoe-([^>]+)>.*?(?:RxPPS:\s*(\d+).*?TxPPS:\s*(\d+)|TxPPS:\s*(\d+).*?RxPPS:\s*(\d+))/g; // 'g' para todas ocorrências

        // Converte todos os matches em objetos { pppoe, rx, tx }
        const arrayResult = Array.from(result.matchAll(re)) // itera todas as correspondências
          .map((m) => ({
            // m é um RegExpMatchArray
            host: host,
            pppoe: m[1], // grupo 1: nome PPPoE
            rx: Number(m[2] ?? m[5] ?? 0), // se Rx veio antes usa m[2]; se depois usa m[5]
            tx: Number(m[3] ?? m[4] ?? 0), // se Tx veio depois usa m[3]; se antes usa m[4]
          })); // retorna o objeto já tipado

        // Opcional: inspeciona o array calculado
        // console.log(arrayResult); // conferência do parsing

        // Retorna o resultado
        return arrayResult; // { rx: <maiorRx>, tx: <maiorTx> }
      } else {
        // Caso não haja dados em 'envs'
        console.log("Nenhum resultado encontrado em top5Result"); // log de aviso
        // Retorna nulo
        return null; // sem dados para processar
      }
    } catch (error) {
      console.error("Erro:", error);
      return null;
    } finally {
      await ros!.close().catch(() => {});
    }
  }

  private async checkPacketCount(): Promise<PacketResponse> {
    try {
      const pppoe1 = await this.pppoeClientGreatestPacket(
        this.pppoe1hostBgp,
        this.pppoe1loginBgp,
        this.pppoe1passwordBgp,
        this.pppoe1portBgp
      );
      const pppoe2 = await this.pppoeClientGreatestPacket(
        this.pppoe2hostBgp,
        this.pppoe2loginBgp,
        this.pppoe2passwordBgp,
        this.pppoe2portBgp
      );

      const LIMITPACKETS = 300000;

      if (!pppoe1 || !pppoe2) return { dddosActive: false };

      // Função utilitária para testar se um item estoura o limite (rx OU tx)
      const isOver = (f: { rx: number; tx: number }) =>
        f.rx >= LIMITPACKETS || f.tx >= LIMITPACKETS;

      const offenders1 = pppoe1
        .filter(isOver)
        .map((f) => ({ pppoe: f.pppoe, rx: f.rx, tx: f.tx, server: f.host }));
      const offenders2 = pppoe2
        .filter(isOver)
        .map((f) => ({ pppoe: f.pppoe, rx: f.rx, tx: f.tx, server: f.host }));

      const allOffenders = [...offenders1, ...offenders2];

      if (allOffenders.length === 0) return { dddosActive: false };

      if (allOffenders) {
        console.log(allOffenders);
        return { offenders: allOffenders, dddosActive: true };
      }

      return { dddosActive: false };
    } catch (error) {
      console.log(error);
      return { dddosActive: false };
    }
  }

  //Ativar novamente funções após terminar monitoramento
  private async blockIp(offenders: PacketResponse) {
    try {
      await this.notify(offenders);
      offenders.offenders?.map(async (f) => {
        const ros = this.createRosClient(
          f.server,
          this.loginBgp,
          this.passwordBgp,
          this.portBgp
        );
        await ros!.connect();

        const resultIpClient = (await ros!.write([
          "/ppp/active/print", // comando correto (não use '=print=')
          `?name=${f.pppoe}`, // filtro por nome exato (sem aspas)
          "=.proplist=name,address,service,caller-id", // quais campos queremos (opcional)
        ])) as RosRow[]; // tipagem do retorno (array de linhas)

        // const resultIpClient = (await ros!.write([
        //   "/ppp/active/print", // comando correto (não use '=print=')
        //   `?name=GRAZIELIPRADOCASA`, // filtro por nome exato (sem aspas)
        //   "=.proplist=name,address,service,caller-id", // quais campos queremos (opcional)
        // ])) as RosRow[]; // tipagem do retorno (array de linhas)

        if (!Array.isArray(resultIpClient) || resultIpClient.length === 0)
          return;
        console.log(resultIpClient[0].address);

        const dosResponse = dosRepository.create({
          pppoe: f.pppoe,
          host: f.server,
          ip: resultIpClient[0].address as string,
        });

        const save = await dosRepository.save(dosResponse);

        console.log(save);

        const addRes = await ros!.write([
          '/ip/firewall/address-list/add', // comando correto para adicionar uma entrada
          `=address=${resultIpClient[0].address}`,// IP a ser adicionado (NÃO use aspas)
          '=list=block-ddos',               // nome da lista (ajuste se quiser)
          '=comment=auto-ddos',             // (opcional) comentário para auditoria
          '=timeout=10m',                // (opcional) tempo de expiração (ex.: 10 minutos)
        ]);  // o retorno é um array de linhas do RouterOS

        await ros!.close();
      });
    } catch (e: any) {
      if (e?.errno === "UNKNOWNREPLY") {
        console.log("Script executado (retorno vazio !empty)");
      } else {
        throw e;
      }
    }
  }

  private async notify(offenders: PacketResponse) {
    try {
      const list = offenders.offenders ?? [];

      if (list.length === 0) {
        // console.warn("Nenhum cliente adicionado a Black Hole");
        return;
      }

      const detalhes = list
        .map((f) => {
          return `PPPOE: ${f.pppoe} | SERVERS: ${f.server} | RX: ${f.rx} | TX: ${f.tx}`;
        })
        .join(" ; ");

      const msg = `Cliente Adicionado a Black Hole, possível ataque DDoS detectado! ${detalhes}`;

      console.warn(
        // usa warn para destacar
        msg // mensagem completa
      ); // fim do log

      const celulares = [
        process.env.TEST_PHONE as string,
        process.env.TEST_PHONE2 as string,
        process.env.TEST_PHONE3 as string,
      ];

      await this.templateMessage(celulares, msg);

      return;
    } catch (error) {
      console.log(error);
      return;
    }
  }

  private templateMessage = async (
    recipient_number: string | string[],
    msg: string
  ) => {
    try {
      if (
        typeof recipient_number !== "string" &&
        Array.isArray(recipient_number)
      ) {
        await Promise.all(
          recipient_number.map(async (f) => {
            const text = await axios.post(
              url,
              {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: f,
                type: "template",
                template: {
                  name: "aviso_d",
                  language: {
                    code: "pt_BR",
                  },
                  components: [
                    {
                      type: "body",
                    },
                  ],
                },
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              }
            );
            // console.log(text);
          })
        );
      } else {
        const text = await axios.post(
          url,
          {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipient_number,
            type: "template",
            template: {
              name: "aviso_d",
              language: {
                code: "pt_BR",
              },
              components: [
                {
                  type: "body",
                },
              ],
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        // console.log(text);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  public static last10Pppoe: RequestHandler = async (req, res, next) => {
    // Usa try/catch para capturar e repassar erros ao middleware de erro
    try {
      // Calcula o horário de 1 hora atrás a partir de agora
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      // Monta a query de top 10 PPPoE pela contagem na última hora
      const rows = await dosRepository
        .createQueryBuilder("m") // Define alias 'm' para a tabela
        .select("m.pppoe", "pppoe") // Seleciona a coluna pppoe com alias 'pppoe'
        .addSelect("COUNT(*)", "total") // Adiciona a contagem como 'total'
        .where("m.timestamp >= :from", { from: oneHourAgo }) // Filtra por janela temporal
        .groupBy("m.pppoe") // Agrupa por pppoe
        .orderBy("total", "DESC") // Ordena do maior para o menor
        .limit(10) // Limita em 10 resultados
        .getRawMany(); // Retorna objetos simples { pppoe, total }
      // Responde ao cliente com o JSON da query
      res.json(rows);
    } catch (err) {
      // Encaminha o erro para o middleware global
      next(err);
    }
  };

  public static eventsPerMinute: RequestHandler = async (req, res, next) => {
    // Protege com try/catch para tratar erros
    try {
      // Executa query agregando por minuto nos últimos 30 minutos
      const rows = await dosRepository
        .createQueryBuilder("m") // Alias 'm'
        .select("DATE_FORMAT(m.timestamp, '%Y-%m-%d %H:%i')", "minuto") // Formata timestamp por minuto
        .addSelect("COUNT(*)", "total") // Conta eventos por minuto
        .where("m.timestamp >= NOW() - INTERVAL 30 MINUTE") // Janela de 30 minutos
        .groupBy("minuto") // Agrupa por minuto
        .orderBy("minuto") // Ordena crescente por minuto
        .getRawMany(); // Retorna objetos simples
      // Envia o resultado como JSON
      res.json(rows);
    } catch (err) {
      // Repassa erro ao middleware global
      next(err);
    }
  };

  public static eventsPerHost: RequestHandler = async (req, res, next) => {
    // Envolve em try/catch para robustez
    try {
      // Executa query agregando por host na última hora
      const rows = await dosRepository
        .createQueryBuilder("m") // Alias 'm'
        .select("m.host", "host") // Seleciona host com alias 'host'
        .addSelect("COUNT(*)", "total") // Conta eventos por host
        .where("m.timestamp >= NOW() - INTERVAL 1 HOUR") // Janela de 1 hora
        .groupBy("m.host") // Agrupa por host
        .orderBy("total", "DESC") // Ordena dos maiores para os menores
        .getRawMany(); // Retorna objetos simples
      // Retorna o JSON com os hosts e totais
      res.json(rows);
    } catch (err) {
      // Encaminha erro para tratamento centralizado
      next(err);
    }
  };
}

export default DosProtect;

//Teste das Funções

// const test = new DosProtect();
// console.log(test.startFunctions());
