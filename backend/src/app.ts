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

export class App {
  public server: express.Application;

  constructor() {
    this.server = express();
    this.middleware();
    this.router();
    this.agendarBackup();
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
  }

  private agendarBackup() {
    // 🕒 Agendar para todo dia às 03:00
    cron.schedule("* * * * *", async () => {
      console.log("⏰ Executando backup automático", new Date().toLocaleString());
      try {
        await Backup.gerarTodos();
      } catch (err) {
        console.error("❌ Falha no backup agendado:", err);
      }
    });

    console.log("📅 Agendador de backup inicializado.");
  }

}
