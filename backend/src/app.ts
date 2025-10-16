import 'reflect-metadata';
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
import DosProtect from './routes/DosProtect.Routes';
import DosProtectController from './controller/DosProtect';
import ServerLogs from "./routes/ServerLogs.Routes";
import PowerDNS from './routes/PowerDns.routes';
import Onu from './routes/Onu.routes';
import BackupRoutes from './routes/Backup.routes';
import PixRoutes from './routes/Pix.routes';
const backup = new Backup();
import session from "express-session";
import flash from "connect-flash";


export class App {
  public server: express.Application;

  constructor() {
    this.server = express();
    this.middleware();
    this.router();
    this.agendarBackup();
    // this.verificaDDOS();
  }

  private middleware() {
    this.server.use(express.json());
    this.server.use(express.urlencoded({ extended: true }));
    this.server.use(cors({ origin: process.env.URL }));
  }

  private router() {
    this.server.use("/api/chamados", ChamadosRouter);
    this.server.use("/api/", Home);
    this.server.use("/api/auth", Auth);
    this.server.use("/api/feedback", Feed);
    this.server.use("/api/Nfe", NFSE);
    this.server.use("/api/whatsapp", Whatsapp);
    this.server.use("/api/Prefeitura", Prefeitura);
    this.server.use("/api/ClientAnalytics", ClientAnalytics);
    this.server.use("/api/DosProtect", DosProtect);
    this.server.use("/api/ServerLogs", ServerLogs);
    this.server.use("/api/PowerDns", PowerDNS);
    this.server.use("/api/Onu", Onu);
    this.server.use("/api/Backup", BackupRoutes);
    this.server.use("/api/Pix", PixRoutes);
  }

  private agendarBackup() {
    // 🕒 Agendar para todo dia às 03:00
    cron.schedule("0 3 * * *", async () => {
      console.log("⏰ Executando backup automático", new Date().toLocaleString());
      try {
        await backup.gerarTodos();
      } catch (err) {
        console.error("❌ Falha no backup agendado:", err);
      }
    });

    console.log("📅 Agendador de backup inicializado.");
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
