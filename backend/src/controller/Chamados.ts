import { Request, Response } from 'express';
import MkauthSource from "../database/MkauthSorce";

class Chamados {
  public show( req : Request, res : Response){
    res.json("Chamados Page");
  }
}


export default new Chamados();