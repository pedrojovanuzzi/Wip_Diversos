import { Request, Response } from "express";

class Nfe {
  async create(req : Request, res : Response) {
    res.status(200).json({"test" : "t"});
    return;
  }
}

export default new Nfe();
