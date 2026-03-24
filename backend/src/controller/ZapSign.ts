import axios from "axios";
import { Request, Response } from "express";
import moment from "moment";
import dotenv from "dotenv";
import { contratacao } from "../zapsign_id/contratacao";

dotenv.config();

const homologacao = process.env.SERVIDOR_HOMOLOGACAO;

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

      const data = {
        template_id: contratacao,
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
      console.error("Error in createContract:", error);
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
}

export default new ZapSign();
