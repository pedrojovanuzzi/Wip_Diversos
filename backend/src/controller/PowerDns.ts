import { Request, Response } from "express";
import { extrairDominios, inserirDominios } from "../utils/createDns";
import path from "path";

const PATH = path.join(__dirname, "..", "..", "uploads", "DnsPdf.pdf");

class PowerDNS {
  public async inserirPdf(req: Request, res: Response) {
    this.transformarPdf(req, res);
  }

  public async inserirDominio(req: Request, res: Response): Promise<void> {
    try {
      const { dominio } = req.body;

      if (!dominio || typeof dominio !== "string") {
        res
          .status(400)
          .json({ error: "O domínio é obrigatório e deve ser um texto." });
        return;
      }

      const dominioAInserir = dominio.toLowerCase().replace(/\.+$/, "") + ".";
      const response = await inserirDominios([dominioAInserir]);

      res.status(200).json({ message: response });
    } catch (error) {
      console.error("Erro ao inserir domínio:", error);
      res.status(500).json({ error: "Erro interno ao inserir o domínio." });
    }
  }

  private async transformarPdf(req: Request, res: Response) {
    const dominiosExtraidos = await extrairDominios(PATH);
    const response = await inserirDominios(dominiosExtraidos);
    res.status(200).json({ message: response });
  }
}

export default PowerDNS;
