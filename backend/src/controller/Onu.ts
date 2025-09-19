import { Request, Response } from "express";
import { Telnet } from "telnet-client";

class Onu {
  private ip = String(process.env.OLT_IP);
  private login = String(process.env.OLT_LOGIN);
  private password = String(process.env.OLT_PASSWORD);

  public onuAuthentication = async (req: Request, res: Response) => {
    const conn = await this.telnetStart(this.ip, this.login, this.password);
    if (!conn) {
      res.status(500).json("Erro No Telnet");
      return;
    }
    try {
      conn.send("cd onu");
      const query = await conn.exec("show unauth");
      res.status(200).json(query);
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
    } finally {
      conn.end();
    }
  };

  public onuShowOnline = async (req: Request, res: Response) => {
    const conn = await this.telnetStart(this.ip, this.login, this.password);
    if (!conn) {
      res.status(500).json("Erro No Telnet");
      return;
    }
    try {
      const { slot, pon } = req.body;

      await conn.send("cd onu");

      const query = await conn.exec(`show online slot ${slot} pon ${pon}`, {
        execTimeout: 30000,
        stripControls: true, // remove caracteres de controle
        maxBufferLength: 10 * 1024, // aumenta limite do buffer (10KB ou mais)
      });

      // divide a saída em linhas
      const lines = query.split("\n");

      // limpa as mensagens "Press any key..." e espaços extras
      const cleaned = lines
        .map(
          (l) => l.replace(/--Press any key.*?stop--/g, "").trim() // remove a mensagem
        )
        .filter((l) => /^\d+/.test(l)); // mantém só linhas que começam com número (as ONUs)

      // console.log("DEBUG linhas limpas:", cleaned);

      // agora converte em objetos
      const onus = cleaned.map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          onuid: parts[0],
          model: parts[1],
          sn: parts[2],
          slotPon: parts[parts.length - 1],
        };
      });

      // console.log("Resultado final:", onus);

      res.status(200).json(onus);
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
    } finally {
      conn.end();
    }
  };

  private async telnetStart(ip: string, login: string, password: string) {
    try {
      const conn = new Telnet();

      // 🟡 Eventos para log no terminal
      conn.on("data", async (data) => {
        buffer = data.toString();
        console.log(buffer);

        if (buffer.includes("Press any key")) {
          await conn.send("\n"); // envia Enter
        }
      });

      let buffer = "";

      const params = {
        host: ip,
        port: 23,
        timeout: 30000,
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

      return conn;
    } catch (error) {
      console.log(error);
      return;
    }
  }
}

export default Onu;
