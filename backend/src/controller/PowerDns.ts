import { Request, Response } from "express";
import {
  extrairDominios,
  inserirDominios,
  listarDominios,
} from "../utils/createDns";
import path from "path";

const PATH = path.join(__dirname, "..", "..", "uploads", "DnsPdf.pdf");

class PowerDNS {
  public async inserirPdf(req: Request, res: Response) {
    console.log("📥 Recebida requisição para inserir PDF.");
    await this.transformarPdf(req, res);
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
    try {
      const filePath = req.file?.path;
      if (!filePath) {
        res.status(400).json({ error: "Arquivo não encontrado no upload." });
        return;
      }

      console.log(`📂 Iniciando extração de domínios do arquivo: ${filePath}`);
      const dominiosExtraidos = await extrairDominios(filePath);
      console.log(`🔍 Domínios extraídos: ${dominiosExtraidos.length}`);

      if (dominiosExtraidos.length === 0) {
        console.warn("⚠️ Nenhum domínio encontrado no arquivo.");
      }

      const response = await inserirDominios(dominiosExtraidos);
      console.log("✅ Processamento concluído com sucesso.");
      res.status(200).json({ message: response });
    } catch (error) {
      console.error("❌ Erro ao transformar arquivo:", error);
      res.status(500).json({ error: "Erro interno ao transformar o arquivo." });
    }
  }

  public async obterDominios(req: Request, res: Response): Promise<void> {
    try {
      const dominios = await listarDominios();
      res.status(200).json({ dominios });
    } catch (error) {
      console.error("Erro ao listar domínios:", error);
      res.status(500).json({ error: "Erro interno ao listar os domínios." });
    }
  }
}

export default PowerDNS;
