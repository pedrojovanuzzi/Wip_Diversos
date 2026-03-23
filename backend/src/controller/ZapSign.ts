import axios from "axios";
import { Request, Response } from "express";

class ZapSign {
  async generatePdf(req: Request, res: Response) {
    const { data } = req.body;
    const pdfName = req.params.pdfName as string;
    console.log(pdfName);
    if (pdfName === "contratacao") {
      const response = await axios.post(
        "https://sandbox.api.zapsign.com.br/api/v1/models/create-doc/",
        data,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ZAPSIGN_TOKEN}`,
          },
        },
      );
      res.json(response.data);
    } else {
      res.status(400).json({ error: "PDF name not supported" });
    }
  }
}

export default new ZapSign();
