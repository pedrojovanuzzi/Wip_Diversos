import { Request, Response } from "express";
import ApiMkDataSource from "../database/API_MK";
import ZapSignTemplates from "../entities/APIMK/ZapSignTemplates";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const homologacao = process.env.SERVIDOR_HOMOLOGACAO;

export default class ZapSignTemplatesController {
  async listar(req: Request, res: Response) {
    try {
      const templatesRepository = ApiMkDataSource.getRepository(ZapSignTemplates);
      const templates = await templatesRepository.find();
      const response = templates.map((t) => ({
        id: t.id,
        nome_servico: t.nome_servico,
        token_id: t.token_id,
        tipo: t.tipo,
        has_document: !!t.base64_docx,
      }));

      return res.status(200).json(response);
    } catch (error) {
      console.error("Erro ao listar templates ZapSign:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }

  async criar(req: Request, res: Response) {
    const { nome_servico, tipo } = req.body;

    if (!nome_servico || !tipo) {
      return res.status(400).json({ error: "nome_servico e tipo são obrigatórios" });
    }

    try {
      const repo = ApiMkDataSource.getRepository(ZapSignTemplates);

      const existing = await repo.findOne({ where: { nome_servico, tipo } });
      if (existing) {
        return res.status(409).json({ error: "Template já existe para esse serviço e tipo." });
      }

      const novo = repo.create({ nome_servico, tipo, token_id: "", base64_docx: "" });
      await repo.save(novo);

      return res.status(201).json({ id: novo.id, nome_servico: novo.nome_servico, tipo: novo.tipo });
    } catch (error) {
      console.error("Erro ao criar template ZapSign:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }

  async atualizar(req: Request, res: Response) {
    const { id } = req.params;
    const { base64_docx } = req.body;

    if (!base64_docx) {
      return res.status(400).json({ error: "base64_docx é obrigatório" });
    }

    try {
      const templatesRepository = ApiMkDataSource.getRepository(ZapSignTemplates);
      const template = await templatesRepository.findOne({
        where: { id: Number(id) },
      });

      if (!template) {
        return res.status(404).json({ error: "Serviço não encontrado" });
      }

      // Format the base64 for ZapSign
      let finalBase64 = base64_docx;
      if (base64_docx.includes("base64,")) {
        finalBase64 = base64_docx.split("base64,")[1];
      }

      const zapSignUrl = homologacao === "true"
        ? "https://sandbox.api.zapsign.com.br/api/v1/templates/create"
        : "https://api.zapsign.com.br/api/v1/templates/create";

      const zapSignData = {
        name: `Template - ${template.nome_servico}`,
        base64_docx: finalBase64,
        lang: "pt-br",
        observers: ["financeiro@wiptelecom.com.br"],
        first_signer: {
          blank_email: false,
          blank_phone: false,
          auth_mode: "assinaturaTela",
          require_selfie_photo: false,
          require_document_photo: false,
          selfie_validation_type: "",
          qualification: "Witness"
        }
      };

      console.log(`Atualizando template no ZapSign para: ${template.nome_servico} (${template.tipo})`);

      const zapResponse = await axios.post(zapSignUrl, zapSignData, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.ZAPSIGN_TOKEN}`,
        },
      });

      const novo_token = zapResponse.data.token;

      template.base64_docx = finalBase64;
      template.token_id = novo_token;
      await templatesRepository.save(template);

      return res.status(200).json({
        message: "Template atualizado com sucesso",
        token_id: novo_token,
      });
    } catch (error: any) {
      console.error(
        "Erro ao atualizar template ZapSign:",
        error?.response?.data || error.message,
      );
      return res.status(500).json({
        error: "Erro ao comunicar com ZapSign",
        details: error?.response?.data || error.message,
      });
    }
  }
}
