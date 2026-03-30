import axios from "axios";
import { Request, Response } from "express";
import moment from "moment";
import dotenv from "dotenv";
import ApiMkDataSource from "../database/API_MK";
import AppDataSource from "../database/DataSource";
import ZapSignTemplates from "../entities/APIMK/ZapSignTemplates";
import { SolicitacaoServico } from "../entities/SolicitacaoServico";
import { whatsappOutgoingQueue } from "./whatsapp/index";
import Whatsapp from "./Whatsapp";
import MkauthDataSource from "../database/MkauthSource";
import { ClientesEntities } from "../entities/ClientesEntities";
import { v4 as uuidv4 } from "uuid";
import { deleteSession } from "./whatsapp/services/session.service";

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
  telefone_conversa?: string;
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
  telefone_conversa?: string;
}

interface ZapSignDataMudancaComodo {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  endereco: string;
  valor: string;
  rg?: string;
  telefone_conversa?: string;
}

class ZapSign {
  createContractInstalacao = async (params: ZapSignDataInstalacao) => {
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
        telefone_conversa,
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
          { de: "{{fonecliente}}", para: telefone_conversa || telefone },
          { de: "{{celularcliente}}", para: telefone_conversa || telefone },
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

  createContractMudancaEndereco = async (
    params: ZapSignDataMudancaEndereco,
  ) => {
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
        telefone_conversa,
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
          { de: "{{fonecliente}}", para: telefone_conversa || telefone },
          { de: "{{celularcliente}}", para: telefone_conversa || telefone },
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

  generatePdfContratacao = async (req: Request, res: Response) => {
    try {
      const result = await this.createContractInstalacao(req.body);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }

  generatePdfMudancaEndereco = async (req: Request, res: Response) => {
    try {
      const result = await this.createContractMudancaEndereco(req.body);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error generating Mudança Endereço PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }

  createContractMudancaComodo = async (params: ZapSignDataMudancaComodo) => {
    try {
      const {
        nome,
        cpf,
        email,
        telefone,
        endereco,
        valor,
        rg = "Não informado",
        telefone_conversa,
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
          { de: "{{fonecliente}}", para: telefone_conversa || telefone },
          { de: "{{celularcliente}}", para: telefone_conversa || telefone },
          { de: "{{enderecocliente}}", para: endereco },
          { de: "{{emailcliente}}", para: email },
          { de: "{{provedoremail}}", para: "financeiro@wiptelecom.com.br" },
          { de: "{{valor}}", para: valor },
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

  generatePdfMudancaComodo = async (req: Request, res: Response) => {
    try {
      const result = await this.createContractMudancaComodo(req.body);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error generating Mudança Cômodo PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }

  webhook = async (req: Request, res: Response) => {
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

          // Notificar o Cliente sobre a assinatura confirmada
          try {
            let requesterPhone = "";
            if (solicitacao.dados && solicitacao.dados.telefone_conversa) {
              const cleanReqPhone = solicitacao.dados.telefone_conversa.replace(
                /\D/g,
                "",
              );
              requesterPhone = cleanReqPhone.startsWith("55")
                ? cleanReqPhone
                : "55" + cleanReqPhone;
            } else if (solicitacao.dados && solicitacao.dados.telefone) {
              const cleanReqPhone = solicitacao.dados.telefone.replace(
                /\D/g,
                "",
              );
              requesterPhone = cleanReqPhone.startsWith("55")
                ? cleanReqPhone
                : "55" + cleanReqPhone;
            }

            if (requesterPhone) {
              await Whatsapp.MensagensComuns(
                requesterPhone,
                `✅ *Assinatura Confirmada!*\n\nOlá ${solicitacao.dados?.nome || "Cliente"}, recebemos a sua assinatura para o serviço: *${solicitacao.servico || "Contratado"}*.\n\nAgradecemos a confiança! Em breve nossa equipe entrará em contato para agendamento. 🚀`,
              );
              await deleteSession(requesterPhone);
            }
          } catch (errConv) {
            console.error(
              "[ZapSign Webhook] Erro ao notificar cliente:",
              errConv,
            );
          }

          // Enviar notificação para o celular de teste do .env (Funcionário)
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
          }

          // === Integração com MKAuth após Assinatura ===
          try {
            const dados = solicitacao.dados;
            if (dados) {
              const servicoNormalizado = solicitacao.servico?.toLowerCase();
              switch (servicoNormalizado) {
                case "instalação":
                case "instalacao":
                  await this.registerClientInMkAuth(dados);
                  console.log(
                    `[ZapSign Webhook] Cliente ${dados.nome} cadastrado no MKAuth para Instalação.`,
                  );
                  break;
                case "mudança de endereço":
                case "mudanca_endereco":
                  // Para mudança de endereço, atualizamos o cadastro existente
                  // Tenta pegar o login dos dados ou do próprio registro da solicitação
                  const login = dados.login || solicitacao.login_cliente;
                  if (
                    login &&
                    login !== "Desconhecido" &&
                    login !== "Não informado"
                  ) {
                    await this.updateClientAddressInMkAuth(login, dados);
                    console.log(
                      `[ZapSign Webhook] Endereço do cliente ${login} atualizado no MKAuth (Serviço: ${solicitacao.servico}).`,
                    );
                  } else {
                    console.warn(
                      `[ZapSign Webhook] Login não identificado para atualização de endereço: ${solicitacao.id}`,
                    );
                  }
                  break;
                default:
                  console.log(
                    `[ZapSign Webhook] Serviço '${solicitacao.servico}' não requer integração MKAuth específica no momento.`,
                  );
                  break;
              }
            }
          } catch (mkError) {
            console.error(
              "[ZapSign Webhook] Erro ao integrar com MKAuth:",
              mkError,
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

  // === Métodos Auxiliares para MKAuth ===

  private limparEndereco = (str: string, isStreet: boolean = false): string => {
    if (!str) return "";
    let clean = str
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (isStreet) {
      clean = clean
        .replace(/^(RUA|AVENIDA|AV|R\.|TRAVESSA|TRAV|PCA|PRACA)\s+/i, "")
        .trim();
    }
    return clean;
  }

  private FormatarCidade = (cidade: string): string => {
    if (!cidade) return "";
    return cidade
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private registerClientInMkAuth = async (dados: any) => {
    const ClientesRepository = MkauthDataSource.getRepository(ClientesEntities);

    // Busca código IBGE
    let ibgeCode: string | null = null;
    try {
      const ufStr = (dados.estado || "").trim().toLowerCase();
      const cityStr = (dados.cidade || "").trim().toLowerCase();
      if (ufStr && cityStr) {
        const response = await axios.get(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufStr}/municipios`,
        );
        const municipios = response.data;
        const nmNormalized = cityStr
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^\w\s]/gi, "")
          .trim();
        const munFind = municipios.find((m: any) => {
          const mNmNorm = m.nome
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\w\s]/gi, "")
            .trim();
          return mNmNorm === nmNormalized;
        });
        if (munFind) {
          ibgeCode = munFind.id.toString();
        }
      }
    } catch (err) {
      console.error("Erro ao buscar IBGE da API externa:");
    }

    // Garante login único
    let finalLogin =
      dados.login || (dados.nome || "").trim().replace(/\s/g, "").toUpperCase();
    const findLogin = await ClientesRepository.findOne({
      where: { login: finalLogin },
    });

    if (findLogin) {
      finalLogin = `${finalLogin}${Math.floor(Math.random() * 1000)}`;
    }

    const celularFormatado = (dados.telefone || dados.celular || "").replace(
      /\D/g,
      "",
    );
    const celular2Formatado = (dados.celularSecundario || "").replace(
      /\D/g,
      "",
    );

    const addClient = await ClientesRepository.save({
      nome: (dados.nome || "").toUpperCase(),
      login: finalLogin,
      rg: (dados.rg || "").trim().replace(/\s/g, ""),
      cpf_cnpj: (dados.cpf || "").trim().replace(/\s/g, ""),
      uuid_cliente: `019b${uuidv4().slice(0, 32)}`,
      email: (dados.email || "").trim().replace(/\s/g, ""),
      cidade: this.FormatarCidade(this.limparEndereco(dados.cidade || "")),
      bairro: this.limparEndereco(dados.bairro || ""),
      estado: (dados.estado || "").toUpperCase().replace(/\s/g, "").slice(0, 2),
      nascimento: (dados.dataNascimento || "").replace(
        /(\d{2})\/(\d{2})\/(\d{4})/,
        "$3-$2-$1",
      ),
      numero: this.limparEndereco(dados.numero || ""),
      endereco: this.limparEndereco(dados.endereco || dados.rua || "", true),
      cep: dados.cep
        ? `${dados.cep.replace(/\D/g, "").slice(0, 5)}-${dados.cep.replace(/\D/g, "").slice(5, 8)}`
        : "",
      plano: dados.plano,
      pool_name: "LAN_PPPOE",
      plano15: "Plano_15",
      plano_bloqc: "Plano_bloqueado",
      vendedor: "SCM",
      conta: "3",
      comodato: "sim",
      cidade_ibge: ibgeCode || "3503406",
      fone: "(14)3296-1608",
      venc: (dados.vencimento || "").trim().replace(/\D/g, ""),
      celular:
        celularFormatado.length >= 10
          ? `(${celularFormatado.slice(0, 2)})${celularFormatado.slice(2)}`
          : celularFormatado,
      celular2:
        celular2Formatado.length >= 10
          ? `(${celular2Formatado.slice(0, 2)})${celular2Formatado.slice(2)}`
          : celular2Formatado,
      estado_res: (dados.estado || "")
        .toUpperCase()
        .replace(/\s/g, "")
        .slice(0, 2),
      bairro_res: this.limparEndereco(dados.bairro || ""),
      tipo: "pppoe",
      cidade_res: this.FormatarCidade(this.limparEndereco(dados.cidade || "")),
      cep_res: dados.cep
        ? `${dados.cep.replace(/\D/g, "").slice(0, 5)}-${dados.cep.replace(/\D/g, "").slice(5, 8)}`
        : "",
      numero_res: this.limparEndereco(dados.numero || ""),
      endereco_res: this.limparEndereco(
        dados.endereco || dados.rua || "",
        true,
      ),
      tipo_cob: "titulo",
      mesref: "now",
      prilanc: "tot",
      pessoa:
        (dados.cpf || "").replace(/\D/g, "").length <= 11
          ? "fisica"
          : "juridica",
      dias_corte: 80,
      senha: moment().format("DDMMYYYY"),
      cadastro: moment().format("DD-MM-YYYY").split("-").join("/"),
      data_ip: moment().format("YYYY-MM-DD HH:mm:ss"),
      data_ins: moment().format("YYYY-MM-DD HH:mm:ss"),
    });

    await ClientesRepository.update(addClient.id, {
      termo: `${addClient.id}C/${moment().format("YYYY")}`,
    });
  }

  private updateClientAddressInMkAuth = async (login: string, dados: any) => {
    const ClientesRepository = MkauthDataSource.getRepository(ClientesEntities);
    const client = await ClientesRepository.findOne({
      where: { login: login },
    });

    if (client) {
      await ClientesRepository.update(client.id, {
        endereco: this.limparEndereco(dados.rua || dados.endereco || "", true),
        numero: this.limparEndereco(dados.numero || ""),
        bairro: this.limparEndereco(dados.bairro || ""),
        cidade: this.FormatarCidade(this.limparEndereco(dados.cidade || "")),
        estado: (dados.estado || "")
          .toUpperCase()
          .replace(/\s/g, "")
          .slice(0, 2),
        cep: dados.cep
          ? `${dados.cep.replace(/\D/g, "").slice(0, 5)}-${dados.cep.replace(/\D/g, "").slice(5, 8)}`
          : client.cep,
        endereco_res: this.limparEndereco(
          dados.rua || dados.endereco || "",
          true,
        ),
        numero_res: this.limparEndereco(dados.numero || ""),
        bairro_res: this.limparEndereco(dados.bairro || ""),
        cidade_res: this.FormatarCidade(
          this.limparEndereco(dados.cidade || ""),
        ),
        estado_res: (dados.estado || "")
          .toUpperCase()
          .replace(/\s/g, "")
          .slice(0, 2),
        cep_res: dados.cep
          ? `${dados.cep.replace(/\D/g, "").slice(0, 5)}-${dados.cep.replace(/\D/g, "").slice(5, 8)}`
          : client.cep_res,
      });
    }
  }
}

export default new ZapSign();
