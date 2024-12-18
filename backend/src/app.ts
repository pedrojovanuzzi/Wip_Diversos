import express from "express";
import ChamadosRouter from './routes/Chamados.Routes'; // Caminho correto para o arquivo de rotas
import Home from "./routes/Home.Routes";
import Auth from "./routes/Auth.Routes";
import cors from "cors";
import Feed from "./routes/Feedback.routes";
import NFSE from "./routes/NFSE.routes";

export class App{
  public server: express.Application;

  constructor(){
    this.server = express();
    this.middleware();
    this.router();
  }

  private middleware(){
    this.server.use(express.json());
    this.server.use(cors({origin: process.env.URL}));
  }

  private router(){
    this.server.use("/api/chamados", ChamadosRouter);
    this.server.use("/api/", Home);
    this.server.use("/api/auth", Auth);
    this.server.use("/api/feedback", Feed);
    this.server.use("/api/Nfe", NFSE);
  }
}