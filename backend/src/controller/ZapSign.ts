import axios from "axios";
import { Request, Response } from "express";
const homologacao = process.env.SERVIDOR_HOMOLOGACAO;

class ZapSign {
  async generatePdfContratacao(req: Request, res: Response) {
    try {
      const data = req.body;
      const response = await axios.post(
        homologacao
          ? "https://sandbox.api.zapsign.com.br/api/v1/models/create-doc/"
          : "https://api.zapsign.com.br/api/v1/models/create-doc/",
        data,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ZAPSIGN_TOKEN}`,
          },
        },
      );
      res.status(200).json(response.data);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }
}

export default new ZapSign();
