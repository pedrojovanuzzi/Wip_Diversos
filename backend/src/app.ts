import "reflect-metadata";
import express from "express";

import ChamadosRouter from "./routes/Chamados.Routes"; // Caminho correto para o arquivo de rotas
import Home from "./routes/Home.Routes";
import Auth from "./routes/Auth.Routes";
import cors from "cors";
import Feed from "./routes/Feedback.routes";
import NFSE from "./routes/NFSE.routes";
import Whatsapp from "./routes/Whatsapp.Routes";
import Prefeitura from "./routes/PrefeituraUser.routes";
import ClientAnalytics from "./routes/ClientAnalytics.routes";
import cron from "node-cron";
import Backup from "./controller/Backup"; // Caminho para sua classe de backup
import DosProtect from "./routes/DosProtect.Routes";
import DosProtectController from "./controller/DosProtect";
import ServerLogs from "./routes/ServerLogs.Routes";
import PowerDNS from "./routes/PowerDns.routes";
import Onu from "./routes/Onu.routes";
import BackupRoutes from "./routes/Backup.routes";
import PixRoutes from "./routes/Pix.routes";
import Pix from "./controller/Pix";
import NFCom from "./routes/NFCom.routes";
import WhatsappWebHook from "./routes/WhatsappWebHook.routes";
import TokenAtendimentoRoutes from "./routes/TokenAtendimento.routes";
import TimeTrackingRoutes from "./routes/TimeTracking.routes";
import path from "path";
const backup = new Backup();
const pix = new Pix();

export class App {
  public server: express.Application;

  constructor() {
    this.server = express();
    this.middleware();
    this.router();
    this.agendarBackup();
    this.agendarPixAutomatico();
    // this.verificaDDOS();
  }

  private middleware() {
    this.server.use(express.json());
    this.server.use(express.urlencoded({ extended: true }));
    this.server.use(cors({ origin: process.env.URL }));
    this.server.use(
      "/uploads",
      express.static(path.resolve(__dirname, "..", "..", "uploads"))
    );
  }

  private router() {
    this.server.use("/api/chamados", ChamadosRouter);
    this.server.use("/api/", Home);
    this.server.use("/api/auth", Auth);
    this.server.use("/api/feedback", Feed);
    this.server.use("/api/Nfe", NFSE);
    this.server.use("/api/NFCom", NFCom);
    this.server.use("/api/whatsapp", Whatsapp);
    this.server.use("/api/whatsappWebHook", WhatsappWebHook);
    this.server.use("/api/Prefeitura", Prefeitura);
    this.server.use("/api/ClientAnalytics", ClientAnalytics);
    this.server.use("/api/DosProtect", DosProtect);
    this.server.use("/api/ServerLogs", ServerLogs);
    this.server.use("/api/PowerDns", PowerDNS);
    this.server.use("/api/Onu", Onu);
    this.server.use("/api/Backup", BackupRoutes);
    this.server.use("/api/Pix", PixRoutes);
    this.server.use("/api/TokenAutoAtendimento", TokenAtendimentoRoutes);
    this.server.use("/api/time-tracking", TimeTrackingRoutes);
  }

  private agendarBackup() {
    // 🕒 Agendar para todo dia às 03:00
    cron.schedule("0 3 * * *", async () => {
      console.log(
        "⏰ Executando backup automático",
        new Date().toLocaleString()
      );
      try {
        await backup.gerarTodos();
      } catch (err) {
        console.error("❌ Falha no backup agendado:", err);
      }
    });

    console.log("📅 Agendador de backup inicializado.");
  }

  private agendarPixAutomatico() {
    // 🕒 Agendar para todo dia às 03:00
    cron.schedule("0 3 1 * *", async () => {
      // cron.schedule("* * * * *", async () => {

      console.log("⏰ Executando Pix automático", new Date().toLocaleString());
      try {
        await pix.pegarUltimoBoletoGerarPixAutomatico();
      } catch (err) {
        console.error("❌ Falha no backup agendado:", err);
      }
    });

    console.log("📅 Agendador de Pix");
  }

  // private verificaDDOS(){
  //   console.log('Verificando DDDOS');

  //   cron.schedule("* * * * *", async () => {
  //     try {
  //       await new DosProtectController().startFunctions();
  //     } catch (err) {
  //       console.error("❌ Falha no backup agendado:", err);
  //     }
  //   });

  //   console.log("📅 Agendador de backup inicializado.");
  // }
}
