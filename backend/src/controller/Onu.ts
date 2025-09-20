import { Request, Response } from "express";
import { Telnet } from "telnet-client";

class Onu {
  private ip = String(process.env.OLT_IP);
  private login = String(process.env.OLT_LOGIN);
  private password = String(process.env.OLT_PASSWORD);

  public onuAuthentication = async (req: Request, res: Response) => {
    const {sn, vlan} = req.body;
    const conn = await this.telnetStart(this.ip, this.login, this.password);
    if (!conn) {
      res.status(500).json("Erro No Telnet");
      return;
    }
    try {
      await conn.send("cd onu");
      const onuInfo = await this.querySnHelper(sn);

      console.log(onuInfo, vlan);
      

      res.status(200).json(onuInfo);
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
      if (!slot || !pon) {
        res.status(500).json("Slot ou Pon Vazios");
        return;
      }

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

  public onuShowAuth = async (req: Request, res: Response) => {
    const conn = await this.telnetStart(this.ip, this.login, this.password);
    if (!conn) {
      res.status(500).json("Erro No Telnet");
      return;
    }
    try {
      await conn.send("cd onu");

      const query = await conn.exec(`show unauth`, {
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

  public querySn = async (req: Request, res: Response) => {
    const { sn } = req.body;
    const conn = await this.telnetStart(this.ip, this.login, this.password);
    if (!conn) {
      res.status(500).json("Erro No Telnet");
      return;
    }
    try {
      await conn.send("cd onu");

      const query = await conn.exec(`show onu-info by ${sn}`, {
        execTimeout: 30000,
        stripControls: true, // remove caracteres de controle
        maxBufferLength: 10 * 1024, // aumenta limite do buffer (10KB ou mais)
      });

      // divide a saída em linhas
      const lines = query;

      const match = lines.match(/-----\s+(\d+)\s+(\d+)\s+(\d+)/);

      let slot,
        pon,
        onuNumber = "";

      if (match) {
        slot = match[1]; // "11"
        pon = match[2]; // "5"
        onuNumber = match[3];
      }

      // console.log("Resultado final:", onus);
      const slotPon = `${slot}0${pon}`;

      if (!slot || !pon || !conn || !sn) {
        console.error("Campos ausentes");
        res.status(500).json("Campos ausentes");
        return;
      }

      const model = await this.filterByMacOnu(
        conn,
        sn,
        slot as string,
        pon as string
      );


      res.status(200).json({ slotPon: slotPon, onuid: onuNumber, sn: sn, model: model?.model });
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
    } finally {
      conn.end();
    }
  };

  public querySnHelper = async (sn : string) => {
    const conn = await this.telnetStart(this.ip, this.login, this.password);
    if (!conn) {
      return;
    }
    try {
      await conn.send("cd onu");

      const query = await conn.exec(`show onu-info by ${sn}`, {
        execTimeout: 30000,
        stripControls: true, // remove caracteres de controle
        maxBufferLength: 10 * 1024, // aumenta limite do buffer (10KB ou mais)
      });

      // divide a saída em linhas
      const lines = query;

      const match = lines.match(/-----\s+(\d+)\s+(\d+)\s+(\d+)/);

      let slot,
        pon,
        onuNumber = "";

      if (match) {
        slot = match[1]; // "11"
        pon = match[2]; // "5"
        onuNumber = match[3];
      }

      // console.log("Resultado final:", onus);
      const slotPon = `${slot}0${pon}`;

      if (!slot || !pon || !conn || !sn) {
        console.error("Campos ausentes");
        return;
      }

      const model = await this.filterByMacOnu(
        conn,
        sn,
        slot as string,
        pon as string
      );

      return model;

    } catch (error) {
      console.error(error);
    } finally {
      conn.end();
    }
  };

  private async filterByMacOnu(
    conn: Telnet,
    sn: string,
    slot: string,
    pon: string
  ) {
    try {
      const query = await conn.exec(`show online slot ${slot} pon ${pon}`, {
        execTimeout: 30000,
        stripControls: true,
        maxBufferLength: 10 * 1024,
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

      const found = onus.find(
        (onu) => onu.sn.toUpperCase() === sn.toUpperCase()
      );

      if (found) {
        console.log("✅ ONU encontrada:", found);
        return found;
      } else {
        console.warn("⚠️ SN não encontrado:", sn);
        return null;
      }
    } catch (error) {
      console.error("❌ Erro no filterByMacOnu:", error);
      return null;
    }
  }

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
