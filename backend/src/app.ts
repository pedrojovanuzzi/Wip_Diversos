import express from "express";
import ChamadosRouter from './routes/Chamados.Routes'; // Caminho correto para o arquivo de rotas

export class App{
  public server: express.Application;

  constructor(){
    this.server = express();
    this.middleware();
    this.router();
  }

  private middleware(){
    this.server.use(express.json());
  }

  private router(){
    this.server.use("/chamados", ChamadosRouter);
  }
}