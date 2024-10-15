import { Request, Response } from 'express';

class Home{
    public show( req : Request, res : Response){
        res.json("Initial Page");
      }
}

export default new Home();