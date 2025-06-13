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

class ClientAnalytics {
  info = async (req: Request, res: Response) => {
    try {
      const { pppoe } = req.body;
      const ClientesRepository = MkauthSource.getRepository(ClientesEntities);
      let User = await ClientesRepository.find({
        where: { login: pppoe, cli_ativado: "s" },
      });

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
      console.log(error);
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
      console.log(error);
    }
  };

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

      const conn = new Telnet();

      // 🟡 Eventos para log no terminal
      conn.on("data", (data) => {
        buffer = data.toString();
        // console.log(buffer);
      });

      let buffer = "";

      const params = {
        host: ip,
        port: 23,
        timeout: 10000,
        sendTimeout: 200,
        debug: true,
        shellPrompt: /Admin[#>]\s*$/, // Prompt correto após login
        stripShellPrompt: true,
        negotiationMandatory: false,
        disableLogon: true, // impede tentativa automática de login
      };

      await conn.connect(params);

      await conn.send(login);

      await conn.send(password);

      await conn.send("en");
      await conn.send(password);

      await conn.send("cd onu");

      await conn.send(
        `show optic_module slot ${User?.porta_olt?.substring(
          0,
          2
        )} pon ${User?.porta_olt?.substring(2, 4)} onu ${User?.onu_ont}`
      );

      const output = buffer.split("Admin\\onu#")[0].trim();

      if (/onu#\s*$/i.test(output)) {
        res.status(200).json({ respostaTelnet: "ONU APAGADA" });
        return;
      }

      await conn.end();

      res.status(200).json({ respostaTelnet: output });
    } catch (error) {
      console.error("❌ Erro Telnet:", error);
      res.status(500).json({
        erro: "Falha ao executar comando Telnet",
        detalhes: String(error),
      });
    }
  };

 mikrotik = async (req: Request, res: Response) => {
    try {
      const { pppoe } = req.body;

      const ClientesRepository = MkauthSource.getRepository(ClientesEntities);
      const User = await ClientesRepository.findOne({
        where: { login: pppoe, cli_ativado: "s" },
        order: { id: "ASC" },
      });

      if (!User || !User.ip) {
        return res.status(404).json({ erro: "Usuário não encontrado ou sem IP." });
      }

      


    } catch (error) {
      console.error("Erro ao consultar Mikrotik:", error);
      res.status(500).json({ erro: "Erro interno ao testar conexão com cliente." });
    }
  };
}

export default new ClientAnalytics();
