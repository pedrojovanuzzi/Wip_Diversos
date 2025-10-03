import MkauthSource from "../database/MkauthSource";
import { ClientesEntities } from "../entities/ClientesEntities";
import { Faturas } from "../entities/Faturas";
import { Request, Response } from "express";
import { Radacct } from "../entities/Radacct";
import { Between, LessThanOrEqual } from "typeorm";
import { Telnet } from "telnet-client";
import { Client } from "ssh2";
import dotenv from "dotenv";

dotenv.config();

const servidores = [
  { host: process.env.MIKROTIK_PPPOE1, nome: "PPPOE1" },
  { host: process.env.MIKROTIK_PPPOE2, nome: "PPPOE2" },
  { host: process.env.MIKROTIK_PPPOE3, nome: "PPPOE3" },
  { host: process.env.MIKROTIK_PPPOE4, nome: "PPPOE4" },
  { host: process.env.MIKROTIK_PPPOE5, nome: "PPPOE5" },
];

class ClientAnalytics {
  private clientIp: string | undefined;
  private serverIp: string | undefined;
  private versao: string | undefined | number;
  private onuId: string | undefined;

  info = async (req: Request, res: Response) => {
    try {
      const { pppoe } = req.body;
      const ClientesRepository = MkauthSource.getRepository(ClientesEntities);
      let User = await ClientesRepository.find({
        where: { login: pppoe, cli_ativado: "s" },
      });

      if (User.length < 1) {
        res
          .status(500)
          .json({ error: "Cliente não existe, ou está desativado" });
      }

      const FaturasRepository = MkauthSource.getRepository(Faturas);

      const hoje = new Date();

      const limiteInferior = new Date();
      limiteInferior.setMonth(hoje.getMonth() - 3);

      const limiteSuperior = new Date();
      limiteSuperior.setDate(hoje.getDate() - 15);

      const FaturaDoMes = await FaturasRepository.find({
        where: {
          login: pppoe,
          status: "vencido",
          datavenc: Between(limiteInferior, limiteSuperior),
        },
      });

      const suspensao = FaturaDoMes.length > 0;

      res.status(200).json({ user: User, suspensao: suspensao });
      return;
    } catch (error) {
      error;
    }
  };

  clientList = async (req: Request, res: Response) => {
    try {
      const resultados = [];

      for (const servidor of servidores) {
        try {
          const comando = `/ppp active print without-paging detail`;
          const resposta = await this.executarSSH(servidor.host!, comando);

          const regex =
            /name="([^"]+)"\s+service=pppoe\s+caller-id="([0-9A-F:]+)"\s+address=(\d+\.\d+\.\d+\.\d+)\s+uptime=((?:\d+y)?(?:\d+mo)?(?:\d+w)?(?:\d+d)?(?:\d+h)?(?:\d+m)?(?:\d+s)?|\d+)/gim;

          const matches = [...resposta.matchAll(regex)];

          for (const match of matches) {
            let [, pppoe, callerId, ip, upTime] = match;

            if (/^\d+$/.test(upTime)) {
              upTime = `${upTime}d`;
            }

            resultados.push({
              servidor: servidor.nome,
              pppoe,
              callerId,
              ip,
              upTime: upTime,
            });
          }
        } catch (err: any) {
          resultados.push({
            servidor: servidor.nome,
            erro: err.message || "Erro desconhecido",
          });
        }
      }

      res.status(200).json(resultados);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  pppoesLogs = async (req: Request, res: Response) => {
    try {
      const resultados = [];

      for (const servidor of servidores) {
        try {
          const comando = `log/print without-paging detail`;
          const resposta = await this.executarSSH(servidor.host!, comando);

          const regex =
  /time=(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+topics=([^ ]+)\s+message="([^"]+)"\s+extra-info="([^"]*)"/g;

          const matches = [...resposta.matchAll(regex)];

          
          for (const match of matches) {
            const [, time, topics, message, extra] = match;

            resultados.push({
              servidor: servidor.nome,
              time,
              topics,
              message,
              extra,
            });
          }
        } catch (err: any) {
          resultados.push({
            servidor: servidor.nome,
            erro: err.message || "Erro desconhecido",
          });
        }
      }

      res.status(200).json(resultados);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  desconections = async (req: Request, res: Response) => {
    try {
      const { pppoe } = req.body;
      const ClientesRepository = MkauthSource.getRepository(Radacct);
      const Desconexoes = await ClientesRepository.find({
        where: { username: pppoe },
        order: { radacctid: "DESC" },
        take: 8,
      });
      res.status(200).json({ desconexoes: Desconexoes });
      return;
    } catch (error) {
      ////console.log(error);
    }
  };

  normalizeMac(mac: string): string {
    return mac
      .toUpperCase() // maiúsculas
      .replace(/[^0-9A-F]/g, ""); // remove tudo que não seja HEX
  }

  onuSinal = async (req: Request, res: Response) => {
    try {
      const { pppoe } = req.body;

      const ClientesRepository = MkauthSource.getRepository(ClientesEntities);
      let User = await ClientesRepository.findOne({
        where: { login: pppoe, cli_ativado: "s" },
        order: { id: "ASC" },
      });

      const ip = String(process.env.OLT_IP);
      const login = String(process.env.OLT_LOGIN);
      const password = String(process.env.OLT_PASSWORD);

      let buffer = "";

      const conn = new Telnet();

      // 🟡 Eventos para log no terminal
      conn.removeAllListeners("data");
      conn.on("data", async (data) => {
        const chunk = data.toString();
        buffer += chunk;
        console.log(chunk);

        // se a OLT pedir "Press any key", manda Enter
        if (chunk.includes("Press any key")) {
          await conn?.send("\n").catch(console.error);
        }
      });

      const params = {
        host: ip,
        port: 23,
        timeout: 10000,
        sendTimeout: 2000,
        debug: true,
        shellPrompt: /Admin\\onu#\s*$/,
        stripShellPrompt: true,
        negotiationMandatory: false,
        disableLogon: true,
      };

      await conn.connect(params);

      await conn.send(login);

      await conn.send(password);

      await conn.send("en");
      await conn.send(password);

      const slot = User?.porta_olt?.substring(0, 2);
      const pon = User?.porta_olt?.substring(2, 4);
      const rawTag = User?.tags ?? "";
      const snCliente = this.normalizeMac(rawTag.trim());

      let onuId: any;

      if (!snCliente) {
        ////console.log("Procurando ONU com MAC normalizado:", snCliente);
        res.status(500).json({ respostaTelnet: "Sem Onu" });
        return;
      }

      await conn.exec("cd onu", { execTimeout: 30000 });

      const query = await conn.exec(`show online slot ${slot} pon ${pon}`, {
        execTimeout: 30000,
        stripControls: true, // remove caracteres de controle
      });

      // divide a saída em linhas
      const lines = query.split("\n");

      // limpa as mensagens "Press any key..." e espaços extras
      const cleaned = lines
        .map(
          (l) => l.replace(/--Press any key.*?stop--/g, "").trim() // remove a mensagem
        )
        .filter((l) => /^\d+/.test(l)); // mantém só linhas que começam com número (as ONUs)

      // agora converte em objetos
      const onus = cleaned.map((line) => {
        const parts = line.trim().split(/\s+/);

        return {
          onuid: parts[0] ?? "", // ID da ONU
          model: parts[1] ?? "", // Modelo (pode vir vazio)
          sn: parts[2] ?? "", // Número de série ou MAC
          extra: parts[3] ?? "", // Às vezes vem "epon,123456"
          slotPon: parts[parts.length - 1], // sempre no final
        };
      });

      // console.log("DEBUG linhas limpas:", onus);

      onuId = onus.find((f) => this.normalizeMac(f.sn) === snCliente)?.onuid;

      if (!onuId || !slot || !pon) {
        await conn.end();
        res.status(500).json({ respostaTelnet: "Sem Onu" });
        return;
      }

      console.log("Numero onu " + onuId);

      const optic = await conn.exec(
        `show optic_module slot ${slot} pon ${pon} onu ${onuId}`,
        { execTimeout: 30000 }
      );

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const output = optic.split("Admin\\onu#")[0].trim();

      console.log(output + "outpte");

      if (/onu#\s*$/i.test(output)) {
        await conn.end();
        res.status(500).json({ respostaTelnet: "ONU APAGADA" });
        return;
      }

      this.onuId = onuId;

      ////console.log(output);

      if (!onuId || !output) {
        res.status(500).json({ respostaTelnet: "Sem Onu" });
        return;
      }

      res.status(200).json({ respostaTelnet: output });
      await conn.end();
    } catch (error) {
      console.error("❌ Erro Telnet:", error);
      res.status(500).json({
        respostaTelnet: "Falha ao executar comando Telnet",
        detalhes: String(error),
      });
    }
  };

  onuReiniciar = async (req: Request, res: Response) => {
    let turnOff = "";

    try {
      const { pppoe } = req.body;

      const ClientesRepository = MkauthSource.getRepository(ClientesEntities);
      let User = await ClientesRepository.findOne({
        where: { login: pppoe, cli_ativado: "s" },
        order: { id: "ASC" },
      });

      const ip = String(process.env.OLT_IP);
      const login = String(process.env.OLT_LOGIN);
      const password = String(process.env.OLT_PASSWORD);

      const conn = new Telnet();

      // 🟡 Eventos para log no terminal
      conn.on("data", (data) => {
        buffer = data.toString();
        console.log(buffer);
      });

      let buffer = "";

      const params = {
        host: ip,
        port: 23,
        timeout: 10000,
        sendTimeout: 200,
        debug: true,
        shellPrompt: /[#>]\s*$/,
        stripShellPrompt: true,
        negotiationMandatory: false,
        disableLogon: true,
      };

      await conn.connect(params);

      await conn.send(login);

      await conn.send(password);

      await conn.send("en");
      await conn.send(password);
      await conn.send("cd onu");

      const slot = User?.porta_olt?.substring(0, 2);
      const pon = User?.porta_olt?.substring(2, 4);
      const rawTag = User?.tags ?? "";
      const snCliente = this.normalizeMac(rawTag.trim());

      let onuId = "";

      if (snCliente) {
        ////console.log("Procurando ONU com MAC normalizado:", snCliente);
        onuId = await this.buscarOnuIdPorMac(
          conn,
          `show online slot ${slot} pon ${pon}`,
          snCliente
        );
      }

      ////console.log(this.onuId);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (!onuId || !slot || !pon) {
        await conn.end();
        res.status(500).json({ respostaTelnet: "Sem Onu" });
        return;
      }

      await conn.send(`cd ..`);

      await conn.send(`cd maintenance`);

      turnOff = await conn.exec(
        `reboot slot ${slot} pon ${pon} onulist ${onuId}`,
        { timeout: 1000 }
      );

      console.log("Turn off " + turnOff);

      if (turnOff === "reset onu ok!") {
        res.status(200).json({
          respostaTelnet: "ONU reiniciada com sucesso: " + turnOff,
        });
        return;
      }

      res.status(200).json({
        respostaTelnet: "ONU reiniciada com sucesso: " + turnOff,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Erro ao reiniciar ONU" });
    }
  };

  executarSSH = async (host: string, comando: string): Promise<string> => {
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
  };

  async buscarOnuIdPorMac(
    conn: Telnet,
    comando: string,
    snClienteRaw: string
  ): Promise<string> {
    try {
      const snCliente = this.normalizeMac(snClienteRaw);
      return await new Promise<string>(async (resolve, reject) => {
        let buffer = "";
        const processadas = new Set<string>();
        let encontrou = false;

        const onData = (data: Buffer) => {
          if (encontrou) return;

          const texto = data.toString();
          buffer += texto;

          const linhas = texto
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);

          for (const linha of linhas) {
            if (processadas.has(linha)) continue;
            processadas.add(linha);

            const partes = linha.split(/\s+/);
            if (partes.length < 3) continue;

            const id = partes[0];
            let snRaw = partes[2];
            const sn = this.normalizeMac(snRaw);

            if (!/^\d+$/.test(id)) continue; // ignora cabeçalhos ou mensagens de sistema

            if (sn === snCliente) {
              encontrou = true;
              this.onuId = id;
              conn.removeListener("data", onData);
              conn.send("\x03");
              return resolve(this.onuId);
            }
          }

          if (!encontrou && buffer.includes("Press any key")) {
            buffer = "";
            conn.send("\n");
          } else if (!encontrou && buffer.includes("Admin\\onu#")) {
            conn.removeListener("data", onData);
            resolve("");
          }
        };

        try {
          conn.on("data", onData);
          await conn.send(comando);
        } catch (e) {
          conn.removeListener("data", onData);
          reject(e);
        }
      });
    } catch (error) {
      //console.log(error);
      return "";
    }
  }

  mikrotik = async (req: Request, res: Response) => {
    try {
      const testes = {
        ping: "",
        fr: "",
        velocidade: "",
      };

      const { pppoe } = req.body;
      const ClientesRepository = MkauthSource.getRepository(ClientesEntities);
      const User = await ClientesRepository.findOne({
        where: { login: pppoe, cli_ativado: "s" },
        order: { id: "ASC" },
      });

      if (!User) {
        res.status(404).json({ erro: "Usuário não encontrado ou sem IP." });
        return;
      }

      let ipCliente = "";
      const resultados = [];

      for (const servidor of servidores) {
        try {
          //console.log("VERIFICANDO PPPoE ATIVO NO SERVIDOR:", servidor.nome);

          const comando = `/ppp active print where name="${pppoe}"`;
          const resposta = await this.executarSSH(servidor.host!, comando);

          // Verifica se há linha com "pppoe" e "address=" (ou IP no formato comum)
          const ativo = /pppoe\s+\S+\s+([0-9]{1,3}\.){3}[0-9]{1,3}/.test(
            resposta
          );

          resultados.push({
            servidor: servidor.nome,
            encontrado: ativo,
            host: servidor.host,
            resposta,
          });

          if (ativo) {
            const comando = `/ppp active print without-paging detail where name=${pppoe}`;
            const resposta = await this.executarSSH(servidor.host!, comando);

            const regex =
              /name="([^"]+)"\s+service=pppoe\s+caller-id="([0-9A-F:]+)"\s+address=([\d.]+)\s+uptime=([\dhms]+)/i;

            const match = regex.exec(resposta);

            if (match) {
              const nome = match[1];
              const callerId = match[2];
              const ipCliente = match[3]; // 🎯 aqui está o IP do cliente
              const uptime = match[4];

              console.log({ nome, callerId, ipCliente, uptime });
            }
            break;
          }
        } catch (err: any) {
          resultados.push({
            servidor: servidor.nome,
            erro: err.message || "Erro desconhecido",
          });
        }
      }

      const primeiro = resultados.find((r) => r.encontrado);

      if (!primeiro || !primeiro.host) {
        res.status(500).json();
      }

      if (primeiro && primeiro.host) {
        this.clientIp = ipCliente;
        const ipDoServidor = primeiro.host;
        this.serverIp = ipDoServidor;

        //console.log("VERSAO");
        const versaoMikrotik = `/system resource print`;

        const respostaversaoMikrotik = await this.executarSSH(
          this.serverIp,
          versaoMikrotik
        );

        let versao = "";
        const lines = respostaversaoMikrotik.split("\n");

        for (const linha of lines) {
          if (linha.toLowerCase().includes("version:")) {
            versao = linha.split(":")[1].trim();
            break;
          }
        }

        this.versao = versao;
        this.versao = parseInt(this.versao.split(".")[0]);

        let conectado = false;

        const conectadoComand = `/ppp active print where address="${ipCliente}"`;

        const conectadoResposta = await this.executarSSH(
          ipDoServidor,
          conectadoComand
        );

        if (this.versao >= 7) {
          if (conectadoResposta.includes(ipCliente)) {
            conectado = true;
          }
        } else if (this.versao <= 6) {
          if (conectadoResposta.includes(ipCliente)) {
            conectado = true;
          }
        }

        //console.log(versao);

        //console.log("PING IP");
        const outroComando = `/ping ${ipCliente} count=1`;
        const respostaPing = await this.executarSSH(ipDoServidor, outroComando);

        const linhaPing = respostaPing
          .split("\n")
          .find((linha) => linha.trim().startsWith("0"));

        if (linhaPing) {
          const partes = linhaPing.trim().split(/\s+/); // separa por espaços múltiplos

          const size = partes[2]; // coluna SIZE
          const ttl = partes[3]; // coluna TTL
          const time = partes[4]; // coluna TIME

          testes.ping = `SIZE ${size} / TTL ${ttl} / TIME ${time}`;
        }

        //console.log("FRAGMENT");
        const comandoFragment = `/ping address=${ipCliente} size=1492 do-not-fragment count=1`;

        const respostaFragment = await this.executarSSH(
          ipDoServidor,
          comandoFragment
        );

        //console.log(respostaFragment);

        let statusFragment = "";
        const linhas = respostaFragment.trim().split("\n").reverse();

        for (const linha of linhas) {
          const partes = linha.trim().split(/\s{2,}|\t+/);

          if (
            linha.toLowerCase().includes("fragmentation") ||
            linha.toLowerCase().includes("packet too large")
          ) {
            statusFragment = partes.slice(1).join(" ");
            break;
          }
        }

        if (!statusFragment || statusFragment.trim() === "") {
          testes.fr = "Sem Fragmentação";
        } else {
          testes.fr = statusFragment;
        }

        let comandoBuffer = "";

        if (this.versao <= 6) {
          comandoBuffer = `ping address=${ipCliente} interval=0.01 size=30000 count=500`;
        } else if (this.versao >= 7) {
          comandoBuffer = `/tool ping ${ipCliente} size=30000 interval=0.01 count=500`;
        }

        //console.log("BUFFER");
        const respostaBuffer = await this.executarSSH(
          ipDoServidor,
          comandoBuffer
        );

        // //console.log(respostaBuffer);

        const comandoVelocidade = `/interface monitor-traffic <pppoe-${pppoe}> duration=1`;

        const respostaVelocidade = await this.executarSSH(
          ipDoServidor,
          comandoVelocidade
        );

        const linhasVelocidade = respostaVelocidade.split("\n");

        let rx = "";
        let tx = "";

        for (const linha of linhasVelocidade) {
          const l = linha.trim();

          if (l.startsWith("rx-bits-per-second:")) {
            rx = l.split(":")[1].trim(); // ex: "49.7kbps"
          }

          if (l.startsWith("tx-bits-per-second:")) {
            tx = l.split(":")[1].trim(); // ex: "4.8Mbps"
          }
        }

        testes.velocidade = `⬇️ ${tx} / ⬆️ ${rx}`;

        res.status(200).json({
          tests: testes,
          conectado: conectado,
        });
        return;
      }
    } catch (error) {
      console.error("Erro geral:", error);
      res.status(500).json({ erro: "Erro interno." });
    }
  };

  mikrotikTempoReal = async (req: Request, res: Response) => {
    try {
      const { pppoe } = req.body;
      const tempoReal = {
        tmp_tx: 0,
        tmp_rx: 0,
      };

      if (this.serverIp) {
        ("TEMPO REAL");
        const comandoVelocidade = `/interface monitor-traffic <pppoe-${pppoe}> duration=5`;

        const respostaVelocidade = await this.executarSSH(
          this.serverIp,
          comandoVelocidade
        );

        const linhasVelocidade = respostaVelocidade.split("\n");

        let rx = "";
        let tx = "";

        for (const linha of linhasVelocidade) {
          const l = linha.trim();

          if (l.startsWith("rx-bits-per-second:")) {
            rx = l.split(":")[1].trim(); // ex: "49.7kbps"
          }

          if (l.startsWith("tx-bits-per-second:")) {
            tx = l.split(":")[1].trim(); // ex: "4.8Mbps"
          }
        }

        tempoReal.tmp_tx = this.parseBitsPerSecond(tx);
        tempoReal.tmp_rx = this.parseBitsPerSecond(rx);

        if (
          typeof tempoReal.tmp_tx !== "number" &&
          typeof tempoReal.tmp_rx !== "number"
        ) {
          res.status(500).json();
        }

        res.status(200).json({ tmp: tempoReal });
      } else {
        res.status(500).json({ erro: "Erro interno." });
      }
    } catch (error) {
      console.error("Erro geral:", error);
      res.status(500).json({ erro: "Erro interno. " + error });
    }
  };

  parseBitsPerSecond(valor: string): number {
    if (!valor) return 0;

    const match = valor.toLowerCase().match(/([\d.]+)\s*(kbps|mbps|bps)/);
    if (!match) return 0;

    const num = parseFloat(match[1]);
    const unidade = match[2];

    switch (unidade) {
      case "mbps":
        return num;
      case "kbps":
        return num / 1000;
      case "bps":
        return num / 1_000_000;
      default:
        return 0;
    }
  }
}

export default new ClientAnalytics();
