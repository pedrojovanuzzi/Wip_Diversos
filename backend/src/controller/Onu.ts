import { Request, Response } from "express";
import { Telnet } from "telnet-client";

type WifiData = {
  pppoe: string;
  senha_pppoe: string;
  wifi_2ghz: string;
  wifi_5ghz: string;
  canal: string;
  senha_wifi: string;
};

class Onu {
  private ip = String(process.env.OLT_IP);
  private login = String(process.env.OLT_LOGIN);
  private password = String(process.env.OLT_PASSWORD);

  public onuAuthenticationBridge = async (req: Request, res: Response) => {
    const { sn, vlan, cos } = req.body;
    const conn = await this.telnetStart(this.ip, this.login, this.password);
    if (!conn) {
      res.status(500).json("Erro No Telnet");
      return;
    }
    try {
      await conn.send("cd onu");

      const onuInfo = await this.querySnHelper(sn);

      // executa o comando na OLT e captura a saída completa
      const output = await conn.exec(
        `show onu slot ${onuInfo?.slot} pon ${onuInfo?.pon} onulist all`,
        { execTimeout: 30000 }
      );

      const response = this.nextOnu(output);

      await conn.exec(
        `set whitelist phy_addr address ${onuInfo?.sn} password null action add slot ${onuInfo?.slot} pon ${onuInfo?.pon} onu ${response?.nextOnu} type ${onuInfo?.model}`,
        { execTimeout: 30000 }
      );

      if (!onuInfo?.slot || !onuInfo?.pon) {
        return;
      }

      const onuAuth = await this.filterByMacOnu(
        conn,
        sn,
        onuInfo?.slot,
        onuInfo?.pon
      );

      await conn.send("cd lan");

      await conn.exec(
        `set epon slot ${onuInfo?.slot} pon ${onuInfo?.pon} onu ${
          onuAuth?.onuid ?? response?.nextOnu
        } port 1 service number 1`,
        { execTimeout: 30000 }
      );

      await conn.exec(
        `set epon slot ${onuInfo?.slot} pon ${onuInfo?.pon} onu ${
          onuAuth?.onuid ?? response?.nextOnu
        } port 1 service 1 vlan_mode tag ${cos} 33024 ${vlan}`,
        { execTimeout: 30000 }
      );

      await conn.exec(
        `apply onu ${onuInfo?.slot} ${onuInfo?.pon} ${
          onuAuth?.onuid ?? response?.nextOnu
        } vlan`
      );

      res.status(200).json(onuInfo);
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
    } finally {
      conn.end();
    }
  };

  public onuAuthenticationWifi = async (req: Request, res: Response) => {
    const { sn, vlan, cos, wifiData} = req.body;
    const conn = await this.telnetStart(this.ip, this.login, this.password);
    if (!conn) {
      res.status(500).json("Erro No Telnet");
      return;
    }
    try {
      await conn.send("cd onu");

      const onuInfo = await this.querySnHelper(sn);

      // executa o comando na OLT e captura a saída completa
      const output = await conn.exec(
        `show onu slot ${onuInfo?.slot} pon ${onuInfo?.pon} onulist all`,
        { execTimeout: 30000 }
      );

      const response = this.nextOnu(output);

      await conn.exec(
        `set whitelist phy_addr address ${onuInfo?.sn} password null action add slot ${onuInfo?.slot} pon ${onuInfo?.pon} onu ${response?.nextOnu} type ${onuInfo?.model}`,
        { execTimeout: 30000 }
      );

      if (!onuInfo?.slot || !onuInfo?.pon) {
        return;
      }

      const onuAuth = await this.filterByMacOnu(
        conn,
        sn,
        onuInfo?.slot,
        onuInfo?.pon
      );

      const wifiDataTyped = wifiData as WifiData;

      

      await conn.send("cd lan");

      await conn.exec(`set wancfg slot ${onuInfo.slot} ${onuInfo.pon} ${onuAuth?.onuid ?? response?.nextOnu} index 1 mode internet type route ${vlan} ${cos} nat enable qos disable dsp pppoe proxy disable ${wifiDataTyped.pppoe} ${wifiDataTyped.senha_pppoe} null auto entries 6 fe1 fe2 fe3 fe4 ssid1 ssid5`,
      {execTimeout: 30000});

      await conn.exec(`apply wancfg slot ${onuInfo.slot} ${onuInfo.pon} ${onuAuth?.onuid ?? response?.nextOnu}`,
      {execTimeout: 30000});

      await conn.exec(`set wancfg sl ${onuInfo.slot} ${onuInfo.pon} ${onuAuth?.onuid ?? response?.nextOnu} ind 1 ip-stack-mode both ipv6-src-type slaac prefix-src-type delegate`,
      {execTimeout: 30000});

      await conn.exec(`apply wancfg slot ${onuInfo.slot} ${onuInfo.pon} ${onuAuth?.onuid ?? response?.nextOnu}`,
      {execTimeout: 30000});

      await conn.exec(`set wifi_serv_wlan slot ${onuInfo.slot} pon ${onuInfo.pon} onu ${onuAuth?.onuid ?? response?.nextOnu} serv_no 1 index 1 ssid enable ${wifiDataTyped.wifi_2ghz} hide disable authmode wpa2psk encrypt_type tkipaes wpakey ${wifiDataTyped.senha_wifi} interval 0 radius_serv ipv4 0.0.0.0 port 65535 pswd null wapi_serv_addr 0.0.0.0 0 wifi_connect_num 32`,
      {execTimeout: 30000});

      await conn.exec(`set wifi_serv_cfg slot ${onuInfo.slot} pon ${onuInfo.pon} onu ${onuAuth?.onuid ?? response?.nextOnu} serv_no 1 wifi enable district brazil channel ${wifiDataTyped.canal} standard 802.11bgn txpower 20 frequency 2.4ghz freq_bandwidth 20mhz/40mhz`,
      {execTimeout: 30000});

      await conn.exec(`set wifi_serv_wlan slot ${onuInfo.slot} pon ${onuInfo.pon} onu ${onuAuth?.onuid ?? response?.nextOnu} serv_no 2 index 1 ssid enable ${wifiDataTyped.wifi_5ghz} hide disable authmode wpa2psk encrypt_type tkipaes wpakey ${wifiDataTyped.senha_wifi} interval 0 wapi_serv_addr 0.0.0.0 0 wifi_connect_num 32`,
      {execTimeout: 30000});

      await conn.exec(`set wifi_serv_cfg slot ${onuInfo.slot} pon ${onuInfo.pon} onu ${onuAuth?.onuid ?? response?.nextOnu} serv_no 2 wifi enable district brazil channel 36 standard 802.11ac txpower 20 frequency 5.8ghz freq_bandwidth 80mhz`,
      {execTimeout: 30000});

      await conn.send("cd ..");

     await conn.exec(`set onu_local_manage_config slot ${onuInfo.slot} pon ${onuInfo.pon} onu ${onuAuth?.onuid ?? response?.nextOnu} config_enable_switch enable console_switch enable telnet_switch disable web_switch enable web_port 29189 web_ani_switch enable tel_ani_switch disable web_admin_switch enable`,
  { execTimeout: 30000 }
);


      res.status(200).json(onuInfo);
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
    } finally {
      conn.end();
    }
  };

  private nextOnu(output: string) {
    try {
      // remove mensagens "Press any key..." e espaços extras
      const cleaned = output
        .replace(/--Press any key to continue Ctrl\+c to stop--/g, "")
        .trim();

      // divide a saída em linhas
      const lines = cleaned.split("\n");

      // aplica regex para capturar o número da ONU (ex.: "SLOT 13 PON 14 ONU  57 status : active.")
      const onuNumbers = lines
        .map((line) => {
          const match = line.match(/ONU\s+(\d+)\s+status/i);
          return match ? parseInt(match[1], 10) : null;
        })
        .filter((n): n is number => n !== null); // remove nulls

      // pega o maior número de ONU (último da lista, mesmo que não seja sequencial)
      const lastOnu = Math.max(...onuNumbers);

      // incrementa +1 para saber o próximo disponível
      const nextOnu = lastOnu + 1;
      return { nextOnu, lastOnu };
    } catch (error) {
      console.error(error);
    }
  }

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
          slotPon: parts[parts.length - 1].replace('/', ''),
        };
      });

      console.log("Resultado final:", onus);

      res.status(200).json(onus);
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
    } finally {
      conn.end();
    }
  };

  // função para procurar uma ONU no "show unauth" pelo SN
  private async getOnuFromUnauth(conn: any, sn: string) {
    // executa o comando e pega a saída
    const output = await conn.exec("show unauth", { execTimeout: 30000 });

    // remove textos de paginação e quebra em linhas
    const cleaned = output
      .replace(/--Press any key to continue Ctrl\+c to stop--/g, "")
      .trim();
    const lines = cleaned.split("\n");

    // percorre cada linha em busca do SN
    for (const line of lines) {
      if (line.includes(sn)) {
        // quebra a linha em colunas
        const parts = line.trim().split(/\s+/);

        // segunda coluna é o modelo (OnuType)
        const model = parts[1] || "Desconhecido";

        // tenta extrair SLOT, PON e ONU (se houver no formato da linha)
        const match = line.match(/SLOT\s+(\d+)\s+PON\s+(\d+)\s+ONU\s+(\d+)?/i);

        const slot = match ? match[1] : undefined;
        const pon = match ? match[2] : undefined;
        const onuNumber = match ? match[3] || "Desconhecido" : undefined;

        return {
          slot,
          pon,
          model,
        };
      }
    }

    // se não encontrar nada, retorna null
    return null;
  }

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
      const onus = await Promise.all(
        cleaned.map(async (line) => {
          const parts = line.trim().split(/\s+/);

          const onuid = parts[0];
          const model = parts[1];
          const sn = parts[2];

          // busca slot/pon no show onu-info
          const onuInfo = await this.querySnHelper(sn); // sua função que extrai slot/pon/onuNumber/state

          let slotPon = undefined;
          let finalModel = model;

          if (onuInfo?.slot && onuInfo?.pon) {
            slotPon = `${onuInfo.slot}${onuInfo.pon}`;
          }

          // se for UnAuth, pega o modelo certo do show unauth
          if (onuInfo?.state === "UnAuth") {
            const extraInfo = await this.getOnuFromUnauth(conn, sn);
            if (extraInfo?.model) {
              finalModel = extraInfo.model;
            }
          }

          return {
            onuid,
            sn,
            model: finalModel,
            slotPon,
          };
        })
      );

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

      const match = lines.match(
        /-----\s+(\d+)\s+(\d+)(?:\s+(\d+))?\s+(Auth|UnAuth)\s*-+/i
      );

      let slot,
        pon,
        onuNumber,
        state = "";

      if (match) {
        slot = match[1]; // exemplo: "11"
        pon = match[2]; // exemplo: "1"
        onuNumber = match[3] || "Desconhecido"; // pode estar vazio
        state = match[4]; // "Auth" ou "UnAuth"
      } else {
        console.error("❌ Não consegui casar a linha com regex");
        res.status(500).json("Erro no parse do show onu-info");
        return;
      }

      // console.log("Resultado final:", onus);
      const slotPon = `${slot}${pon}`;

      if (!slot || !pon || !conn || !sn || !state) {
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

      res.status(200).json({
        slotPon: slotPon,
        onuid: onuNumber,
        sn: sn,
        model: model?.model,
        state: state,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
    } finally {
      conn.end();
    }
  };

  public querySnHelper = async (sn: string) => {
    const conn = await this.telnetStart(this.ip, this.login, this.password);
    if (!conn) return;

    try {
      await conn.send("cd onu");

      // 1. consulta no onu-info
      const query = await conn.exec(`show onu-info by ${sn}`, {
        execTimeout: 30000,
        stripControls: true,
        maxBufferLength: 10 * 1024,
      });

      console.log("query", query);

      let slot: string | undefined;
      let pon: string | undefined;
      let onuNumber: string | undefined;
      let state = "";

      // tenta AUTH
      let match = query.match(
        /-----\s+(\d+)\s+(\d+)\s+(\d+)\s+(Auth|UnAuth)\s*-+/i
      );
      if (match) {
        slot = match[1];
        pon = match[2];
        onuNumber = match[3];
        state = match[4];
      } else {
        // tenta UNAUTH (sem ONU number)
        match = query.match(/-----\s+(\d+)\s+(\d+)\s+(Auth|UnAuth)\s*-+/i);
        if (match) {
          slot = match[1];
          pon = match[2];
          onuNumber = "Desconhecido";
          state = match[3];
        }
      }

      if (!slot || !pon) {
        console.error("❌ Não consegui extrair slot/pon");
        return;
      }

      let model: string | undefined = undefined;

      // 2. se for UnAuth, buscar modelo no "show unauth"
      if (state === "UnAuth") {
        const unauthOutput = await conn.exec("show unauth", {
          execTimeout: 30000,
        });

        const lines = unauthOutput.split("\n");
        for (const line of lines) {
          if (line.includes(sn)) {
            const parts = line.trim().split(/\s+/);
            model = parts[1] || "Desconhecido"; // segunda coluna = OnuType
            break;
          }
        }
      }

      console.log(slot, pon, onuNumber, sn, state, model);

      // objeto final
      return {
        slot,
        pon,
        onuNumber,
        sn,
        state,
        model,
      };
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

      console.log("Query: " + query);

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
