import express from "express";
import ChamadosRouter from './routes/Chamados.Routes'; // Caminho correto para o arquivo de rotas
import Home from "./routes/Home.Routes";
import Auth from "./routes/Auth.Routes";
import cors from "cors";

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
    this.server.use("/chamados", ChamadosRouter);
    this.server.use("/", Home);
    this.server.use("/auth", Auth);
  }
}