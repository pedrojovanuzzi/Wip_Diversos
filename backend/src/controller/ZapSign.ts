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
import { sessions, saveSession, deleteSession } from "./whatsapp/services/session.service";
import { criarChamadoMkauth } from "./whatsapp/services/chamado.service";

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

interface ZapSignDataAlteracaoPlano {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  endereco: string;
  plano: string;
  valor: string;
  rg?: string;
  telefone_conversa?: string;
}

interface ZapSignDataTrocaTitularidade {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  endereco: string;
  rg?: string;
  telefone_conversa?: string;
  nome_novo_titular?: string;
  celular_novo_titular?: string;
  celular_destino?: string;
  // Dados completos do novo titular (para preencher os campos {{...2}})
  cpf_novo_titular?: string;
  rg_novo_titular?: string;
  email_novo_titular?: string;
  endereco_novo_titular?: string;
  numero_novo_titular?: string;
  bairro_novo_titular?: string;
  celular2_novo_titular?: string;
  login_novo_titular?: string;
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
      console.log("[ZapSign Webhook] Body completo:", JSON.stringify(req.body));
      const { event_type } = req.body;
      const token: string = req.body.token || req.body.document?.token;
      console.log(`[ZapSign Webhook] Evento: ${event_type} | Token: ${token}`);

      // ZapSign pode enviar "doc_signed" como último evento mesmo quando todos assinaram.
      // Detectamos isso verificando se o status do documento é "signed".
      const docFullySigned =
        req.body.status === "signed" &&
        Array.isArray(req.body.signers) &&
        req.body.signers.every((s: any) => s.status === "signed");

      if (event_type === "doc_signed") {
        const repo = AppDataSource.getRepository(SolicitacaoServico);
        const solicitacao = await repo.findOne({ where: { token_zapsign: token } });
        if (solicitacao) {
          const servicoNorm = solicitacao.servico?.toLowerCase();
          // Notifica novo titular apenas na primeira assinatura (quando ainda faltam signatários)
          if (
            (servicoNorm === "troca de titularidade titular" || servicoNorm === "troca_titularidade_titular") &&
            !solicitacao.dados?.titular_assinou &&
            !docFullySigned &&
            !solicitacao.assinado
          ) {
            solicitacao.dados = { ...solicitacao.dados, titular_assinou: true };
            await repo.save(solicitacao);
            await this.notificarNovoTitular(solicitacao);
          }
        }
      }

      if (event_type === "all_signed" || docFullySigned) {
        console.log(`[ZapSign Webhook] Processando assinatura completa para token: ${token}`);
        const repo = AppDataSource.getRepository(SolicitacaoServico);

        const solicitacao = await repo.findOne({
          where: { token_zapsign: token },
        });

        console.log(`[ZapSign Webhook] Solicitação encontrada: ${solicitacao ? `ID ${solicitacao.id} (${solicitacao.servico})` : "NÃO ENCONTRADA"}`);

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
                `✅ *Assinatura Confirmada!*\n\nOlá ${solicitacao.dados?.nome || "Cliente"}, recebemos a sua assinatura para o serviço: *${solicitacao.servico || "Contratado"}*.\n\nAgradecemos a confiança! Em breve nossa equipe entrará em contato para confirmação do serviço. 🚀`,
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
                  try {
                    const msgChamado =
                      `Cliente solicitou novo cadastro via WhatsApp e assinou o contrato.\n\n` +
                      `👤 Nome: ${dados.nome || "-"}\n` +
                      `📄 CPF: ${dados.cpf || "-"}\n` +
                      `🪪 RG/IE: ${dados.rg || "-"}\n` +
                      `📱 Celular: ${dados.celular || "-"}\n` +
                      `📧 E-mail: ${dados.email || "-"}\n` +
                      `📍 Endereço: ${dados.rua || "-"}, ${dados.numero || "-"} - ${dados.bairro || "-"}\n` +
                      `🏙️ Cidade: ${dados.cidade || "-"}/${dados.estado || "-"}\n` +
                      `📮 CEP: ${dados.cep || "-"}\n` +
                      `📶 Plano: ${dados.plano || "-"}\n` +
                      `📅 Vencimento: Dia ${dados.vencimento || "-"}`;
                    await criarChamadoMkauth(
                      "INSTALACAO",
                      { nome: dados.nome, login: dados.login || solicitacao.login_cliente, email: dados.email || "" },
                      msgChamado,
                      solicitacao,
                    );
                  } catch (eChamado) {
                    console.error("[ZapSign Webhook] Erro ao criar chamado de instalação:", eChamado);
                  }
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
                case "alteração de plano":
                case "alteracao de plano":
                  const loginPlano = dados.login || solicitacao.login_cliente;
                  if (
                    loginPlano &&
                    loginPlano !== "Desconhecido" &&
                    loginPlano !== "Não informado"
                  ) {
                    await this.updateClientPlanInMkAuth(loginPlano, dados);
                    console.log(
                      `[ZapSign Webhook] Plano do cliente ${loginPlano} atualizado no MKAuth (Serviço: ${solicitacao.servico}).`,
                    );
                  } else {
                    console.warn(
                      `[ZapSign Webhook] Login não identificado para atualização de plano: ${solicitacao.id}`,
                    );
                  }
                  break;
                case "troca de titularidade titular":
                case "troca_titularidade_titular":
                  // notificarNovoTitular é chamado no doc_signed (primeira assinatura)
                  await this.verificarEFinalizarTrocaTitularidade(solicitacao, repo);
                  break;
                case "troca de titularidade novo titular":
                  await this.verificarEFinalizarTrocaTitularidade(solicitacao, repo);
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

  // === Métodos Auxiliares para Troca de Titularidade ===

  private notificarNovoTitular = async (solicitacao: SolicitacaoServico) => {
    try {
      const dados = solicitacao.dados;
      if (!dados) return;

      const celularDestino = dados.celular_destino;
      const celularTitular = dados.telefone_conversa;
      const nomeNovoTitular = dados.nome_novo_titular || "novo titular";
      const nomeTitular = dados.nome || "Titular";

      if (!celularDestino) {
        console.warn("[ZapSign] celular_destino não encontrado na solicitação de troca de titularidade");
        return;
      }

      if (celularTitular) {
        await Whatsapp.MensagensComuns(
          celularTitular,
          `✅ *Assinatura confirmada!* Aguardando a assinatura do novo titular. 🚀`,
        );
      }
    } catch (error) {
      console.error("[ZapSign] Erro ao notificar novo titular:", error);
    }
  }

  private verificarEFinalizarTrocaTitularidade = async (
    solicitacaoAssinada: SolicitacaoServico,
    repo: ReturnType<typeof AppDataSource.getRepository<SolicitacaoServico>>,
  ) => {
    try {
      const isNovoTitular = (solicitacaoAssinada.servico || "").toLowerCase().includes("novo titular");

      let solicitacaoTitular: SolicitacaoServico | null = null;
      let solicitacaoNovoTitular: SolicitacaoServico | null = null;

      if (isNovoTitular) {
        solicitacaoNovoTitular = solicitacaoAssinada;
        const idTitular = solicitacaoAssinada.dados?.solicitacao_id_titular;
        if (idTitular) {
          solicitacaoTitular = await repo.findOne({ where: { id: idTitular } });
        }
      } else {
        solicitacaoTitular = solicitacaoAssinada;
        const idNovoTitular = solicitacaoAssinada.dados?.solicitacao_id_novo_titular;
        if (idNovoTitular) {
          solicitacaoNovoTitular = await repo.findOne({ where: { id: idNovoTitular } });
        }
      }

      if (!solicitacaoTitular || !solicitacaoNovoTitular) {
        console.log("[TrocaTitularidade] Aguardando a outra solicitação ser localizada.");
        return;
      }

      if (!solicitacaoTitular.assinado || !solicitacaoNovoTitular.assinado) {
        console.log("[TrocaTitularidade] Aguardando ambas as assinaturas.");
        return;
      }

      if (solicitacaoTitular.dados?.troca_finalizada) {
        console.log("[TrocaTitularidade] Troca já processada, ignorando.");
        return;
      }

      // Marca como processado para evitar execução dupla
      solicitacaoTitular.dados = { ...solicitacaoTitular.dados, troca_finalizada: true };
      await repo.save(solicitacaoTitular);

      const dadosTitular = solicitacaoTitular.dados;
      const dadosNovoTitular = solicitacaoNovoTitular.dados;

      // 1. Criar chamado no cadastro do titular original (pelo CPF)
      try {
        const cpfOriginal = (dadosTitular?.cpf || "").replace(/\D/g, "");
        if (cpfOriginal) {
          const clienteOriginal = await MkauthDataSource.getRepository(ClientesEntities).findOne({
            where: { cpf_cnpj: cpfOriginal },
          });

          const sessionFake = {
            login: clienteOriginal?.login || dadosTitular?.login || "",
            nome: clienteOriginal?.nome || dadosTitular?.nome || "",
            email: clienteOriginal?.email || dadosTitular?.email || "",
          };

          const mensagemChamado =
            `Troca de titularidade realizada em ${moment().format("DD/MM/YYYY HH:mm")}. ` +
            `Contrato assinado pelo titular e novo titular.\n\n` +
            `Dados do novo titular:\n` +
            `Nome: ${dadosNovoTitular?.nome || "Não informado"}\n` +
            `CPF: ${dadosNovoTitular?.cpf || "Não informado"}\n` +
            `E-mail: ${dadosNovoTitular?.email || "Não informado"}\n` +
            `Celular: ${dadosNovoTitular?.celular || dadosNovoTitular?.telefone_conversa || "Não informado"}`;

          await criarChamadoMkauth("TROCA DE TITULARIDADE", sessionFake, mensagemChamado, solicitacaoTitular);
          console.log(`[TrocaTitularidade] Chamado criado para CPF ${cpfOriginal}.`);
        } else {
          console.warn("[TrocaTitularidade] CPF do titular original não encontrado nos dados.");
        }
      } catch (e) {
        console.error("[TrocaTitularidade] Erro ao criar chamado para titular:", e);
      }

      // 2. Criar novo cadastro no MkAuth para o novo titular
      try {
        await this.registerClientInMkAuth(dadosNovoTitular);
        console.log(`[TrocaTitularidade] Novo titular ${dadosNovoTitular?.nome} cadastrado no MKAuth.`);
      } catch (e) {
        console.error("[TrocaTitularidade] Erro ao cadastrar novo titular no MKAuth:", e);
      }
    } catch (error) {
      console.error("[TrocaTitularidade] Erro ao processar finalização da troca:", error);
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
        .replace(/[^A-Z\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    return clean;
  }

  createContractAlteracaoPlano = async (
    params: ZapSignDataAlteracaoPlano,
  ) => {
    try {
      const {
        nome,
        cpf,
        email,
        telefone,
        endereco,
        plano,
        valor,
        rg = "Não informado",
        telefone_conversa,
      } = params;

      const templateRepo = ApiMkDataSource.getRepository(ZapSignTemplates);
      const template = await templateRepo.findOne({
        where: { nome_servico: "Alteração de Plano", tipo: "gratis" },
      });

      if (!template || !template.token_id) {
        throw new Error(
          "Token do template 'Alteração de Plano' não encontrado no banco de dados.",
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
          { de: "{{termo}}", para: "Alteração de Plano" },
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
          { de: "{{planodeacesso}}", para: plano },
          { de: "{{velocidadeplano}}", para: "Conforme solicitado" },
          { de: "{{valor}}", para: valor || "0.00" },
          { de: "{{descontocliente}}", para: "0,00" },
          { de: "{{diavencimento}}", para: "N/A" },
          { de: "{{equipamento}}", para: "Equipamento existente" },
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
      console.error("Error in createContractAlteracaoPlano:", error);
      throw error;
    }
  }

  createContractTrocaTitularidadeTitular = async (params: ZapSignDataTrocaTitularidade) => {
    try {
      const {
        nome,
        cpf,
        email,
        telefone,
        endereco,
        rg = "Não informado",
        telefone_conversa,
        nome_novo_titular = "",
        celular_novo_titular = "",
        cpf_novo_titular = "",
        rg_novo_titular = "",
        email_novo_titular = "",
        endereco_novo_titular = "",
        numero_novo_titular = "",
        bairro_novo_titular = "",
        celular2_novo_titular = "",
        login_novo_titular = "",
      } = params;

      const templateRepo = ApiMkDataSource.getRepository(ZapSignTemplates);
      const template = await templateRepo.findOne({
        where: { nome_servico: "Troca de Titularidade", tipo: "gratis" },
      });

      if (!template || !template.token_id) {
        throw new Error(
          "Token do template 'Troca de Titularidade' não encontrado no banco de dados.",
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
          { de: "{{termo}}", para: "Troca de Titularidade" },
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
          { de: "{{novotitular}}", para: nome_novo_titular },
          { de: "{{celularnovotitular}}", para: celular_novo_titular },
          { de: "{{termo2}}", para: "Troca de Titularidade" },
          { de: "{{logincliente2}}", para: login_novo_titular },
          { de: "{{nomecliente2}}", para: nome_novo_titular },
          { de: "{{cpfcliente2}}", para: cpf_novo_titular },
          { de: "{{rgcliente2}}", para: rg_novo_titular },
          { de: "{{enderecoresclient2}}", para: endereco_novo_titular },
          { de: "{{numerorescliente2}}", para: numero_novo_titular },
          { de: "{{bairrocliente2}}", para: bairro_novo_titular },
          { de: "{{celularcliente2}}", para: celular_novo_titular },
          { de: "{{celular2cliente2}}", para: celular2_novo_titular },
          { de: "{{emailcliente2}}", para: email_novo_titular },
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

      const docToken = response.data.token;
      let secondSigner: any = null;

      if (nome_novo_titular && celular_novo_titular && docToken) {
        const phoneRaw = String(celular_novo_titular).replace(/\D/g, "");
        const phoneNumber = phoneRaw.startsWith("55") ? phoneRaw.slice(2) : phoneRaw;

        const addSignerResponse = await axios.post(
          homologacao
            ? `https://sandbox.api.zapsign.com.br/api/v1/docs/${docToken}/add-signer/`
            : `https://api.zapsign.com.br/api/v1/docs/${docToken}/add-signer/`,
          {
            name: nome_novo_titular,
            phone_country: "55",
            phone_number: phoneNumber,
            signature_placement: "<<assinatura2>>",
            rubrica_placement: "<<visto2>>",
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.ZAPSIGN_TOKEN}`,
            },
          },
        );
        secondSigner = addSignerResponse.data;
      }

      return { ...response.data, second_signer: secondSigner };
    } catch (error) {
      console.error("Error in createContractTrocaTitularidadeTitular:", error);
      throw error;
    }
  }

  createContractTrocaTitularidadeNovoTitular = async (params: ZapSignDataTrocaTitularidade) => {
    try {
      const {
        nome,
        cpf,
        email,
        telefone,
        endereco,
        rg = "Não informado",
        telefone_conversa,
      } = params;

      const templateRepo = ApiMkDataSource.getRepository(ZapSignTemplates);
      // Try dedicated new-owner template first, fall back to general one
      const template =
        (await templateRepo.findOne({
          where: { nome_servico: "Troca de Titularidade Novo Titular", tipo: "gratis" },
        })) ||
        (await templateRepo.findOne({
          where: { nome_servico: "Troca de Titularidade", tipo: "gratis" },
        }));

      if (!template || !template.token_id) {
        throw new Error(
          "Token do template 'Troca de Titularidade' não encontrado no banco de dados.",
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
          { de: "{{termo}}", para: "Troca de Titularidade" },
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
          { de: "{{novotitular}}", para: "" },
          { de: "{{celularnovotitular}}", para: "" },
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
      console.error("Error in createContractTrocaTitularidadeNovoTitular:", error);
      throw error;
    }
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
      });
    }
  }

  private updateClientPlanInMkAuth = async (login: string, dados: any) => {
    const ClientesRepository = MkauthDataSource.getRepository(ClientesEntities);
    const client = await ClientesRepository.findOne({
      where: { login },
    });

    if (client) {
      await ClientesRepository.update(client.id, {
        plano: dados.plano || client.plano,
      });
    }
  }
}

export default new ZapSign();
