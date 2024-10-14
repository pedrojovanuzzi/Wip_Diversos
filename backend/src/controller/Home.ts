import { Request, Response } from 'express';

class Home{
    public home( req : Request, res : Response){
        res.send("feef");
      }
}

export default new Home();