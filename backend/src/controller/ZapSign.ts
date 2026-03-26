import axios from "axios";
import { Request, Response } from "express";
import moment from "moment";
import dotenv from "dotenv";
import ApiMkDataSource from "../database/API_MK";
import AppDataSource from "../database/DataSource";
import ZapSignTemplates from "../entities/APIMK/ZapSignTemplates";
import { SolicitacaoServico } from "../entities/SolicitacaoServico";
import { whatsappOutgoingQueue } from "./WhatsConversationPath";

dotenv.config();

const homologacao = process.env.SERVIDOR_HOMOLOGACAO;
const isSandbox = homologacao === "true";

const waToken = isSandbox
  ? process.env.CLOUD_API_ACCESS_TOKEN_TEST
  : process.env.CLOUD_API_ACCESS_TOKEN;

const waUrl = isSandbox
  ? `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID_TEST}/messages`
  : `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;

interface ZapSignDataInstalacao {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  endereco: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  plano: string;
  valor: string;
  vencimento: string;
  rg?: string;
}

interface ZapSignDataMudancaEndereco {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  endereco_antigo: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  valor: string;
  rg?: string;
}

interface ZapSignDataMudancaComodo {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  endereco: string;
  valor: string;
  rg?: string;
}

class ZapSign {
  async createContractInstalacao(params: ZapSignDataInstalacao) {
    try {
      const {
        nome,
        cpf,
        email,
        telefone,
        endereco,
        numero,
        complemento = "",
        bairro,
        cidade,
        estado,
        cep,
        plano,
        valor,
        vencimento,
        rg = "Não informado",
      } = params;

      const templateRepo = ApiMkDataSource.getRepository(ZapSignTemplates);
      const tipo =
        valor === "0,00" || valor === "0" || valor === "0.00"
          ? "gratis"
          : "pago";

      const template = await templateRepo.findOne({
        where: { nome_servico: "Instalação", tipo: tipo },
      });

      if (!template || !template.token_id) {
        throw new Error(
          "Token do template 'Instalação' não encontrado no banco de dados.",
        );
      }

      const data = {
        template_id: template.token_id,
        signer_name: nome,
        send_automatic_email: false,
        send_automatic_whatsapp: false,
        lang: "pt-br",
        external_id: null,
        data: [
          { de: "{{nomecliente}}", para: nome },
          { de: "{{termo}}", para: "Adesão" },
          { de: "{{data}}", para: moment().format("DD/MM/YYYY") },
          { de: "{{cpfcliente}}", para: cpf },
          { de: "{{provedornome}}", para: "Wip Telecom" },
          { de: "{{provedorcnpj}}", para: "10.000.000/0001-00" },
          { de: "{{rgcliente}}", para: rg },
          { de: "{{fonecliente}}", para: telefone },
          { de: "{{celularcliente}}", para: telefone },
          {
            de: "{{enderecocliente}}",
            para: `${endereco}, ${numero} ${complemento}`,
          },
          { de: "{{bairrocliente}}", para: bairro },
          { de: "{{cidadecliente}}", para: cidade },
          { de: "{{estadocliente}}", para: estado },
          { de: "{{cepcliente}}", para: cep },
          {
            de: "{{enderecorescliente}}",
            para: `${endereco}, ${numero} ${complemento}`,
          },
          { de: "{{emailcliente}}", para: email },
          { de: "{{bairrorescliente}}", para: bairro },
          { de: "{{cidaderescliente}}", para: cidade },
          { de: "{{estadorescliente}}", para: estado },
          { de: "{{ceprescliente}}", para: cep },
          { de: "{{provedoremail}}", para: "financeiro@wiptelecom.com.br" },
          { de: "{{planodeacesso}}", para: plano },
          { de: "{{velocidadeplano}}", para: "Consultar Viabilidade" },
          { de: "{{valor}}", para: valor },
          { de: "{{descontocliente}}", para: "0,00" },
          { de: "{{diavencimento}}", para: vencimento },
          { de: "{{equipamento}}", para: "Roteador em Comodato" },
        ],
        signature_placement: "<<assinatura>>",
        rubrica_placement: "<<visto>>",
      };

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

      return response.data;
    } catch (error) {
      console.error("Error in createContractInstalacao:", error);
      throw error;
    }
  }

  async createContractMudancaEndereco(params: ZapSignDataMudancaEndereco) {
    try {
      const {
        nome,
        cpf,
        email,
        telefone,
        endereco_antigo,
        rua,
        numero,
        complemento = "",
        bairro,
        cidade,
        estado,
        cep,
        valor,
        rg = "Não informado",
      } = params;

      const templateRepo = ApiMkDataSource.getRepository(ZapSignTemplates);
      const tipo =
        valor === "0,00" || valor === "0" || valor === "0.00"
          ? "gratis"
          : "pago";

      const template = await templateRepo.findOne({
        where: { nome_servico: "Mudança de Endereço", tipo: tipo },
      });

      if (!template || !template.token_id) {
        throw new Error(
          "Token do template 'Mudança de Endereço' não encontrado no banco de dados.",
        );
      }

      const data = {
        template_id: template.token_id,
        signer_name: nome,
        send_automatic_email: false,
        send_automatic_whatsapp: false,
        lang: "pt-br",
        external_id: null,
        data: [
          { de: "{{nomecliente}}", para: nome },
          { de: "{{termo}}", para: "Mudança de Endereço" },
          { de: "{{data}}", para: moment().format("DD/MM/YYYY") },
          { de: "{{cpfcliente}}", para: cpf },
          { de: "{{provedornome}}", para: "Wip Telecom" },
          { de: "{{provedorcnpj}}", para: "10.000.000/0001-00" },
          { de: "{{rgcliente}}", para: rg },
          { de: "{{fonecliente}}", para: telefone },
          { de: "{{celularcliente}}", para: telefone },
          {
            de: "{{enderecocliente}}",
            para: `${rua}, ${numero} ${complemento}`,
          },
          { de: "{{bairrocliente}}", para: bairro },
          { de: "{{cidadecliente}}", para: cidade },
          { de: "{{estadocliente}}", para: estado },
          { de: "{{cepcliente}}", para: cep },
          {
            de: "{{enderecorescliente}}",
            para: `${rua}, ${numero} ${complemento}`,
          },
          { de: "{{emailcliente}}", para: email },
          { de: "{{bairrorescliente}}", para: bairro },
          { de: "{{cidaderescliente}}", para: cidade },
          { de: "{{estadorescliente}}", para: estado },
          { de: "{{ceprescliente}}", para: cep },
          { de: "{{provedoremail}}", para: "financeiro@wiptelecom.com.br" },
          { de: "{{planodeacesso}}", para: "Upgrade de Endereço" },
          { de: "{{velocidadeplano}}", para: "Consultar Viabilidade" },
          { de: "{{valor}}", para: valor },
          { de: "{{descontocliente}}", para: "0,00" },
          { de: "{{diavencimento}}", para: "N/A" },
          { de: "{{equipamento}}", para: "Roteador existente" },
        ],
        signature_placement: "<<assinatura>>",
        rubrica_placement: "<<visto>>",
      };

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

      return response.data;
    } catch (error) {
      console.error("Error in createContractMudancaEndereco:", error);
      throw error;
    }
  }

  async generatePdfContratacao(req: Request, res: Response) {
    try {
      const result = await this.createContractInstalacao(req.body);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }

  async generatePdfMudancaEndereco(req: Request, res: Response) {
    try {
      const result = await this.createContractMudancaEndereco(req.body);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error generating Mudança Endereço PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }

  async createContractMudancaComodo(params: ZapSignDataMudancaComodo) {
    try {
      const {
        nome,
        cpf,
        email,
        telefone,
        endereco,
        valor,
        rg = "Não informado",
      } = params;

      const templateRepo = ApiMkDataSource.getRepository(ZapSignTemplates);
      const tipo =
        valor === "0,00" || valor === "0" || valor === "0.00"
          ? "gratis"
          : "pago";

      const template = await templateRepo.findOne({
        where: { nome_servico: "Mudança de Cômodo", tipo: tipo },
      });

      if (!template || !template.token_id) {
        throw new Error(
          "Token do template 'Mudança de Cômodo' não encontrado no banco de dados.",
        );
      }

      const data = {
        template_id: template.token_id,
        signer_name: nome,
        send_automatic_email: false,
        send_automatic_whatsapp: false,
        lang: "pt-br",
        external_id: null,
        data: [
          { de: "{{nomecliente}}", para: nome },
          { de: "{{termo}}", para: "Mudança de Cômodo" },
          { de: "{{data}}", para: moment().format("DD/MM/YYYY") },
          { de: "{{cpfcliente}}", para: cpf },
          { de: "{{provedornome}}", para: "Wip Telecom" },
          { de: "{{provedorcnpj}}", para: "10.000.000/0001-00" },
          { de: "{{rgcliente}}", para: rg },
          { de: "{{fonecliente}}", para: telefone },
          { de: "{{celularcliente}}", para: telefone },
          { de: "{{enderecocliente}}", para: endereco },
          { de: "{{emailcliente}}", para: email },
          { de: "{{provedoremail}}", para: "financeiro@wiptelecom.com.br" },
        ],
        signature_placement: "<<assinatura>>",
        rubrica_placement: "<<visto>>",
      };

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

      return response.data;
    } catch (error) {
      console.error("Error in createContractMudancaComodo:", error);
      throw error;
    }
  }

  async generatePdfMudancaComodo(req: Request, res: Response) {
    try {
      const result = await this.createContractMudancaComodo(req.body);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error generating Mudança Cômodo PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }

  async webhook(req: Request, res: Response) {
    try {
      const { event_type, token } = req.body;
      console.log(`[ZapSign Webhook] Evento recebido: ${event_type}`);

      if (event_type === "doc_signed" || event_type === "all_signed") {
        const repo = AppDataSource.getRepository(SolicitacaoServico);

        const solicitacao = await repo.findOne({
          where: { token_zapsign: token },
        });

        if (solicitacao) {
          solicitacao.assinado = true;
          await repo.save(solicitacao);
          console.log(
            `[ZapSign Webhook] Solicitação ID ${solicitacao.id} marcada como assinada (Token: ${token}).`,
          );

          // Enviar notificação para o celular de teste do .env
          const testPhone = process.env.TEST_PHONE;
          if (testPhone) {
            await whatsappOutgoingQueue.add(
              "send-template",
              {
                url: waUrl,
                payload: {
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: testPhone,
                  type: "template",
                  template: {
                    name: "notificacao_assinatura",
                    language: {
                      code: "pt_BR",
                    },
                  },
                },
                headers: {
                  Authorization: `Bearer ${waToken}`,
                  "Content-Type": "application/json",
                },
              },
              {
                removeOnComplete: true,
                removeOnFail: false,
                attempts: 3,
                backoff: { type: "exponential", delay: 5000 },
              },
            );
            console.log(
              `[ZapSign Webhook] Notificação 'notificacao_assinatura' enviada para ${testPhone}`,
            );
          }
        } else {
          console.warn(
            `[ZapSign Webhook] Nenhuma solicitação encontrada para o token: ${token}`,
          );
        }
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("[ZapSign Webhook] Erro ao processar:", error);
      res.status(500).send("Internal Server Error");
    }
  }
}

export default new ZapSign();
