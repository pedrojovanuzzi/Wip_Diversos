import { Request, Response } from 'express';

class Chamados {
  public home( req : Request, res : Response){
    res.send("feef");
  }
}


export default new Chamados();