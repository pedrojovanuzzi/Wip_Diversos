import axios from "axios";
import { Request, Response } from "express";
const homologacao = process.env.SERVIDOR_HOMOLOGACAO;

class ZapSign {
  async generatePdfContratacao(req: Request, res: Response) {
    try {
      const {
        nome,
        cpf,
        email,
        telefone,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        cep,
        plano,
        valor,
        vencimento,
      } = req.body;
      const data = {
        template_id: "59caaa4b-f045-44fe-9099-f993c3a112fa",
        signer_name: nome,
        send_automatic_email: false,
        send_automatic_whatsapp: false,
        lang: "pt-br",
        external_id: null,
        data: [
          {
            de: "{{nomecliente}}",
            para: nome,
          },
          {
            de: "{{termo}}",
            para: "ABCD",
          },
          {
            de: "{{data}}",
            para: "24/03/2026",
          },
          {
            de: "{{cpfcliente}}",
            para: cpf,
          },
          {
            de: "{{provedornome}}",
            para: "Wip Telecom",
          },
          {
            de: "{{provedorcnpj}}",
            para: "100000000",
          },
          {
            de: "{{rgcliente}}",
            para: "12.345.678-9",
          },
          {
            de: "{{fonecliente}}",
            para: telefone,
          },
          {
            de: "{{celularcliente}}",
            para: telefone,
          },
          {
            de: "{{enderecocliente}}",
            para: endereco,
          },
          {
            de: "{{bairrocliente}}",
            para: bairro,
          },
          {
            de: "{{cidadecliente}}",
            para: cidade,
          },
          {
            de: "{{estadocliente}}",
            para: estado,
          },
          {
            de: "{{cepcliente}}",
            para: cep,
          },
          {
            de: "{{enderecorescliente}}",
            para: endereco,
          },
          {
            de: "{{emailcliente}}",
            para: email,
          },
          {
            de: "{{bairrorescliente}}",
            para: bairro,
          },
          {
            de: "{{cidaderescliente}}",
            para: cidade,
          },
          {
            de: "{{estadorescliente}}",
            para: estado,
          },
          {
            de: "{{ceprescliente}}",
            para: cep,
          },
          {
            de: "{{provedoremail}}",
            para: "[EMAIL_ADDRESS]",
          },
          {
            de: "{{planodeacesso}}",
            para: plano,
          },
          {
            de: "{{velocidadeplano}}",
            para: "500 Mbps / 250 Mbps",
          },
          {
            de: "{{valor}}",
            para: valor,
          },
          {
            de: "{{descontocliente}}",
            para: "20,00",
          },
          {
            de: "{{diavencimento}}",
            para: vencimento,
          },
          {
            de: "{{equipamento}}",
            para: "Roteador TP-Link AX1500",
          },
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
      res.status(200).json(response.data);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }
}

export default new ZapSign();
