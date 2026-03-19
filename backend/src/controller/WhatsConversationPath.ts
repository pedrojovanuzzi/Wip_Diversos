import { Request, Response } from "express";
import { Faturas as Record } from "../entities/Faturas";
import {
  ClientesEntities,
  ClientesEntities as Sis_Cliente,
} from "../entities/ClientesEntities";
import { getRepository, In, IsNull } from "typeorm";
import ApiMkDataSource from "../database/API_MK";
import MkauthDataSource from "../database/MkauthSource";
import EfiPay from "sdk-node-apis-efi";
import dotenv from "dotenv";
import crypto from "crypto";
import path from "path";
import fs, { cp } from "fs";
import nodemailer from "nodemailer";
import axios from "axios";
import SftpClient from "ssh2-sftp-client";
import FormData from "form-data";
import { v4 as uuidv4 } from "uuid";
import Conversations from "../entities/APIMK/Conversations";
import ConversationsUsers from "../entities/APIMK/Conversation_Users";
import PeopleConversation from "../entities/APIMK/People_Conversations";
import Mensagens from "../entities/APIMK/Mensagens";
import Sessions from "../entities/APIMK/Sessions";
import AppDataSource from "../database/DataSource";
import moment from "moment-timezone";
import { Queue, Worker, Job } from "bullmq";

dotenv.config();

const redisOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  password: process.env.DATABASE_PASSWORD_API,
};

// --- Inbound Queue (Webhooks) ---
export const whatsappIncomingQueue = new Queue("whatsapp-incoming", {
  connection: redisOptions,
});

// --- Outbound Queue (Axios Requests) ---
export const whatsappOutgoingQueue = new Queue("whatsapp-outgoing", {
  connection: redisOptions,
});

const logFilePath = path.join(__dirname, "log.json");
const logMsgFilePath = path.join(__dirname, "msg.json");

const isSandbox = process.env.SERVIDOR_HOMOLOGACAO === "true";

const url = isSandbox
  ? `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID_TEST}/messages`
  : `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;
const urlMedia = isSandbox
  ? `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID_TEST}/media`
  : `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/media`;

const options = {
  sandbox: isSandbox,
  client_id: isSandbox
    ? process.env.CLIENT_ID_HOMOLOGACAO!
    : process.env.CLIENT_ID!,
  client_secret: isSandbox
    ? process.env.CLIENT_SECRET_HOMOLOGACAO!
    : process.env.CLIENT_SECRET!,
  certificate: isSandbox
    ? path.resolve("src", "files", process.env.CERTIFICATE_SANDBOX!)
    : path.resolve("dist", "files", process.env.CERTIFICATE_PROD!),
  validateMtls: false,
};

const transporter = nodemailer.createTransport({
  host: "smtp.mailgun.org",
  port: 587, // Porta SMTP para envio de e-mails
  secure: false, // true para 465, false para outras portas como 587
  auth: {
    user: process.env.MAILGUNNER_USER,
    pass: process.env.MAILGUNNER_PASS,
  },
  pool: true, // Ativa o uso de pool de conexões
  maxConnections: 1, // Limita o número de conexões simultâneas
  tls: {
    ciphers: "SSLv3",
  },
});

function mailOptions(msg: any) {
  const mailOptions = {
    from: process.env.MAILGUNNER_USER,
    to: process.env.EMAIL_FINANCEIRO,
    subject: `🛠️ Serviço Solicitado 🛠️`,
    html: msg,
  };
  transporter.sendMail(mailOptions);
}
const token = isSandbox
  ? process.env.CLOUD_API_ACCESS_TOKEN_TEST
  : process.env.CLOUD_API_ACCESS_TOKEN;
const sessions: { [key: string]: any } = {};

const manutencao = false;

let conversation: {
  conv_id: number | null;
  sender_id: number | null;
  receiver_id: number;
} = {
  conv_id: null,
  sender_id: null,
  receiver_id: 1,
};

async function findOrCreate(
  repository: any,
  { where, defaults }: { where: any; defaults: any },
) {
  let entity = await repository.findOne({ where });
  if (entity) {
    return [entity, false];
  }
  const newEntity = repository.create({ ...where, ...defaults });
  await repository.save(newEntity);
  return [newEntity, true];
}

// CTRL + K + CTRL + 0 MINIMIZA TODAS AS FUNÇÕES

const chave_pix = process.env.CHAVE_PIX || "";

const decryptFlowRequest = (body: any, privatePem: string) => {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  // Decrypt the AES key created by the client, usando senha se o .pem for criptografado
  const privateKeyObj = {
    key: privatePem,
    passphrase: process.env.PRIVATE_KEY_FLOWS || "", // Aquela senha '922XF5oT#' que estava no .env
  };

  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: crypto.createPrivateKey(privateKeyObj),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encrypted_aes_key, "base64"),
  );
  // Decrypt the Flow data
  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const initialVectorBuffer = Buffer.from(initial_vector, "base64");
  const TAG_LENGTH = 16;
  const encrypted_flow_data_body = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const encrypted_flow_data_tag = flowDataBuffer.subarray(-TAG_LENGTH);
  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    decryptedAesKey,
    initialVectorBuffer,
  );
  decipher.setAuthTag(encrypted_flow_data_tag);
  const decryptedJSONString = Buffer.concat([
    decipher.update(encrypted_flow_data_body),
    decipher.final(),
  ]).toString("utf-8");
  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  };
};

const encryptFlowResponse = (
  response: any,
  aesKeyBuffer: Buffer,
  initialVectorBuffer: Buffer,
) => {
  // Flip the initialization vector
  const flipped_iv = [];
  for (const pair of initialVectorBuffer.entries()) {
    flipped_iv.push(~pair[1]);
  }
  // Encrypt the response data
  const cipher = crypto.createCipheriv(
    "aes-128-gcm",
    aesKeyBuffer,
    Buffer.from(flipped_iv),
  );
  return Buffer.concat([
    cipher.update(JSON.stringify(response), "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
};

class WhatsPixController {
  processedMessages: Set<string>;
  constructor() {
    this.index = this.index.bind(this);
    this.enviarMensagemVencimento = this.enviarMensagemVencimento.bind(this);

    this.processedMessages = new Set<string>();

    this.boasVindas = this.boasVindas.bind(this);
    this.PodeMePassarOCpf = this.PodeMePassarOCpf.bind(this);
    this.validarCPF = this.validarCPF.bind(this);
    this.validarRG = this.validarRG.bind(this);
    this.MensagensComuns = this.MensagensComuns.bind(this);
    this.enviarBoleto = this.enviarBoleto.bind(this);
    this.handleMessage = this.handleMessage.bind(this);

    this.verificaType = this.verificaType.bind(this);
    this.getActiveSessionsCount = this.getActiveSessionsCount.bind(this);
    this.formatarData = this.formatarData.bind(this);
    this.resetInactivityTimer = this.resetInactivityTimer.bind(this);
    this.downloadPdfFromSftp = this.downloadPdfFromSftp.bind(this);
    this.MensagensDeMidia = this.MensagensDeMidia.bind(this);
    this.getMediaID = this.getMediaID.bind(this);

    this.MensagemBotao = this.MensagemBotao.bind(this);
    this.MensagemLista = this.MensagemLista.bind(this);
    this.MensagemTermos = this.MensagemTermos.bind(this);
    this.iniciarCadastro = this.iniciarCadastro.bind(this);
    this.LGPD = this.LGPD.bind(this);
    this.iniciarMudancaComodo = this.iniciarMudancaComodo.bind(this);
    this.Finalizar = this.Finalizar.bind(this);
    this.verify = this.verify.bind(this);
    this.saveSession = this.saveSession.bind(this);
    this.deleteSession = this.deleteSession.bind(this);
  }

  async saveSession(celular: string) {
    if (sessions[celular]) {
      const { stage, inactivityTimer, ...dados } = sessions[celular];
      // Não salvamos o timer no banco, pois ele é específico da memória em execução
      await ApiMkDataSource.getRepository(Sessions).save({
        celular,
        stage: stage || "",
        dados: dados || {},
      });
      // console.log(`Sessão salva no banco para ${celular}`);
    }
  }

  async deleteSession(celular: string) {
    if (sessions[celular]) {
      delete sessions[celular];
    }
    await ApiMkDataSource.getRepository(Sessions).delete({ celular });
    console.log(`Sessão removida do banco para ${celular}`);
  }

  async verify(req: Request, res: Response) {
    const mode = req.query["hub.mode"];
    const verify_token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const myToken = token;

    console.log(token);

    if (mode && verify_token) {
      if (mode === "subscribe" && verify_token === myToken) {
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        res.status(400).send(challenge);
      }
    } else {
      res.status(400).send(challenge);
    }
  }

  async index(req: Request, res: Response) {
    console.log("Webhook recebido");
    console.log(req.body);

    console.log(url);
    console.log(token);

    try {
      const [insertPeople] = await findOrCreate(
        ApiMkDataSource.getRepository(PeopleConversation),
        {
          where: { telefone: process.env.SENDER_NUMBER },
          defaults: { nome: "Você", telefone: process.env.SENDER_NUMBER },
        },
      );

      const [insertConversation] = await findOrCreate(
        ApiMkDataSource.getRepository(Conversations),
        {
          where: { id: conversation.receiver_id },
          defaults: { nome: "Você" },
        },
      );

      let body = req.body;
      if (body.reqbody) {
        body = body.reqbody;
      }

      // console.log(JSON.stringify(body, null, 2));

      if (!body.entry) {
        res.status(200);
        return;
      }

      if (body.entry) {
        const entryId = body.entry[0].id;

        // Se a mensagem for da conta de Teste, mas o servidor NÃO estiver em Sandbox (Produção)
        if (entryId === process.env.WHATS_BUSSINES_TESTID && !isSandbox) {
          console.log(
            `[IGNORE] Webhook de Teste (${entryId}) recebido em ambiente de Produção.`,
          );
          res.status(200).send("EVENT_RECEIVED");
          return;
        }

        // Se a mensagem NÃO for da conta de Teste (Produção), mas o servidor ESTIVER em Sandbox
        if (entryId !== process.env.WHATS_BUSSINES_TESTID && isSandbox) {
          console.log(
            `[IGNORE] Webhook de Produção (${entryId}) recebido em ambiente Sandbox.`,
          );
          res.status(200).send("EVENT_RECEIVED");
          return;
        }

        for (const entry of body.entry) {
          if (entry.changes) {
            for (const change of entry.changes) {
              const value = change.value;

              if (value && value.messages) {
                for (const message of value.messages) {
                  const messageId = message.id;

                  // Deduplicação
                  if (this.processedMessages.has(messageId)) {
                    console.log(`Mensagem duplicada ignorada: ${messageId}`);
                    continue; // Pula para a próxima mensagem
                  }

                  this.processedMessages.add(messageId);
                  // Remove o ID do conjunto após 2 minutos para liberar memória
                  setTimeout(
                    () => {
                      this.processedMessages.delete(messageId);
                    },
                    2 * 60 * 1000,
                  );

                  const celular = message.from;
                  const type = message.type;

                  if (!celular || !type) {
                    continue;
                  }

                  console.log(type + " TIPO DA MENSAGEM");

                  // Inicializa a sessão se não existir cache
                  if (!sessions[celular]) {
                    // Tenta buscar do banco
                    const sessionDB = await ApiMkDataSource.getRepository(
                      Sessions,
                    ).findOne({ where: { celular } });

                    if (sessionDB) {
                      // Verifica se a mensagem já foi processada (persistência no banco)
                      if (sessionDB.last_message_id === messageId) {
                        console.log(
                          `Mensagem duplicada (persistida) ignorada: ${messageId}`,
                        );
                        continue;
                      }

                      sessions[celular] = {
                        stage: sessionDB.stage,
                        ...sessionDB.dados,
                      };
                      console.log(
                        `Sessão recuperada do banco para ${celular}:`,
                        sessions[celular],
                      );
                    } else {
                      sessions[celular] = { stage: "" };
                      // Salva nova sessão no banco
                      await ApiMkDataSource.getRepository(Sessions).save({
                        celular: celular,
                        stage: "",
                        dados: {},
                        last_message_id: messageId, // Inicializa com o ID da mensagem atual
                      });
                    }
                  } else {
                    // Se a sessão já está em memória, verifica se o DB tem um ID mais recente (proteção extra) ou se é falha de reinicio rápido
                    // Mas o principal é atualizar o last_message_id no final do processamento
                  }

                  const session = sessions[celular];
                  let mensagemCorpo;

                  if (type === "interactive") {
                    const interactive = message.interactive;

                    if (interactive.type === "button_reply") {
                      const buttonReply = interactive.button_reply;
                      console.log("button_reply object:", buttonReply);
                      mensagemCorpo = buttonReply.title;
                    }

                    if (interactive.type === "list_reply") {
                      const listReply = interactive.list_reply;
                      console.log("list_reply object:", listReply);
                      mensagemCorpo = listReply.title;
                    }

                    if (interactive.type === "nfm_reply") {
                      // Resposta vinda de um WhatsApp Flow
                      const nfmReply = interactive.nfm_reply;
                      console.log("nfm_reply (Flow) object:", nfmReply);
                      // response_json já é uma string JSON, não precisa de stringify
                      mensagemCorpo =
                        nfmReply?.response_json ||
                        nfmReply?.body ||
                        "Flow preenchido";
                    }
                  } else {
                    mensagemCorpo = message?.text?.body;
                  }

                  if (mensagemCorpo || type) {
                    const texto = mensagemCorpo;
                    console.log(
                      `Texto recebido: ${texto}, Celular: ${celular}`,
                    );

                    if (type === "undefined" || type === undefined) {
                      console.log(`Type undefined ignorado`);
                      continue;
                    }

                    fs.readFile(logMsgFilePath, "utf8", (err, data) => {
                      let logs = [];
                      if (err && err.code === "ENOENT") {
                        console.log(
                          "Arquivo de log não encontrado, criando um novo.",
                        );
                      } else if (err) {
                        console.error("Erro ao ler o arquivo de log:", err);
                        return;
                      } else {
                        try {
                          logs = JSON.parse(data);
                          if (!Array.isArray(logs)) {
                            logs = [];
                          }
                        } catch (parseErr) {
                          console.error(
                            "Erro ao analisar o arquivo de log:",
                            parseErr,
                          );
                          logs = [];
                        }
                      }

                      const log = {
                        messages: [message],
                        timestamp: new Date().toISOString(),
                      };

                      logs.push(log);

                      const jsonString = JSON.stringify(logs, null, 2);

                      fs.writeFile(
                        logMsgFilePath,
                        jsonString,
                        "utf8",
                        (err) => {
                          if (err) {
                            console.error(
                              "Erro ao escrever no arquivo de log:",
                              err,
                            );
                          }
                        },
                      );
                    });

                    // Add the job to the BullMQ Incoming Queue instead of processing synchronously
                    whatsappIncomingQueue.add(
                      "process-message",
                      {
                        texto,
                        celular,
                        type,
                        manutencao,
                        messageId,
                      },
                      { removeOnComplete: true, removeOnFail: false },
                    );
                  }
                }
              }
            }
          }
        }
        res.status(200).send("EVENT_RECEIVED");
      } else {
        res.sendStatus(404);
      }
    } catch (error) {
      console.error("Erro ao processar o webhook:", error);
      res.status(500).send("Erro interno do servidor");
    }
  }

  getActiveSessionsCount() {
    return Object.keys(sessions).length;
  }

  resetInactivityTimer(celular: any, session: any) {
    if (session.inactivityTimer) {
      clearTimeout(session.inactivityTimer);
    }

    session.inactivityTimer = setTimeout(() => {
      this.MensagensComuns(
        celular,
        "🤷🏻 Seu atendimento foi *finalizado* devido à inatividade!!\nEntre em contato novamente 👍",
      );
      this.deleteSession(celular);
    }, 900000); // 15 minutos de inatividade
  }

  async handleMessage(
    session: any,
    texto: any,
    celular: any,
    type: any,
    manutencao: any,
  ) {
    if (
      manutencao == true &&
      celular != process.env.TEST_PHONE &&
      celular != process.env.TEST_PHONE2
    ) {
      this.MensagensComuns(
        celular,
        "Olá, no momento nosso Bot está em Manutenção ⚙, tente novamente mais tarde!",
      );
    } else {
      this.resetInactivityTimer.call(this, celular, session);

      console.log(`[HANDLE_MESSAGE] Stage: ${session.stage}, Texto: ${texto}`);

      try {
        const [insertPeople] = await findOrCreate(
          ApiMkDataSource.getRepository(PeopleConversation),
          {
            where: { telefone: celular },
            defaults: { nome: celular, telefone: celular },
          },
        );

        // Verifica se já existe uma conversa associada a esse cliente
        const existingConvUser = await ApiMkDataSource.getRepository(
          ConversationsUsers,
        ).findOne({
          where: { user_id: insertPeople.id },
        });

        let insertConversation;
        if (existingConvUser) {
          insertConversation = await ApiMkDataSource.getRepository(
            Conversations,
          ).findOneBy({
            id: existingConvUser.conv_id,
          });
        } else {
          insertConversation = await ApiMkDataSource.getRepository(
            Conversations,
          ).save({ nome: celular });

          // Vincula cliente à nova conversa
          await ApiMkDataSource.getRepository(ConversationsUsers).save({
            conv_id: insertConversation.id,
            user_id: insertPeople.id,
          });
        }

        // Verificação de segurança
        if (!insertConversation || !insertConversation.id) {
          throw new Error(
            "Conversa não pôde ser criada ou recuperada corretamente.",
          );
        }

        // Garante que o atendente (você, user_id = 1) também esteja vinculado
        await findOrCreate(ApiMkDataSource.getRepository(ConversationsUsers), {
          where: {
            conv_id: insertConversation.id,
            user_id: 1,
          },
          defaults: {
            conv_id: insertConversation.id,
            user_id: 1,
          },
        });

        // Garante novamente que o cliente também esteja vinculado (caso seja conversa já existente)
        await findOrCreate(ApiMkDataSource.getRepository(ConversationsUsers), {
          where: {
            conv_id: insertConversation.id,
            user_id: insertPeople.id,
          },
          defaults: {
            conv_id: insertConversation.id,
            user_id: insertPeople.id,
          },
        });

        // Cria a mensagem
        await ApiMkDataSource.getRepository(Mensagens).save({
          conv_id: insertConversation.id,
          sender_id: insertPeople.id,
          content: texto || "[sem conteúdo]",
          timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000), // adiciona 3 horas
        });

        // Retorna dados da conversa
        conversation = {
          conv_id: insertConversation.id,
          sender_id: insertPeople.id,
          receiver_id: 1,
        };

        if (texto && texto.toLowerCase() === "resetar") {
          await this.MensagensComuns(
            celular,
            "Sessão resetada com sucesso! Você pode iniciar uma nova conversa agora.",
          );
          await this.deleteSession(celular);
          return;
        }

        // //Easter Egg
        // if (texto === "G.O.A.T") {
        //   await this.MensagensComuns(celular, "QuinhoRox");
        //   return;
        // }

        // //Easter Egg
        // if (texto === "T.O.D.D.Y") {
        //   await this.MensagensComuns(celular, "Tem coisa que desanima");
        //   return;
        // }

        // //Easter Egg
        // if (texto === "Mamaezinha") {
        //   await this.MensagensComuns(
        //     celular,
        //     "Coquinha Geladinha para limpar os dentinhos",
        //   );
        //   return;
        // }
      } catch (error) {
        console.error("Erro ao inserir ou encontrar a pessoa:", error);
      }

      switch (session.stage) {
        //Inicio
        case "":
          await this.boasVindas(celular);

          await this.MensagemBotao(
            celular,
            "Escolha a Opção",
            "Boleto/Pix",
            "Serviços/Contratação",
            "Falar com Atendente",
          );

          session.stage = "options_start";
          break;
        case "options_start":
          if (this.verificaType(type)) {
            if (texto == "1" || texto == "Boleto/Pix") {
              await this.PodeMePassarOCpf(celular);
              session.stage = "awaiting_cpf";
            } else if (texto == "2" || texto == "Serviços/Contratação") {
              const campos = {
                sections: [
                  {
                    title: "Serviços",
                    rows: [
                      { id: "option_1", title: "Instalação" },
                      { id: "option_2", title: "Mudança de Endereço" },
                      { id: "option_3", title: "Mudança de Cômodo" },
                      { id: "option_4", title: "Troca de Titularidade" },
                      { id: "option_5", title: "Alteração de Plano" },
                      { id: "option_6", title: "Renovação Contratual" },
                      { id: "option_7", title: "Wifi Estendido" },
                    ],
                  },
                ],
              };
              await this.MensagemLista(celular, "Escolha um Serviço", campos);
              await this.MensagensComuns(
                celular,
                "Caso deseje voltar a aba inicial, digite *inicio*",
              );
              session.stage = "awaiting_service";
            } else if (texto == "3" || texto == "Falar com Atendente") {
              await this.MensagensComuns(
                celular,
                "Caso queira falar com um *Atendente*, acesse esse Link das 8 às 20h 👍🏻 https://wa.me/message/C3QNNVFXJWK5A1",
              );
              await this.MensagensComuns(
                celular,
                "👉🏻 Digite *continuar* para terminar o atendimento",
              );
              session.stage = "end";
            } else {
              await this.MensagensComuns(
                celular,
                "⚠️ Seleção *Inválida*, Verifique se Digitou o Número Corretamente!!!",
              );
            }
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, *selecione* uma opção válida!!",
            );
          }

          break;
        case "awaiting_service":
          if (this.verificaType(type)) {
            if (
              texto.toLowerCase() === "instalaçao" ||
              texto.toLowerCase() === "instalação"
            ) {
              await this.LGPD(celular);
              session.stage = "lgpd_request";
              session.service = "instalacao";
            } else if (
              texto.toLowerCase() === "mudança de endereço" ||
              texto.toLowerCase() === "mudanca de endereco"
            ) {
              await this.LGPD(celular);
              session.stage = "lgpd_request";
              session.service = "mudanca_endereco";
            } else if (
              texto.toLowerCase() === "mudança de cômodo" ||
              texto.toLowerCase() === "mudanca de comodo"
            ) {
              await this.LGPD(celular);
              session.stage = "lgpd_request";
              session.service = "mudanca_comodo";
            } else if (texto.toLowerCase() === "troca de titularidade") {
              await this.LGPD(celular);
              session.stage = "lgpd_request";
              session.service = "troca_titularidade";
            } else if (texto.toLowerCase() === "alteração de plano") {
              await this.LGPD(celular);
              session.stage = "lgpd_request";
              session.service = "troca_plano";
            } else if (texto.toLowerCase() === "wifi estendido") {
              await this.LGPD(celular);
              session.stage = "lgpd_request";
              session.service = "wifi_estendido";
            } else if (
              texto.toLowerCase() === "inicio" ||
              texto.toLowerCase() === "inicío" ||
              texto.toLowerCase() === "início"
            ) {
              await this.boasVindas(celular);
              await this.MensagemBotao(
                celular,
                "Escolha a Opção",
                "Boleto/Pix",
                "Serviços/Contratação",
                "Falar com Atendente",
              );
              session.stage = "options_start";
            } else if (texto.toLowerCase() === "renovação contratual") {
              await this.LGPD(celular);
              session.stage = "lgpd_request";
              session.service = "renovação_contratual";
            } else {
              await this.MensagensComuns(
                celular,
                "Opção Invalída, Selecione a Opção da Lista",
              );
            }
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção da Lista",
            );
          }
          break;
        case "lgpd_request":
          if (this.verificaType(type)) {
            if (texto.toLowerCase() === "sim aceito") {
              if (session.service === "instalacao") {
                session.stage = "awaiting_flow_cadastro";
                await this.MensagemFlow(
                  celular,
                  "Cadastro",
                  "📋 Preencha seus dados",
                );
              } else if (session.service === "mudanca_endereco") {
                session.stage = "mudanca_endereco";
                await this.iniciarMudanca(celular, texto, session, type);
              } else if (session.service === "mudanca_comodo") {
                session.stage = "mudanca_comodo";
                await this.iniciarMudancaComodo(celular, texto, session, type);
              } else if (session.service === "troca_titularidade") {
                session.stage = "troca_titularidade";
                await this.MensagemBotao(
                  celular,
                  "Você é o Titular do Cadastro?",
                  "Sim",
                  "Não",
                );
              } else if (session.service === "troca_plano") {
                session.stage = "troca_plano";
                await this.iniciarTrocaPlano(celular, texto, session, type);
              } else if (session.service === "renovação_contratual") {
                session.stage = "renovacao";
                await this.iniciarRenovacao(celular, texto, session, type);
              } else if (session.service === "wifi_estendido") {
                session.stage = "wifi_est";
                await this.iniciarWifiEstendido(celular, texto, session, type);
              }
            } else if (
              texto.toLowerCase() === "não" ||
              texto.toLowerCase() === "nao"
            ) {
              await this.MensagensComuns(
                celular,
                "🥹 *Infelizmente* não poderei mais dar \ncontinuidade ao seu atendimento, *respeitando* a sua vontade.\n🫡Estaremos sempre aqui a sua *disposição*!",
              );
              if (sessions[celular] && sessions[celular].inactivityTimer) {
                clearTimeout(sessions[celular].inactivityTimer);
              }
              this.deleteSession(celular);
            } else {
              await this.MensagensComuns(
                celular,
                "Aperte nos Botoes de Sim ou Não",
              );
            }
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção dos Botoes",
            );
          }
          break;
        case "choose_type_payment":
          try {
            if (this.verificaType(type)) {
              if (
                texto === "Pix" ||
                texto === "Dinheiro" ||
                texto === "Cartão"
              ) {
                if (session.service === "mudanca_endereco") {
                  const pagamento = texto;
                  await this.MensagensComuns(
                    celular,
                    "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nUm de nossos *atendentes* entrará em contato para concluir a sua *mudança de endereço*\n\n*Clique no botão abaixo para finalizar*",
                  );
                  let dadosCliente = session.dadosCompleto
                    ? JSON.stringify(session.dadosCompleto, null, 2)
                    : "Dados não encontrados";
                  session.msgDadosFinais = `*🏠 Mudança de Endereço* \n\n*💰 Forma: Paga com ${pagamento}*\nDados do Cliente: ${dadosCliente}`;

                  fs.readFile(logMsgFilePath, "utf8", (err, data) => {
                    let logs = [];
                    if (err && err.code === "ENOENT") {
                      console.log(
                        "Arquivo de log não encontrado, criando um novo.",
                      );
                    } else if (err) {
                      console.error("Erro ao ler o arquivo de log:", err);
                      return;
                    } else {
                      try {
                        logs = JSON.parse(data);
                        if (!Array.isArray(logs)) {
                          logs = [];
                        }
                      } catch (parseErr) {
                        console.error(
                          "Erro ao analisar o arquivo de log:",
                          parseErr,
                        );
                        logs = [];
                      }
                    }

                    const log = {
                      messages: session.msgDadosFinais,
                      timestamp: new Date().toISOString(),
                    };

                    logs.push(log);

                    const jsonString = JSON.stringify(logs, null, 2);

                    fs.writeFile(logMsgFilePath, jsonString, "utf8", (err) => {
                      if (err) {
                        console.error(
                          "Erro ao escrever no arquivo de log:",
                          err,
                        );
                        return;
                      }
                      console.log("Log atualizado com sucesso!");
                    });
                  });

                  mailOptions(session.msgDadosFinais);
                  await this.MensagemBotao(
                    celular,
                    "Concluir Solicitação",
                    "Finalizar",
                  );

                  session.stage = "finalizar";
                } else if (session.service === "mudanca_comodo") {
                  const pagamento = texto;
                  await this.MensagensComuns(
                    celular,
                    "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nUm de nossos *atendentes* entrará em contato para concluir a sua *mudança de cômodo*\n\n*Clique no Botão abaixo para finalizar*",
                  );
                  let dadosCliente = session.dadosCompleto
                    ? JSON.stringify(session.dadosCompleto, null, 2)
                    : "Dados não encontrados";
                  session.msgDadosFinais = `*🧱 Mudança de Cômodo* \n\n*💰 Forma: Paga com ${pagamento}*\nDados do Cliente: ${dadosCliente}`;

                  fs.readFile(logMsgFilePath, "utf8", (err, data) => {
                    let logs = [];
                    if (err && err.code === "ENOENT") {
                      console.log(
                        "Arquivo de log não encontrado, criando um novo.",
                      );
                    } else if (err) {
                      console.error("Erro ao ler o arquivo de log:", err);
                      return;
                    } else {
                      try {
                        logs = JSON.parse(data);
                        if (!Array.isArray(logs)) {
                          logs = [];
                        }
                      } catch (parseErr) {
                        console.error(
                          "Erro ao analisar o arquivo de log:",
                          parseErr,
                        );
                        logs = [];
                      }
                    }

                    const log = {
                      messages: session.msgDadosFinais,
                      timestamp: new Date().toISOString(),
                    };

                    logs.push(log);

                    const jsonString = JSON.stringify(logs, null, 2);

                    fs.writeFile(logMsgFilePath, jsonString, "utf8", (err) => {
                      if (err) {
                        console.error(
                          "Erro ao escrever no arquivo de log:",
                          err,
                        );
                        return;
                      }
                      console.log("Log atualizado com sucesso!");
                    });
                  });
                  mailOptions(session.msgDadosFinais);
                  await this.MensagemBotao(
                    celular,
                    "Concluir Solicitação",
                    "Finalizar",
                  );
                  session.stage = "finalizar";
                }
              } else {
                await this.MensagensComuns(
                  celular,
                  "Invalido, aperte em um Botão da lista",
                );
              }
            } else {
              await this.MensagensComuns(
                celular,
                "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção da Lista",
              );
            }
          } catch (error) {
            console.log(error);
          }
          break;

        //Cadastro via Flow
        case "awaiting_flow_cadastro":
          // Verifica se o texto é um JSON vindo do nfm_reply (resposta do Flow)
          try {
            const dadosFlow = JSON.parse(texto);
            if (dadosFlow && dadosFlow.nome) {
              console.log("Dados recebidos do Flow Cadastro:", dadosFlow);

              // Popula a sessão com os dados do formulário
              session.dadosCompleto = {
                nome: dadosFlow.nome,
                rg: dadosFlow.rg,
                cpf: dadosFlow.cpf,
                dataNascimento: dadosFlow.dataNascimento,
                celular: dadosFlow.celular,
                celularSecundario: dadosFlow.celularSecundario || "",
                email: dadosFlow.email,
                cep: dadosFlow.cep,
                rua: dadosFlow.rua,
                numero: dadosFlow.numero,
                bairro: dadosFlow.bairro,
                cidade: dadosFlow.cidade,
                estado: dadosFlow.estado,
              };

              const planoFlow = dadosFlow.plano || "";
              session.planoEscolhido = planoFlow;

              await this.MensagensComuns(
                celular,
                `✅ *Cadastro recebido com sucesso!*\n\n` +
                  `👤 *Nome:* ${dadosFlow.nome}\n` +
                  `📄 *CPF:* ${dadosFlow.cpf}\n` +
                  `📍 *Endereço:* ${dadosFlow.rua}, ${dadosFlow.numero} - ${dadosFlow.bairro}\n` +
                  `🏙️ *Cidade:* ${dadosFlow.cidade}/${dadosFlow.estado}\n` +
                  `📶 *Plano:* ${planoFlow}\n\n` +
                  `Aguarde, estamos finalizando...`,
              );

              // === Salvar no MKAuth ===
              const ClientesRepository =
                MkauthDataSource.getRepository(ClientesEntities);

              let ibgeCode: string | null = null;
              try {
                const ufStr = (dadosFlow.estado || "").trim().toLowerCase();
                const cityStr = (dadosFlow.cidade || "").trim().toLowerCase();
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

              try {
                const findLogin = await ClientesRepository.findOne({
                  where: {
                    login: (dadosFlow.nome || "")
                      .trim()
                      .replace(/\s/g, "")
                      .toUpperCase(),
                  },
                });

                if (findLogin) {
                  console.log("Login já existe:", findLogin);
                  dadosFlow.nome = dadosFlow.nome + " " + findLogin.id;
                }

                const celularFormatado = (dadosFlow.celular || "").replace(
                  /\D/g,
                  "",
                );
                const celular2Formatado = (
                  dadosFlow.celularSecundario || ""
                ).replace(/\D/g, "");

                const addClient = await ClientesRepository.save({
                  nome: (dadosFlow.nome || "").toUpperCase(),
                  login: (dadosFlow.nome || "")
                    .trim()
                    .replace(/\s/g, "")
                    .toUpperCase(),
                  rg: (dadosFlow.rg || "").trim().replace(/\s/g, ""),
                  cpf_cnpj: (dadosFlow.cpf || "").trim().replace(/\s/g, ""),
                  uuid_cliente: `019b${uuidv4().slice(0, 32)}`,
                  email: (dadosFlow.email || "").trim().replace(/\s/g, ""),
                  cidade: `${(dadosFlow.cidade || "").trim().slice(0, 1).toUpperCase()}${(dadosFlow.cidade || "").trim().slice(1)}`,
                  bairro: (dadosFlow.bairro || "").toUpperCase().trim(),
                  estado: (dadosFlow.estado || "")
                    .toUpperCase()
                    .replace(/\s/g, "")
                    .slice(0, 2),
                  nascimento: (dadosFlow.dataNascimento || "").replace(
                    /(\d{2})\/(\d{2})\/(\d{4})/,
                    "$3-$2-$1",
                  ),
                  numero: (dadosFlow.numero || "").trim().replace(/\s/g, ""),
                  endereco: (dadosFlow.rua || "").toUpperCase().trim(),
                  cep: `${(dadosFlow.cep || "").trim().replace(/\s/g, "").slice(0, 5)}-${(dadosFlow.cep || "").trim().replace(/\s/g, "").slice(5)}`,
                  plano: planoFlow,
                  pool_name: "LAN_PPPOE",
                  plano15: "Plano_15",
                  plano_bloqc: "Plano_bloqueado",
                  vendedor: "SCM",
                  conta: "3",
                  comodato: "sim",
                  cidade_ibge: ibgeCode || "3503406",
                  fone: "(14)3296-1608",
                  venc: (dadosFlow.vencimento || "")
                    .trim()
                    .replace(/\s/g, "")
                    .replace(/\D/g, ""),
                  celular:
                    celularFormatado.length >= 4
                      ? `(${celularFormatado.slice(0, 2)})${celularFormatado.slice(2)}`
                      : celularFormatado,
                  celular2:
                    celular2Formatado.length >= 4
                      ? `(${celular2Formatado.slice(0, 2)})${celular2Formatado.slice(2)}`
                      : celular2Formatado,
                  estado_res: (dadosFlow.estado || "")
                    .toUpperCase()
                    .replace(/\s/g, "")
                    .slice(0, 2),
                  bairro_res: (dadosFlow.bairro || "").toUpperCase().trim(),
                  tipo: "pppoe",
                  cidade_res: `${(dadosFlow.cidade || "").trim().slice(0, 1).toUpperCase()}${(dadosFlow.cidade || "").trim().slice(1)}`,
                  cep_res: `${(dadosFlow.cep || "").trim().replace(/\s/g, "").slice(0, 5)}-${(dadosFlow.cep || "").trim().replace(/\s/g, "").slice(5)}`,
                  numero_res: (dadosFlow.numero || "")
                    .trim()
                    .replace(/\s/g, ""),
                  endereco_res: (dadosFlow.rua || "").toUpperCase().trim(),
                  tipo_cob: "titulo",
                  mesref: "now",
                  prilanc: "tot",
                  pessoa:
                    (dadosFlow.cpf || "").replace(/\D/g, "").length <= 11
                      ? "fisica"
                      : "juridica",
                  dias_corte: 80,
                  cadastro: moment().format("DD-MM-YYYY").split("-").join("/"),
                  data_ip: moment().format("YYYY-MM-DD HH:mm:ss"),
                  data_ins: moment().format("YYYY-MM-DD HH:mm:ss"),
                });

                await ClientesRepository.update(addClient.id, {
                  termo: `${addClient.id}C/${moment().format("YYYY")}`,
                });

                console.log("Cliente salvo com sucesso no MKAuth:", addClient);
              } catch (dbError) {
                console.error("Erro ao salvar cliente no MKAuth:", dbError);
              }

              // Envia os termos e avança
              await this.MensagemTermos(
                celular,
                "Contrato Hospedado",
                "Este é o Nosso Contrato Oficial Completo",
                "Ler o contrato",
                "https://wiptelecomunicacoes.com.br/contrato",
              );

              const resumoCadastro =
                `📋 *Novo Cadastro via Flow*\n\n` +
                `👤 *Nome:* ${dadosFlow.nome}\n` +
                `📄 *CPF:* ${dadosFlow.cpf}\n` +
                `🪪 *RG:* ${dadosFlow.rg}\n` +
                `🎂 *Nascimento:* ${dadosFlow.dataNascimento}\n` +
                `📱 *Celular:* ${dadosFlow.celular}\n` +
                `📧 *Email:* ${dadosFlow.email}\n` +
                `📍 *Endereço:* ${dadosFlow.rua}, ${dadosFlow.numero} - ${dadosFlow.bairro}\n` +
                `🏙️ *Cidade:* ${dadosFlow.cidade}/${dadosFlow.estado}\n` +
                `📮 *CEP:* ${dadosFlow.cep}\n` +
                `📶 *Plano:* ${planoFlow}`;

              await this.Finalizar(resumoCadastro, celular, sessions);
              session.stage = "end";
              break;
            }
          } catch (e) {
            // Não é JSON, o usuário mandou texto normal
          }
          // Se não foi uma resposta de Flow, pede pra preencher
          await this.MensagensComuns(
            celular,
            "📋 Por favor, preencha o formulário do *Cadastro* clicando no botão acima.",
          );
          break;
        case "plan":
          if (this.verificaType(type)) {
            let planoEscolhido;
            if (texto === "🟣 400 MEGA R$ 89,90") {
              planoEscolhido = "🟣 400 MEGA R$ 89,90";
            } else if (texto === "🟩 500 MEGA R$ 99,90") {
              planoEscolhido = "🟩 500 MEGA R$ 99,90";
            } else if (texto === "🔴 600 MEGA R$ 109,90") {
              planoEscolhido = "🔴 600 MEGA R$ 109,90";
            } else if (texto === "🟡 700 MEGA R$ 129,90") {
              planoEscolhido = "🟡 700 MEGA R$ 129,90";
            } else if (texto === "🟦 800 MEGA R$ 159,90") {
              planoEscolhido = "🟦 800 MEGA R$ 159,90";
            } else if (texto === "🟤 340 MEGA R$ 159,90") {
              planoEscolhido = "🟤 340 MEGA R$ 159,90";
            } else if (texto === "🟠 500 MEGA R$ 199,90") {
              planoEscolhido = "🟠 500 MEGA R$ 199,90";
            } else if (texto === "🟩 20 MEGA R$ 89,90") {
              planoEscolhido = "🟩 20 MEGA R$ 89,90";
            } else if (texto === "🟦 30 MEGA R$ 119,90") {
              planoEscolhido = "🟦 30 MEGA R$ 119,90";
            } else {
              await this.MensagensComuns(
                celular,
                "*Opção Invalida* 😞\n🙏🏻Por gentileza, Selecione uma Opção da Lista",
              );
              session.stage = "plan";
              return;
            }

            session.planoEscolhido = planoEscolhido;

            await this.MensagensComuns(
              celular,
              "🗓️ Vamos escolher a *Data* mensal de *Vencimento* da sua fatura!",
            );
            await this.MensagemLista(celular, "Escolha seu Vencimento", {
              sections: [
                {
                  title: "Escolha seu Vencimento",
                  rows: [
                    { id: "option_1", title: "DIA 05" },
                    { id: "option_2", title: "DIA 10" },
                    { id: "option_3", title: "DIA 15" },
                    { id: "option_4", title: "DIA 20" },
                  ],
                },
              ],
            });

            session.stage = "venc_date";
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção da Lista",
            );
          }
          break;
        case "venc_date":
          if (this.verificaType(type)) {
            let vencimentoEscolhido;
            if (texto === "DIA 05") {
              vencimentoEscolhido = "Dia 05";
            } else if (texto === "DIA 10") {
              vencimentoEscolhido = "Dia 10";
            } else if (texto === "DIA 15") {
              vencimentoEscolhido = "Dia 15";
            } else if (texto === "DIA 20") {
              vencimentoEscolhido = "Dia 20";
            } else {
              await this.MensagensComuns(
                celular,
                "*Opção Invalida* 😞\n🙏🏻Por gentileza, Selecione uma Opção da Lista",
              );
              session.stage = "venc_date";
              return;
            }
            session.vencimentoEscolhido = vencimentoEscolhido;
            await this.MensagemTermos(
              celular,
              "🙂 Estamos quase terminando!",
              "🗂️ Peço que *leia atenciosamente* as *informações* e o *Contrato* hospedado disponíveis abaixo, não restando nenhuma *dúvida* na sua *contratação*!",
              "Ler Informações",
              "https://wipdiversos.wiptelecomunicacoes.com.br/doc/contratação",
            );
            await this.MensagemTermos(
              celular,
              "Contrato Hospedado",
              "Este é o Nosso Contrato Oficial Completo",
              "Ler o contrato",
              "https://wiptelecomunicacoes.com.br/contrato",
            );
            await this.MensagemBotao(
              celular,
              "🆗 *Li* e estou *de acordo* com as *informações* dadas e todos os termos do *Contrato*.",
              "Sim, li e aceito",
              "Não",
            );
            session.stage = "final_register";
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção da Lista",
            );
          }
          break;
        case "final_register":
          try {
            if (this.verificaType(type)) {
              if (texto.toLowerCase() === "sim, li e aceito") {
                await this.MensagensComuns(
                  celular,
                  "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\n🔍 Vamos realizar a *Consulta do seu CPF*. \nUm de nossos *atendentes* entrará em contato para finalizar a sua *contratação* enviando o *link* com os *Termos de Adesão e Contrato de Permanência* a serem *assinados*\n\n*Clique no Botão abaixo para finalizar*",
                );
                let dadosCliente = session.dadosCompleto
                  ? JSON.stringify(session.dadosCompleto, null, 2)
                  : "Dados não encontrados";
                session.msgDadosFinais = `*🧑 Instalação Nova* \nPlano Escolhido: ${session.planoEscolhido}\nVencimento: ${session.vencimentoEscolhido}\nDados do Cliente: ${dadosCliente}`;

                fs.readFile(logMsgFilePath, "utf8", (err, data) => {
                  let logs = [];
                  if (err && err.code === "ENOENT") {
                    console.log(
                      "Arquivo de log não encontrado, criando um novo.",
                    );
                  } else if (err) {
                    console.error("Erro ao ler o arquivo de log:", err);
                    return;
                  } else {
                    try {
                      logs = JSON.parse(data);
                      if (!Array.isArray(logs)) {
                        logs = [];
                      }
                    } catch (parseErr) {
                      console.error(
                        "Erro ao analisar o arquivo de log:",
                        parseErr,
                      );
                      logs = [];
                    }
                  }

                  const log = {
                    messages: session.msgDadosFinais,
                    timestamp: new Date().toISOString(),
                  };

                  logs.push(log);

                  const jsonString = JSON.stringify(logs, null, 2);

                  fs.writeFile(logMsgFilePath, jsonString, "utf8", (err) => {
                    if (err) {
                      console.error("Erro ao escrever no arquivo de log:", err);
                      return;
                    }
                    console.log("Log atualizado com sucesso!");
                  });
                });

                mailOptions(session.msgDadosFinais);

                const ClientesRepository =
                  MkauthDataSource.getRepository(ClientesEntities);

                let ibgeCode: string | null = null;
                try {
                  const ufStr = (session.dadosCompleto.estado || "")
                    .trim()
                    .toLowerCase();
                  const cityStr = (session.dadosCompleto.cidade || "")
                    .trim()
                    .toLowerCase();
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

                try {
                  const findLogin = await ClientesRepository.findOne({
                    where: {
                      login: (session.dadosCompleto.nome || "")
                        .trim()
                        .replace(/\s/g, "")
                        .toUpperCase(),
                    },
                  });

                  if (findLogin) {
                    console.log("Login já existe:", findLogin);
                    session.dadosCompleto.nome =
                      session.dadosCompleto.nome + " " + findLogin.id;
                  }

                  const addClient = await ClientesRepository.save({
                    nome: (session.dadosCompleto.nome || "").toUpperCase(),
                    login: (session.dadosCompleto.nome || "")
                      .trim()
                      .replace(/\s/g, "")
                      .toUpperCase(),
                    rg: session.dadosCompleto.rg.trim().replace(/\s/g, ""),
                    cpf_cnpj: session.dadosCompleto.cpf
                      .trim()
                      .replace(/\s/g, ""),
                    uuid_cliente: `019b${uuidv4().slice(0, 32)}`,
                    email: session.dadosCompleto.email
                      .trim()
                      .replace(/\s/g, ""),
                    cidade: `${session.dadosCompleto.cidade
                      .trim()
                      .slice(0, 1)
                      .toUpperCase()}${session.dadosCompleto.cidade
                      .trim()
                      .slice(1)}`,
                    bairro: session.dadosCompleto.bairro.toUpperCase().trim(),
                    estado: (session.dadosCompleto.estado || "")
                      .toUpperCase()
                      .replace(/\s/g, "")
                      .slice(0, 2),
                    nascimento: session.dadosCompleto.dataNascimento.replace(
                      /(\d{2})\/(\d{2})\/(\d{4})/,
                      "$3-$2-$1",
                    ),
                    numero: session.dadosCompleto.numero
                      .trim()
                      .replace(/\s/g, ""),
                    endereco: session.dadosCompleto.rua.toUpperCase().trim(),
                    cep: `${session.dadosCompleto.cep
                      .trim()
                      .replace(/\s/g, "")
                      .slice(0, 5)}-${session.dadosCompleto.cep
                      .trim()
                      .replace(/\s/g, "")
                      .slice(5)}`,
                    plano: session.planoEscolhido,
                    pool_name: "LAN_PPPOE",
                    plano15: "Plano_15",
                    plano_bloqc: "Plano_bloqueado",
                    vendedor: "SCM",
                    conta: "3",
                    comodato: "sim",
                    cidade_ibge: ibgeCode || "3503406",
                    fone: "(14)3296-1608",
                    venc: (session.vencimentoEscolhido || "")
                      .trim()
                      .replace(/\s/g, "")
                      .replace(/\D/g, ""),
                    celular: `(${session.dadosCompleto.celular.slice(
                      0,
                      2,
                    )})${session.dadosCompleto.celular.slice(2)}`,
                    celular2: `(${session.dadosCompleto.celularSecundario.slice(
                      0,
                      2,
                    )})${session.dadosCompleto.celularSecundario.slice(2)}`,
                    estado_res: (session.dadosCompleto.estado || "")
                      .toUpperCase()
                      .replace(/\s/g, "")
                      .slice(0, 2),
                    bairro_res: session.dadosCompleto.bairro
                      .toUpperCase()
                      .trim(),
                    tipo: "pppoe",
                    cidade_res: `${session.dadosCompleto.cidade
                      .trim()
                      .slice(0, 1)
                      .toUpperCase()}${session.dadosCompleto.cidade
                      .trim()
                      .slice(1)}`,
                    cep_res: `${session.dadosCompleto.cep
                      .trim()
                      .replace(/\s/g, "")
                      .slice(0, 5)}-${session.dadosCompleto.cep
                      .trim()
                      .replace(/\s/g, "")
                      .slice(5)}`,
                    numero_res: session.dadosCompleto.numero
                      .trim()
                      .replace(/\s/g, ""),
                    endereco_res: session.dadosCompleto.rua
                      .toUpperCase()
                      .trim(),
                    tipo_cob: "titulo",
                    mesref: "now",
                    prilanc: "tot",
                    pessoa:
                      session.dadosCompleto.cpf.replace(/\D/g, "").length <= 11
                        ? "fisica"
                        : "juridica",
                    dias_corte: 80,
                    cadastro: moment()
                      .format("DD-MM-YYYY")
                      .split("-")
                      .join("/"),
                    data_ip: moment().format("YYYY-MM-DD HH:mm:ss"),
                    data_ins: moment().format("YYYY-MM-DD HH:mm:ss"),
                  });
                  await ClientesRepository.update(addClient.id, {
                    termo: `${addClient.id}C/${moment().format("YYYY")}`,
                  });

                  console.log("Cliente salvo com sucesso:", addClient);
                } catch (dbError) {
                  console.error("Erro ao salvar cliente no banco:", dbError);
                }

                console.log(
                  "Tentando enviar botão de finalização para:",
                  celular,
                );
                try {
                  await this.MensagemBotao(
                    celular,
                    "Concluir Solicitação",
                    "Finalizar",
                  );
                  console.log("Botão de finalização enviado com sucesso.");
                } catch (btnError) {
                  console.error(
                    "Erro ao enviar botão de finalização:",
                    btnError,
                  );
                }
                session.stage = "finalizar";
              } else if (
                texto.toLowerCase() === "não" ||
                texto.toLowerCase() === "nao"
              ) {
                await this.MensagensComuns(
                  celular,
                  "🥹 *Infelizmente* não poderei mais dar \ncontinuidade ao seu atendimento, *respeitando* a sua vontade.\n🫡Estaremos sempre aqui a sua *disposição*!",
                );
                setTimeout(() => {
                  if (sessions[celular] && sessions[celular].inactivityTimer) {
                    clearTimeout(sessions[celular].inactivityTimer);
                  }
                  this.deleteSession(celular);
                }, 5000); // Espera 5 segundos antes de limpar
              } else {
                await this.MensagensComuns(
                  celular,
                  "Opção invalida 😞\n🙏🏻Por gentileza, Selecione um Botão",
                );
              }
            } else {
              await this.MensagensComuns(
                celular,
                "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione um Botão",
              );
            }
          } catch (error) {
            console.log(error);
          }
          break;

        //Mudança de Cômodo
        case "mudanca_comodo":
          await this.iniciarMudancaComodo(celular, texto, session, type);
          break;
        case "choose_type_comodo":
          try {
            if (this.verificaType(type)) {
              try {
                if (texto.toLowerCase() === "paga") {
                  await this.MensagemBotao(
                    celular,
                    "Escolha Forma de Pagamento",
                    "Pix",
                    "Cartão",
                    "Dinheiro",
                  );
                  session.stage = "choose_type_payment";
                } else if (
                  texto.toLowerCase() === "grátis" ||
                  texto.toLowerCase() === "gratis"
                ) {
                  await this.MensagensComuns(
                    celular,
                    "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nUm de nossos *atendentes* entrará em contato para concluir a sua *mudança de cômodo* enviando o *link* com os *Termos de Adesão e Contrato de Permanência* a serem *assinados*\n\n*Clique no botão abaixo para finalizar*",
                  );
                  let dadosCliente = session.dadosCompleto
                    ? JSON.stringify(session.dadosCompleto, null, 2)
                    : "Dados não encontrados";
                  session.msgDadosFinais = `*🧱 Mudança de Cômodo* \n\n*🆓 Forma: Gratis*\nDados do Cliente: ${dadosCliente}`;

                  fs.readFile(logMsgFilePath, "utf8", (err, data) => {
                    let logs = [];
                    if (err && err.code === "ENOENT") {
                      console.log(
                        "Arquivo de log não encontrado, criando um novo.",
                      );
                    } else if (err) {
                      console.error("Erro ao ler o arquivo de log:", err);
                      return;
                    } else {
                      try {
                        logs = JSON.parse(data);
                        if (!Array.isArray(logs)) {
                          logs = [];
                        }
                      } catch (parseErr) {
                        console.error(
                          "Erro ao analisar o arquivo de log:",
                          parseErr,
                        );
                        logs = [];
                      }
                    }

                    const log = {
                      messages: session.msgDadosFinais,
                      timestamp: new Date().toISOString(),
                    };

                    logs.push(log);

                    const jsonString = JSON.stringify(logs, null, 2);

                    fs.writeFile(logMsgFilePath, jsonString, "utf8", (err) => {
                      if (err) {
                        console.error(
                          "Erro ao escrever no arquivo de log:",
                          err,
                        );
                        return;
                      }
                      console.log("Log atualizado com sucesso!");
                    });
                  });
                  mailOptions(session.msgDadosFinais);
                  await this.MensagemBotao(
                    celular,
                    "Concluir Solicitação",
                    "Finalizar",
                  );

                  session.stage = "finalizar";
                } else {
                  await this.MensagensComuns(
                    celular,
                    "Opção Invalída, Selecione a Opção da Lista",
                  );
                }
              } catch (err) {
                console.log(err);
              }
            } else {
              await this.MensagensComuns(
                celular,
                "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção da Lista",
              );
            }
          } catch (error) {
            console.log(error);
          }
          break;

        //Troca de Titularidade
        case "troca_titularidade":
          if (this.verificaType(type)) {
            if (texto.toLowerCase() === "sim") {
              await this.MensagemTermos(
                celular,
                "Contrato Hospedado",
                "Este é o Nosso Contrato Oficial Completo",
                "Ler o contrato",
                "https://wiptelecomunicacoes.com.br/contrato",
              );
              await this.MensagemTermos(
                celular,
                "Termos Troca de Titularidade",
                "📄 Para dar *continuidade*, é preciso que *leia* o *Termo* abaixo e escolha a opção que deseja.",
                "Ler Termos",
                "https://wipdiversos.wiptelecomunicacoes.com.br/doc/troca_de_titularidade",
              );
              await this.MensagemBotao(
                celular,
                "Escolha a Opção",
                "Concordo",
                "Não Concordo",
              );
              session.stage = "handle_titularidade";
            } else if (
              texto.toLowerCase() === "não" ||
              texto.toLowerCase() === "nao"
            ) {
              await this.MensagensComuns(
                celular,
                "🤷🏽 *Infelizmente* não podemos dar continuidade ao seu *atendimento* por não ser o *Titular do Cadastro!!!*",
              );
              clearTimeout(sessions[celular].inactivityTimer);
              delete sessions[celular];
            } else {
              await this.MensagensComuns(
                celular,
                "Aperte nos Botoes de Sim ou Não",
              );
            }
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção dos Botoes",
            );
          }
          break;
        case "handle_titularidade":
          if (this.verificaType(type)) {
            if (texto.toLowerCase() === "concordo") {
              await this.iniciarMudancaTitularidade(
                celular,
                texto,
                session,
                type,
              );
              session.stage = "handle_titularidade_2";
            } else if (
              texto.toLowerCase() === "não concordo" ||
              texto.toLowerCase() === "nao concordo"
            ) {
              await this.MensagensComuns(
                celular,
                "🤷🏽 *Infelizmente* não podemos dar continuidade ao seu *atendimento* por não Aceitar os *Termos!!*",
              );
              clearTimeout(sessions[celular].inactivityTimer);
              delete sessions[celular];
            } else {
              await this.MensagensComuns(
                celular,
                "Aperte nos Botoes de Sim ou Não",
              );
            }
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção dos Botoes",
            );
          }
          break;
        case "wifi_est":
          await this.iniciarWifiEstendido(celular, texto, session, type);
          break;
        case "choose_est":
          if (this.verificaType(type)) {
            if (texto.toLowerCase() === "sim concordo") {
              await this.MensagensComuns(
                celular,
                "👍🏻 *Confirmação* para Instalação de *Wi-Fi Estendido*",
              );
              await this.MensagemBotao(
                celular,
                "Escolha a opção desejada:",
                "Wifi 100 Mbps",
                "Wifi 1000 Mbps",
              );
              session.stage = "choose_wifi_est";
            } else if (
              texto.toLowerCase() === "não" ||
              texto.toLowerCase() === "nao"
            ) {
              await this.MensagensComuns(
                celular,
                "🤷🏽 *Infelizmente* não podemos dar continuidade ao seu *atendimento* por não Aceitar os *Termos!!*",
              );
              clearTimeout(sessions[celular].inactivityTimer);
              delete sessions[celular];
            } else {
              await this.MensagensComuns(
                celular,
                "Aperte nos Botoes de Sim ou Não",
              );
            }
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção dos Botoes",
            );
          }
          break;
        case "handle_titularidade_2":
          await this.iniciarMudancaTitularidade(celular, texto, session, type);
          break;

        case "choose_wifi_est":
          if (this.verificaType(type)) {
            if (texto.toLowerCase() === "wifi 100 mbps") {
              await this.MensagensComuns(
                celular,
                "⚠️ *Atenção* \nCada plano possui *valor distinto*, previamente informado por telefone ao cliente, e devidamente descrito no *Termo de Adesão*, que deverá ser assinado digitalmente antes da realização da instalação.",
              );
              await this.MensagemBotao(
                celular,
                "Concluir Solicitação",
                "Concluir",
              );
              session.stage = "choose_wifi_est_100";
            } else if (texto.toLowerCase() === "wifi 1000 mbps") {
              await this.MensagensComuns(
                celular,
                "⚠️ *Atenção* \nCada plano possui *valor distinto*, previamente informado por telefone ao cliente, e devidamente descrito no *Termo de Adesão*, que deverá ser assinado digitalmente antes da realização da instalação.",
              );
              await this.MensagemBotao(
                celular,
                "Concluir Solicitação",
                "Concluir",
              );
              session.stage = "choose_wifi_est_1gbps";
            } else {
              await this.MensagensComuns(celular, "Aperte em uma das 2 opções");
            }
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção dos Botoes",
            );
          }
          break;
        case "choose_type_titularidade":
          try {
            if (this.verificaType(type)) {
              await this.MensagensComuns(
                celular,
                "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nUm de nossos *atendentes* entrará em contato para concluir a sua *Alteração de Titularidade* enviando o *link* para o cliente atual com o *Termo de Alteração de Titularidade* \n\ne ao Novo Cliente o *link* com os *Termos de Adesão, Alteração de Titularidade e Contrato de Permanência* a serem *assinados*.\n\n*Clique no Botão abaixo para finalizar*",
              );

              let dadosCliente = session.dadosCompleto
                ? JSON.stringify(session.dadosCompleto, null, 2)
                : "Dados não encontrados";
              session.msgDadosFinais = `*🎭 Troca de Titularidade*\n\nDados do Cliente: ${dadosCliente}`;

              fs.readFile(logMsgFilePath, "utf8", (err, data) => {
                let logs = [];
                if (err && err.code === "ENOENT") {
                  console.log(
                    "Arquivo de log não encontrado, criando um novo.",
                  );
                } else if (err) {
                  console.error("Erro ao ler o arquivo de log:", err);
                  return;
                } else {
                  try {
                    logs = JSON.parse(data);
                    if (!Array.isArray(logs)) {
                      logs = [];
                    }
                  } catch (parseErr) {
                    console.error(
                      "Erro ao analisar o arquivo de log:",
                      parseErr,
                    );
                    logs = [];
                  }
                }

                const log = {
                  messages: session.msgDadosFinais,
                  timestamp: new Date().toISOString(),
                };

                logs.push(log);

                const jsonString = JSON.stringify(logs, null, 2);

                fs.writeFile(logMsgFilePath, jsonString, "utf8", (err) => {
                  if (err) {
                    console.error("Erro ao escrever no arquivo de log:", err);
                    return;
                  }
                  console.log("Log atualizado com sucesso!");
                });
              });

              mailOptions(session.msgDadosFinais);
              await this.MensagemBotao(
                celular,
                "Concluir Solicitação",
                "Finalizar",
              );

              session.stage = "finalizar";
            } else {
              await this.MensagensComuns(
                celular,
                "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção dos Botoes",
              );
            }
          } catch (error) {
            console.log(error);
          }
          break;
        case "choose_wifi_est_100":
          try {
            await this.MensagensComuns(celular, "🫱🏻‍🫲🏼 Tudo certo!");
            await this.MensagensComuns(
              celular,
              "✅️ Receberá em breve o *Termo de Adesão* e *Contrato de Permanência*  para assinatura online. Após a *confirmação*, daremos continuidade com a instalação do *Wi-Fi Estendido*.",
            );
            let dadosCliente = session.dadosCompleto
              ? JSON.stringify(session.dadosCompleto, null, 2)
              : "Dados não encontrados";
            session.msgDadosFinais = `*🔌 Wifi Estendido 100 Megas* \nDados do Cliente: ${dadosCliente}`;

            fs.readFile(logMsgFilePath, "utf8", (err, data) => {
              let logs = [];
              if (err && err.code === "ENOENT") {
                console.log("Arquivo de log não encontrado, criando um novo.");
              } else if (err) {
                console.error("Erro ao ler o arquivo de log:", err);
                return;
              } else {
                try {
                  logs = JSON.parse(data);
                  if (!Array.isArray(logs)) {
                    logs = [];
                  }
                } catch (parseErr) {
                  console.error("Erro ao analisar o arquivo de log:", parseErr);
                  logs = [];
                }
              }

              const log = {
                messages: session.msgDadosFinais,
                timestamp: new Date().toISOString(),
              };

              logs.push(log);

              const jsonString = JSON.stringify(logs, null, 2);

              fs.writeFile(logMsgFilePath, jsonString, "utf8", (err) => {
                if (err) {
                  console.error("Erro ao escrever no arquivo de log:", err);
                  return;
                }
                console.log("Log atualizado com sucesso!");
              });
            });

            mailOptions(session.msgDadosFinais);
            await this.MensagemBotao(
              celular,
              "Concluir Solicitação",
              "Finalizar",
            );

            session.stage = "finalizar";
          } catch (error) {
            console.log(error);
          }
          break;
        case "choose_wifi_est_1gbps":
          try {
            await this.MensagensComuns(celular, "🫱🏻‍🫲🏼 Tudo certo!");
            await this.MensagensComuns(
              celular,
              "✅️ Receberá em breve o *Termo de Adesão* e *Contrato de Permanência*  para assinatura online. Após a *confirmação*, daremos continuidade com a instalação do *Wi-Fi Estendido*.",
            );
            let dadosCliente = session.dadosCompleto
              ? JSON.stringify(session.dadosCompleto, null, 2)
              : "Dados não encontrados";
            session.msgDadosFinais = `*🔌 Wifi Estendido 100 Megas* \nDados do Cliente: ${dadosCliente}`;

            fs.readFile(logMsgFilePath, "utf8", (err, data) => {
              let logs = [];
              if (err && err.code === "ENOENT") {
                console.log("Arquivo de log não encontrado, criando um novo.");
              } else if (err) {
                console.error("Erro ao ler o arquivo de log:", err);
                return;
              } else {
                try {
                  logs = JSON.parse(data);
                  if (!Array.isArray(logs)) {
                    logs = [];
                  }
                } catch (parseErr) {
                  console.error("Erro ao analisar o arquivo de log:", parseErr);
                  logs = [];
                }
              }

              const log = {
                messages: session.msgDadosFinais,
                timestamp: new Date().toISOString(),
              };

              logs.push(log);

              const jsonString = JSON.stringify(logs, null, 2);

              fs.writeFile(logMsgFilePath, jsonString, "utf8", (err) => {
                if (err) {
                  console.error("Erro ao escrever no arquivo de log:", err);
                  return;
                }
                console.log("Log atualizado com sucesso!");
              });
            });

            mailOptions(session.msgDadosFinais);
            await this.MensagemBotao(
              celular,
              "Concluir Solicitação",
              "Finalizar",
            );

            session.stage = "finalizar";
          } catch (error) {
            console.log(error);
          }
          break;
        //Troca de Plano
        case "troca_plano":
          await this.iniciarTrocaPlano(celular, texto, session, type);
          break;
        case "choose_type_troca_plano":
          if (this.verificaType(type)) {
            if (texto.toLowerCase() === "sim concordo") {
              await this.MensagemBotao(
                celular,
                "Escolha qual seu *Tipo* de *Tecnologia*: \n(Caso tenha dúvida, pergunte para nossos atendentes)",
                "Fibra",
                "Rádio",
              );
              session.stage = "select_plan_troca";
            } else if (
              texto.toLowerCase() === "nao" ||
              texto.toLowerCase() === "não"
            ) {
              await this.MensagensComuns(
                celular,
                "🤷🏽 *Infelizmente* não podemos dar continuidade ao seu *atendimento* por não Aceitar os *Termos!!*",
              );
              clearTimeout(sessions[celular].inactivityTimer);
              delete sessions[celular];
            } else {
              await this.MensagensComuns(
                celular,
                "Aperte nos Botoes de Sim ou Não",
              );
            }
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção dos Botoes",
            );
          }
          break;
        case "select_plan_troca":
          if (this.verificaType(type)) {
            if (texto.toLowerCase() === "fibra") {
              await this.MensagemLista(celular, "Escolha seu Plano", {
                sections: [
                  {
                    title: "Fibra (Urbano)",
                    rows: [
                      { id: "option_1", title: "🟣 400 MEGA R$ 89,90" },
                      { id: "option_2", title: "🟩 500 MEGA R$ 99,90" },
                      { id: "option_3", title: "🔴 600 MEGA R$ 109,90" },
                      { id: "option_4", title: "🟡 700 MEGA R$ 129,90" },
                      { id: "option_5", title: "🟦 800 MEGA R$ 159,90" },
                    ],
                  },
                  {
                    title: "Fibra (Rural)",
                    rows: [
                      { id: "option_6", title: "🟤 340 MEGA R$ 159,90" },
                      { id: "option_7", title: "🟠 500 MEGA R$ 199,90" },
                    ],
                  },
                ],
              });

              session.stage = "plan_troca_final";
            } else if (
              texto.toLowerCase() === "radio" ||
              texto.toLowerCase() === "rádio"
            ) {
              await this.MensagemLista(celular, "Escolha seu Plano", {
                sections: [
                  {
                    title: "Escolha seu Plano",
                    rows: [
                      { id: "option_8", title: "🟩 20 MEGA R$ 89,90" },
                      { id: "option_9", title: "🟦 30 MEGA R$ 119,90" },
                    ],
                  },
                ],
              });
              session.stage = "plan_troca_final";
            } else {
              await this.MensagensComuns(
                celular,
                "Aperte nos Botoes de Fibra ou Rádio",
              );
            }
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção dos Botoes",
            );
          }
          break;
        case "plan_troca_final":
          if (this.verificaType(type)) {
            if (texto === "🟣 400 MEGA R$ 89,90") {
              let planoEscolhido = "🟣 400 MEGA R$ 89,90";
              session.planoEscolhido = planoEscolhido;
              session.stage = "finish_troca_plan";
              await this.MensagemBotao(
                celular,
                "Clique em *Concluir* para Terminar a *Alteração de Plano*",
                "Concluir",
              );
            } else if (texto === "🟩 500 MEGA R$ 99,90") {
              let planoEscolhido = "🟩 500 MEGA R$ 99,90";
              session.planoEscolhido = planoEscolhido;
              session.stage = "finish_troca_plan";
              await this.MensagemBotao(
                celular,
                "Clique em *Concluir* para Terminar a *Alteração de Plano*",
                "Concluir",
              );
            } else if (texto === "🔴 600 MEGA R$ 109,90") {
              let planoEscolhido = "🔴 600 MEGA R$ 109,90";
              session.planoEscolhido = planoEscolhido;
              session.stage = "finish_troca_plan";
              await this.MensagemBotao(
                celular,
                "Clique em *Concluir* para Terminar a *Alteração de Plano*",
                "Concluir",
              );
            } else if (texto === "🟡 700 MEGA R$ 129,90") {
              let planoEscolhido = "🟡 700 MEGA R$ 129,90";
              session.planoEscolhido = planoEscolhido;
              session.stage = "finish_troca_plan";
              await this.MensagemBotao(
                celular,
                "Clique em *Concluir* para Terminar a *Alteração de Plano*",
                "Concluir",
              );
            } else if (texto === "🟦 800 MEGA R$ 159,90") {
              let planoEscolhido = "🟦 800 MEGA R$ 159,90";
              session.planoEscolhido = planoEscolhido;
              session.stage = "finish_troca_plan";
              await this.MensagemBotao(
                celular,
                "Clique em *Concluir* para Terminar a *Alteração de Plano*",
                "Concluir",
              );
            } else if (texto === "🟤 340 MEGA R$ 159,90") {
              let planoEscolhido = "🟤 340 MEGA R$ 159,90";
              session.planoEscolhido = planoEscolhido;
              session.stage = "finish_troca_plan";
              await this.MensagemBotao(
                celular,
                "Clique em *Concluir* para Terminar a *Alteração de Plano*",
                "Concluir",
              );
            } else if (texto === "🟠 500 MEGA R$ 199,90") {
              let planoEscolhido = "🟠 500 MEGA R$ 199,90";
              session.planoEscolhido = planoEscolhido;
              session.stage = "finish_troca_plan";
              await this.MensagemBotao(
                celular,
                "Clique em *Concluir* para Terminar a *Alteração de Plano*",
                "Concluir",
              );
            } else if (texto === "🟩 20 MEGA R$ 89,90") {
              let planoEscolhido = "🟩 20 MEGA R$ 89,90";
              session.planoEscolhido = planoEscolhido;
              session.stage = "finish_troca_plan";
              await this.MensagemBotao(
                celular,
                "Clique em *Concluir* para Terminar a *Alteração de Plano*",
                "Concluir",
              );
            } else if (texto === "🟦 30 MEGA R$ 119,90") {
              let planoEscolhido = "🟦 30 MEGA R$ 119,90";
              session.planoEscolhido = planoEscolhido;
              session.stage = "finish_troca_plan";
              await this.MensagemBotao(
                celular,
                "Clique em *Concluir* para Terminar a *Alteração de Plano*",
                "Concluir",
              );
            } else {
              await this.MensagensComuns(celular, "Aperte nos Botoes da Lista");
            }
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção dos Botoes",
            );
          }
          break;
        case "finish_troca_plan":
          try {
            await this.MensagensComuns(
              celular,
              "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\n🔍 Um de nossos *atendentes* entrará em contato para concluir a sua *Alteração de plano* enviando o *link* com os *Termos de Alteração de Plano, Termo de Adesão e Contrato de Permanência* a serem *assinados*\n\nClique no botão abaixo para finalizar",
            );
            let dadosCliente = session.dadosCompleto
              ? JSON.stringify(session.dadosCompleto, null, 2)
              : "Dados não encontrados";
            session.msgDadosFinais = `*🔌 Alteração de Plano* \nPlano Escolhido: ${session.planoEscolhido}\nDados do Cliente: ${dadosCliente}`;

            fs.readFile(logMsgFilePath, "utf8", (err, data) => {
              let logs = [];
              if (err && err.code === "ENOENT") {
                console.log("Arquivo de log não encontrado, criando um novo.");
              } else if (err) {
                console.error("Erro ao ler o arquivo de log:", err);
                return;
              } else {
                try {
                  logs = JSON.parse(data);
                  if (!Array.isArray(logs)) {
                    logs = [];
                  }
                } catch (parseErr) {
                  console.error("Erro ao analisar o arquivo de log:", parseErr);
                  logs = [];
                }
              }

              const log = {
                messages: session.msgDadosFinais,
                timestamp: new Date().toISOString(),
              };

              logs.push(log);

              const jsonString = JSON.stringify(logs, null, 2);

              fs.writeFile(logMsgFilePath, jsonString, "utf8", (err) => {
                if (err) {
                  console.error("Erro ao escrever no arquivo de log:", err);
                  return;
                }
                console.log("Log atualizado com sucesso!");
              });
            });

            mailOptions(session.msgDadosFinais);
            await this.MensagemBotao(
              celular,
              "Concluir Solicitação",
              "Finalizar",
            );

            session.stage = "finalizar";
          } catch (error) {
            console.log(error);
          }
          break;

        //Mudança de Endereço
        case "mudanca_endereco":
          if (this.verificaType(type)) {
            await this.iniciarMudanca(celular, texto, session, type);
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção da Lista",
            );
          }
          break;
        case "choose_type_endereco":
          try {
            if (this.verificaType(type)) {
              if (texto.toLowerCase() === "paga") {
                await this.MensagemBotao(
                  celular,
                  "Escolha Forma de Pagamento",
                  "Pix",
                  "Cartão",
                  "Dinheiro",
                );
                session.stage = "choose_type_payment";
              } else if (
                texto.toLowerCase() === "grátis" ||
                texto.toLowerCase() === "gratis"
              ) {
                await this.MensagensComuns(
                  celular,
                  "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nUm de nossos *atendentes* entrará em contato para concluir a sua *mudança de endereço* enviando o *link* com os *Termos de Alteração de Endereço, Termo de Adesão e Contrato de Permanência* a serem *assinados*\n\nClique no Botão abaixo para finalizar",
                );
                let dadosCliente = session.dadosCompleto
                  ? JSON.stringify(session.dadosCompleto, null, 2)
                  : "Dados não encontrados";
                session.msgDadosFinais = `*🏠 Mudança de Endereço* \n\n*🆓 Forma: Gratis*\nDados do Cliente: ${dadosCliente}`;

                fs.readFile(logMsgFilePath, "utf8", (err, data) => {
                  let logs = [];
                  if (err && err.code === "ENOENT") {
                    console.log(
                      "Arquivo de log não encontrado, criando um novo.",
                    );
                  } else if (err) {
                    console.error("Erro ao ler o arquivo de log:", err);
                    return;
                  } else {
                    try {
                      logs = JSON.parse(data);
                      if (!Array.isArray(logs)) {
                        logs = [];
                      }
                    } catch (parseErr) {
                      console.error(
                        "Erro ao analisar o arquivo de log:",
                        parseErr,
                      );
                      logs = [];
                    }
                  }

                  const log = {
                    messages: session.msgDadosFinais,
                    timestamp: new Date().toISOString(),
                  };

                  logs.push(log);

                  const jsonString = JSON.stringify(logs, null, 2);

                  fs.writeFile(logMsgFilePath, jsonString, "utf8", (err) => {
                    if (err) {
                      console.error("Erro ao escrever no arquivo de log:", err);
                      return;
                    }
                    console.log("Log atualizado com sucesso!");
                  });
                });

                mailOptions(session.msgDadosFinais);
                await this.MensagemBotao(
                  celular,
                  "Concluir Solicitação",
                  "Finalizar",
                );

                session.stage = "finalizar";
              } else {
                await this.MensagensComuns(
                  celular,
                  "Opção Invalída, Selecione a Opção da Lista",
                );
              }
            } else {
              await this.MensagensComuns(
                celular,
                "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção da Lista",
              );
            }
          } catch (error) {
            console.log(error);
          }
          break;

        //Renovacão
        case "renovacao":
          await this.iniciarRenovacao(celular, texto, session, type);
          break;
        case "choose_type_renovacao":
          try {
            if (this.verificaType(type)) {
              if (texto.toLowerCase() === "sim concordo") {
                await this.MensagensComuns(
                  celular,
                  "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\n🔍 Um de nossos *atendentes* entrará em contato para concluir a sua *Renovação* enviando o *link* com os *Termos de Adesão e Contrato de Permanência* a serem *assinados*\n\n Clique em finalizar abaixo para terminar a conversa",
                );

                let dadosCliente = session.dadosCompleto
                  ? JSON.stringify(session.dadosCompleto, null, 2)
                  : "Dados não encontrados";
                session.msgDadosFinais = `*🆕 Renovação Contratual* \nDados do Cliente: ${dadosCliente}`;

                fs.readFile(logMsgFilePath, "utf8", (err, data) => {
                  let logs = [];
                  if (err && err.code === "ENOENT") {
                    console.log(
                      "Arquivo de log não encontrado, criando um novo.",
                    );
                  } else if (err) {
                    console.error("Erro ao ler o arquivo de log:", err);
                    return;
                  } else {
                    try {
                      logs = JSON.parse(data);
                      if (!Array.isArray(logs)) {
                        logs = [];
                      }
                    } catch (parseErr) {
                      console.error(
                        "Erro ao analisar o arquivo de log:",
                        parseErr,
                      );
                      logs = [];
                    }
                  }

                  const log = {
                    messages: session.msgDadosFinais,
                    timestamp: new Date().toISOString(),
                  };

                  logs.push(log);

                  const jsonString = JSON.stringify(logs, null, 2);

                  fs.writeFile(logMsgFilePath, jsonString, "utf8", (err) => {
                    if (err) {
                      console.error("Erro ao escrever no arquivo de log:", err);
                      return;
                    }
                    console.log("Log atualizado com sucesso!");
                  });
                });

                mailOptions(session.msgDadosFinais);
                await this.MensagemBotao(
                  celular,
                  "Concluir Solicitação",
                  "Finalizar",
                );

                session.stage = "finalizar";
              } else if (
                texto.toLowerCase() === "nao" ||
                texto.toLowerCase() === "não"
              ) {
                await this.MensagensComuns(
                  celular,
                  "🤷🏽 *Infelizmente* não podemos dar continuidade ao seu *atendimento* por não Aceitar os *Termos!!*",
                );
                setTimeout(() => {
                  clearTimeout(sessions[celular].inactivityTimer);
                  delete sessions[celular];
                }, 5000); // Espera 5 segundos antes de limpar
              } else {
                await this.MensagensComuns(
                  celular,
                  "Aperte nos Botoes de Sim ou Não",
                );
              }
            } else {
              await this.MensagensComuns(
                celular,
                "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Selecione uma Opção dos Botoes",
              );
            }
          } catch (error) {
            console.log(error);
          }
          break;

        //Boleto e Pix
        case "awaiting_cpf":
          if (this.verificaType(type)) {
            if (
              texto.toLowerCase() === "inicio" ||
              texto.toLowerCase() === "início"
            ) {
              await this.boasVindas(celular);
              await this.MensagemBotao(
                celular,
                "Escolha um Botão",
                "Boleto/Pix",
                "Serviços/Contratação",
                "Falar com Atendente",
              );
              session.stage = "options_start";
            } else if (await this.validarCPF(texto)) {
              const cpf = texto.replace(/[^\d]+/g, "");
              console.log("Consultar cadastro");
              session.cpf = cpf;

              const sis_cliente = await MkauthDataSource.getRepository(
                Sis_Cliente,
              ).find({
                select: {
                  id: true,
                  nome: true,
                  endereco: true,
                  login: true,
                  numero: true,
                },
                where: { cpf_cnpj: cpf, cli_ativado: "s" },
              });

              if (sis_cliente.length > 1) {
                let currentIndex = 1;
                let structuredData = sis_cliente.map((client) => {
                  const data = {
                    index: currentIndex, // Definindo o índice manualmente
                    id: Number(client.id),
                    nome: client.nome,
                    endereco: client.endereco,
                    login: client.login,
                    numero: client.numero,
                    cpf: cpf,
                  };
                  currentIndex++; // Incrementando o índice para o próximo cliente
                  return data;
                });

                session.structuredData = structuredData;

                // Convertendo structuredData para uma string legível
                await this.MensagensComuns(
                  celular,
                  "🔍 Cadastros encontrados! ",
                );
                let messageText =
                  "🔍 Mais de um *Cadastro encontrado!* Digite o *Número* para qual deseja 👇🏻\n\n";
                structuredData.forEach((client) => {
                  messageText += `*${client.index}* Nome: ${client.nome}, Endereço: ${client.endereco} N: ${client.numero}\n\n`;
                });
                messageText +=
                  "👉🏻 Caso queira voltar ao Menu Inicial digite *início*";
                session.stage = "awaiting_selection";

                await this.MensagensComuns(celular, messageText);
              } else if (sis_cliente.length === 1) {
                session.stage = "end";
                await this.MensagensComuns(
                  celular,
                  `🔍 Cadastro encontrado! ${sis_cliente[0].login.toUpperCase()}`,
                );
                await this.enviarBoleto(
                  sis_cliente[0].login,
                  celular,
                  sis_cliente[0].endereco,
                  cpf,
                );
                await this.MensagensComuns(
                  celular,
                  "👉🏻 Digite *continuar* para terminar o atendimento",
                );
              } else {
                await this.MensagensComuns(
                  celular,
                  "🙁 Seu cadastro *não* foi *encontrado*, verifique se digitou corretamente o seu *CPF/CNPJ*",
                );
                session.stage = "awaiting_cpf";
              }
            } else {
              console.log(
                "CPF/CNPJ inválido. Por favor, verifique e tente novamente.",
              );
              session.stage = "awaiting_cpf";
            }
            this.resetInactivityTimer.call(this, celular, session);
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, *Digite* seu *CPF/CNPJ*!!",
            );
          }
          break;
        case "awaiting_selection":
          if (this.verificaType(type)) {
            if (
              texto.toLowerCase() === "inicio" ||
              texto.toLowerCase() === "início"
            ) {
              await this.boasVindas(celular);
              await this.MensagemBotao(
                celular,
                "Escolha um Botão",
                "Boleto/Pix",
                "Serviços/Contratação",
                "Falar com Atendente",
              );
              session.stage = "options_start";
            } else {
              const selectedIndex = parseInt(texto, 10) - 1;
              const options = session.structuredData.length + 1;
              if (!isNaN(selectedIndex)) {
                if (selectedIndex < options) {
                  const selectedClient = session.structuredData[selectedIndex];
                  console.log(selectedClient);
                  console.log(
                    `Usuário selecionou o cliente com ID: ${selectedClient.id}`,
                  );
                  await this.enviarBoleto(
                    selectedClient.login,
                    celular,
                    selectedClient.endereco,
                    selectedClient.cpf,
                  );

                  await this.MensagensComuns(
                    celular,
                    "👇🏻👇🏻👇🏻👇🏻👇🏻👇🏻\n\n🙂Deseja voltar e retirar boleto referente a outro endereço?\n⬆️ Digite *voltar* ou *continuar*",
                  );

                  session.stage = "end";
                } else {
                  console.log(
                    "⚠️ Seleção *inválida*, por favor, tente novamente.",
                  );
                  await this.MensagensComuns(
                    celular,
                    "⚠️ Seleção *inválida*, por favor, tente novamente.",
                  );
                  session.stage = "awaiting_selection";
                }
              } else {
                console.log(
                  "⚠️ Seleção *inválida*, por favor, tente novamente.",
                );
                await this.MensagensComuns(
                  celular,
                  "⚠️ Seleção *inválida*, por favor, tente novamente.",
                );
                session.stage = "awaiting_selection";
              }
              this.resetInactivityTimer.call(this, celular, session);
            }
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n\n🙏🏻Por gentileza, *selecione* uma opção válida!!",
            );
          }
          break;
        case "end":
          if (this.verificaType(type)) {
            if (texto.toLowerCase() === "voltar" && session.structuredData) {
              session.stage = "awaiting_selection";
              let messageText =
                "🔍 Mais de um *Cadastro encontrado!* Digite o *Número* para qual deseja 👇🏻\n\n";
              session.structuredData.forEach((client: any) => {
                messageText += `*${client.index}* Nome: ${client.nome}, Endereço: ${client.endereco} N: ${client.numero}\n\n`;
              });
              messageText +=
                "👉🏻 Caso queira voltar ao Menu Inicial digite *início*";
              await this.MensagensComuns(celular, messageText);
            } else {
              if (!session.endHandled) {
                let messageText2 = "Ainda Precisa de Ajuda? 🤓\n\n";
                messageText2 += "*1* Sim \n\n";
                messageText2 += "*2* Não \n\n";
                await this.MensagensComuns(celular, messageText2);
                session.endHandled = true; // Marcar como processado
                session.stage = "end_talk";
              }
              this.resetInactivityTimer.call(this, celular, session);
            }
          } else {
            await this.MensagensComuns(
              celular,
              "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, *selecione* uma opção válida!!",
            );
          }
          break;
        case "end_talk":
          if (texto == "1" || texto.toLowerCase() === "sim") {
            await this.boasVindas(celular);

            await this.MensagemBotao(
              celular,
              "Escolha um Botão",
              "Boleto/Pix",
              "Serviços/Contratação",
              "Falar com Atendente",
            );

            session.stage = "options_start";
            session.endHandled = false; // Resetar para o próximo ciclo
          } else if (
            texto == "2" ||
            texto.toLowerCase() === "não" ||
            texto.toLowerCase() === "nao"
          ) {
            await this.MensagensComuns(
              celular,
              "*Wip Telecom*\n*Obrigado*, fiquei muito feliz de ter você por aqui! \nConte Sempre Comigo 😉",
            );
            if (sessions[celular] && sessions[celular].inactivityTimer) {
              clearTimeout(sessions[celular].inactivityTimer);
            }
            this.deleteSession(celular);
            console.log(
              "Clientes Utilizando o Bot no momento: " +
                this.getActiveSessionsCount(),
            );
          } else {
            await this.MensagensComuns(
              celular,
              "⚠️ Seleção *Inválida*, Verifique se Digitou o Número Corretamente!!!",
            );
          }
          break;

        //FinalizarServicos
        case "finalizar":
          try {
            if (this.verificaType(type)) {
              if (texto.toLowerCase() === "finalizar") {
                await this.Finalizar(session.msgDadosFinais, celular, sessions);
              } else {
                await this.MensagensComuns(
                  celular,
                  "Opção Invalída, Clique no Botão",
                );
              }
            } else {
              await this.MensagensComuns(
                celular,
                "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Clique no Botão",
              );
            }
          } catch (error) {
            console.log(error);
          }
          break;
      }
    }

    console.log(`Nova sessão para ${celular}:`, session);
  }

  async iniciarCadastro(celular: any, texto: any, session: any, type: any) {
    if (type !== "text" && type !== "interactive" && type !== undefined) {
      await this.MensagensComuns(
        celular,
        "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Digite",
      );
      return;
    }

    const perguntas = [
      { campo: "nome", pergunta: "➡️ Digite seu *nome completo*:" },
      { campo: "rg", pergunta: "➡️ Digite seu *RG/IE*:" },
      { campo: "cpf", pergunta: "➡️ Digite seu *CPF/CNPJ*:" },
      {
        campo: "dataNascimento",
        pergunta: "➡️ Digite sua *data de nascimento*: dd/mm/yyyy",
      },
      {
        campo: "celular",
        pergunta: "➡️ Digite seu número de *celular* com *DDD*:",
      },
      {
        campo: "celularSecundario",
        pergunta: "➡️ Digite um segundo *celular*  para *contato* com *DDD*:",
      },
      { campo: "email", pergunta: "➡️ Digite seu *e-mail*:" },
      { campo: "rua", pergunta: "➡️ Digite sua *Rua*:" },
      {
        campo: "numero",
        pergunta: "➡️ Digite o *Número* de sua *Residência*:",
      },
      { campo: "bairro", pergunta: "➡️ Digite seu *Bairro*:" },
      { campo: "cidade", pergunta: "➡️ Digite sua *Cidade*:" },
      { campo: "estado", pergunta: "➡️ Digite seu *Estado* (2 Letras):" },
      { campo: "cep", pergunta: "➡️ Digite seu *CEP*:" },
    ];

    // Se a sessão ainda não foi iniciada ou estamos começando, inicia o cadastro
    if (!session.dadosCadastro || session.ultimaPergunta === null) {
      console.log("Iniciando cadastro...");
      await this.MensagensComuns(
        celular,
        "🔤 Pronto, agora vamos coletar todos os seus *Dados* para elaborar o Cadastro e realizar os *Termos de Adesão*.",
      );
      session.dadosCadastro = {}; // Inicializa os dados do cadastro
      session.ultimaPergunta = perguntas[0].campo; // Começa com a primeira pergunta
      await this.MensagensComuns(celular, perguntas[0].pergunta); // Envia a primeira pergunta
      return;
    }

    // Se existe uma última pergunta, armazena a resposta
    const ultimaPergunta = session.ultimaPergunta;
    if (ultimaPergunta) {
      // Valida o CPF antes de prosseguir
      if (ultimaPergunta === "cpf") {
        const cpfValido = await this.validarCPF(texto);
        if (!cpfValido) {
          await this.MensagensComuns(
            celular,
            "❌ *CPF* inválido. Por favor, insira um *CPF* válido.",
          );
          return; // Não avança para a próxima pergunta
        }
      }

      if (ultimaPergunta === "rg") {
        const RgValido = await this.validarRG(texto);
        if (!RgValido) {
          await this.MensagensComuns(
            celular,
            "❌ *RG* inválido. Por favor, insira um *RG* válido.",
          );
          return; // Não avança para a próxima pergunta
        }
      }

      if (ultimaPergunta === "nome") {
        texto = String(texto)
          .replace(/[^a-zA-ZÀ-ÿ\s]/g, "")
          .trim();
      } else if (
        ultimaPergunta === "celular" ||
        ultimaPergunta === "celularSecundario"
      ) {
        texto = String(texto).replace(/\D/g, "");
      }

      session.dadosCadastro[ultimaPergunta] = texto; // Armazena a resposta
      console.log(`Resposta para ${ultimaPergunta}:`, texto);
      console.log("Dados atualizados:", session.dadosCadastro);
    }

    // Encontra a próxima pergunta
    const proximaPerguntaIndex =
      perguntas.findIndex((q) => q.campo === ultimaPergunta) + 1;

    if (proximaPerguntaIndex < perguntas.length) {
      const proximaPergunta = perguntas[proximaPerguntaIndex].pergunta;
      session.ultimaPergunta = perguntas[proximaPerguntaIndex].campo; // Atualiza para a próxima pergunta
      console.log("Próxima pergunta:", proximaPergunta);
      await this.MensagensComuns(celular, proximaPergunta); // Envia a próxima pergunta
    } else {
      // Cadastro completo
      await this.MensagensComuns(
        celular,
        "🛜 Vamos escolher o seu *Plano de Internet*",
      );
      await this.MensagemLista(celular, "Escolha seu Plano:", {
        sections: [
          {
            title: "Fibra (Urbano)",
            rows: [
              { id: "option_1", title: "🟣 400 MEGA R$ 89,90" },
              { id: "option_2", title: "🟩 500 MEGA R$ 99,90" },
              { id: "option_3", title: "🔴 600 MEGA R$ 109,90" },
              { id: "option_4", title: "🟡 700 MEGA R$ 129,90" },
              { id: "option_5", title: "🟦 800 MEGA R$ 159,90" },
            ],
          },
          {
            title: "Fibra (Rural)",
            rows: [
              { id: "option_6", title: "🟤 340 MEGA R$ 159,90" },
              { id: "option_7", title: "🟠 500 MEGA R$ 199,90" },
            ],
          },
          {
            title: "Rádio (Consultar)",
            rows: [
              { id: "option_9", title: "🟩 20 MEGA R$ 89,90" },
              { id: "option_10", title: "🟦 30 MEGA R$ 119,90" },
            ],
          },
        ],
      });
      session.stage = "plan";
      console.log("Dados cadastrados:", session.dadosCadastro);

      // Aqui você armazena todos os dados na sessão
      session.dadosCompleto = {
        ...session.dadosCadastro, // Inclui todos os dados do cadastro
      };

      // Finaliza o cadastro
      session.dadosCadastro = null;
      session.ultimaPergunta = null;
    }
  }

  async iniciarMudanca(celular: any, texto: any, session: any, type: any) {
    console.log("Mudança Type: " + type);

    if (type !== "text" && type !== "interactive" && type !== undefined) {
      await this.MensagensComuns(
        celular,
        "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Digite",
      );
      return;
    }

    const perguntas = [
      { campo: "nome", pergunta: "➡️ Digite seu *nome completo*:" },
      { campo: "cpf", pergunta: "➡️ Digite seu *CPF/CNPJ*:" },
      { campo: "celular", pergunta: "➡️ Digite seu *Celular* com *DDD*:" },
      {
        campo: "novo_endereco",
        pergunta: "➡️ Digite seu *Novo Endereço*: (Rua e Numero)",
      },
      { campo: "novo_bairro", pergunta: "➡️ Digite seu *Novo Bairro*:" },
      { campo: "cep", pergunta: "➡️ Digite seu *CEP*:" },
    ];

    // Se a sessão ainda não foi iniciada ou estamos começando, inicia o cadastro
    if (!session.dadosCadastro || session.ultimaPergunta === null) {
      console.log("Iniciando mudança...");
      await this.MensagensComuns(
        celular,
        "🔤 Pronto, agora vamos coletar todos os *Dados* para realizar a mudança de endereço",
      );
      session.dadosCadastro = {}; // Inicializa os dados do cadastro
      session.ultimaPergunta = perguntas[0].campo; // Começa com a primeira pergunta
      await this.MensagensComuns(celular, perguntas[0].pergunta); // Envia a primeira pergunta
      return;
    }

    // Se existe uma última pergunta, armazena a resposta
    const ultimaPergunta = session.ultimaPergunta;
    if (ultimaPergunta) {
      // Valida o CPF antes de prosseguir
      if (ultimaPergunta === "cpf") {
        const cpfValido = await this.validarCPF(texto);
        if (!cpfValido) {
          await this.MensagensComuns(
            celular,
            "❌ *CPF* inválido. Por favor, insira um *CPF* válido.",
          );
          return; // Não avança para a próxima pergunta
        }
      }

      session.dadosCadastro[ultimaPergunta] = texto; // Armazena a resposta
      console.log(`Resposta para ${ultimaPergunta}:`, texto);
      console.log("Dados atualizados:", session.dadosCadastro);
    }

    // Encontra a próxima pergunta
    const proximaPerguntaIndex =
      perguntas.findIndex((q) => q.campo === ultimaPergunta) + 1;

    if (proximaPerguntaIndex < perguntas.length) {
      const proximaPergunta = perguntas[proximaPerguntaIndex].pergunta;
      session.ultimaPergunta = perguntas[proximaPerguntaIndex].campo; // Atualiza para a próxima pergunta
      console.log("Próxima pergunta:", proximaPergunta);
      await this.MensagensComuns(celular, proximaPergunta); // Envia a próxima pergunta
    } else {
      console.log("Dados atualizados:", session.dadosCadastro);

      await this.MensagemTermos(
        celular,
        "Contrato Hospedado",
        "Este é o Nosso Contrato Oficial Completo",
        "Ler o contrato",
        "https://wiptelecomunicacoes.com.br/contrato",
      );
      await this.MensagemTermos(
        celular,
        "Termos Mudança de Endereço",
        "📄 Para dar *continuidade*, é preciso que *leia* o *Termo* abaixo e escolha a forma que deseja",
        "Ler Termos",
        "https://wipdiversos.wiptelecomunicacoes.com.br/doc/mudanca_endereco",
      );
      await this.MensagemBotao(celular, "Escolha a Forma", "Grátis", "Paga");
      session.stage = "choose_type_endereco";

      // Aqui você armazena todos os dados na sessão
      session.dadosCompleto = {
        ...session.dadosCadastro, // Inclui todos os dados do cadastro
      };

      // Finaliza o cadastro
      session.dadosCadastro = null;
      session.ultimaPergunta = null;
    }
  }

  async iniciarWifiEstendido(
    celular: any,
    texto: any,
    session: any,
    type: any,
  ) {
    console.log("Mudança Type: " + type);

    if (type !== "text" && type !== "interactive" && type !== undefined) {
      await this.MensagensComuns(
        celular,
        "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Digite",
      );
      return;
    }

    const perguntas = [
      { campo: "nome", pergunta: "➡️ Digite seu *nome completo*:" },
      { campo: "cpf", pergunta: "➡️ Digite seu *CPF/CNPJ*:" },
      { campo: "celular", pergunta: "➡️ Digite seu *Celular* com *DDD*:" },
    ];

    // Se a sessão ainda não foi iniciada ou estamos começando, inicia o cadastro
    if (!session.dadosCadastro || session.ultimaPergunta === null) {
      console.log("Iniciando Wifi Estendido...");
      await this.MensagensComuns(
        celular,
        "🔤 Pronto, agora vamos coletar todos os *Dados* para realizar o Wifi Estendido",
      );
      session.dadosCadastro = {}; // Inicializa os dados do cadastro
      session.ultimaPergunta = perguntas[0].campo; // Começa com a primeira pergunta
      await this.MensagensComuns(celular, perguntas[0].pergunta); // Envia a primeira pergunta
      return;
    }

    // Se existe uma última pergunta, armazena a resposta
    const ultimaPergunta = session.ultimaPergunta;
    if (ultimaPergunta) {
      // Valida o CPF antes de prosseguir
      if (ultimaPergunta === "cpf") {
        const cpfValido = await this.validarCPF(texto);
        if (!cpfValido) {
          await this.MensagensComuns(
            celular,
            "❌ *CPF* inválido. Por favor, insira um *CPF* válido.",
          );
          return; // Não avança para a próxima pergunta
        }
      }

      session.dadosCadastro[ultimaPergunta] = texto; // Armazena a resposta
      console.log(`Resposta para ${ultimaPergunta}:`, texto);
      console.log("Dados atualizados:", session.dadosCadastro);
    }

    // Encontra a próxima pergunta
    const proximaPerguntaIndex =
      perguntas.findIndex((q) => q.campo === ultimaPergunta) + 1;

    if (proximaPerguntaIndex < perguntas.length) {
      const proximaPergunta = perguntas[proximaPerguntaIndex].pergunta;
      session.ultimaPergunta = perguntas[proximaPerguntaIndex].campo; // Atualiza para a próxima pergunta
      console.log("Próxima pergunta:", proximaPergunta);
      await this.MensagensComuns(celular, proximaPergunta); // Envia a próxima pergunta
    } else {
      console.log("Dados atualizados:", session.dadosCadastro);

      await this.MensagemTermos(
        celular,
        "Contrato Hospedado",
        "Este é o Nosso Contrato Oficial Completo",
        "Ler o contrato",
        "https://wiptelecomunicacoes.com.br/contrato",
      );

      await this.MensagemBotao(
        celular,
        "Escolha a Opção",
        "Sim Concordo",
        "Não",
      );

      session.stage = "choose_est";

      // Aqui você armazena todos os dados na sessão
      session.dadosCompleto = {
        ...session.dadosCadastro, // Inclui todos os dados do cadastro
      };

      // Finaliza o cadastro
      session.dadosCadastro = null;
      session.ultimaPergunta = null;
    }
  }

  async iniciarMudancaComodo(
    celular: any,
    texto: any,
    session: any,
    type: any,
  ) {
    if (type !== "text" && type !== "interactive" && type !== undefined) {
      await this.MensagensComuns(
        celular,
        "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Digite",
      );
      return;
    }

    const perguntas = [
      { campo: "nome", pergunta: "➡️ Digite seu *nome completo*:" },
      { campo: "cpf", pergunta: "➡️ Digite seu *CPF/CNPJ*:" },
      { campo: "celular", pergunta: "➡️ Digite seu *Celular* com *DDD*:" },
    ];

    // Se a sessão ainda não foi iniciada ou estamos começando, inicia o cadastro
    if (!session.dadosCadastro || session.ultimaPergunta === null) {
      console.log("Iniciando mudança...");
      await this.MensagensComuns(
        celular,
        "🔤 Agora vamos coletar todos os *Dados* para realizar a mudança de cômodo e agendar a visita",
      );
      session.dadosCadastro = {}; // Inicializa os dados do cadastro
      session.ultimaPergunta = perguntas[0].campo; // Começa com a primeira pergunta
      await this.MensagensComuns(celular, perguntas[0].pergunta); // Envia a primeira pergunta
      return;
    }

    // Se existe uma última pergunta, armazena a resposta
    const ultimaPergunta = session.ultimaPergunta;
    if (ultimaPergunta) {
      // Valida o CPF antes de prosseguir
      if (ultimaPergunta === "cpf") {
        const cpfValido = await this.validarCPF(texto);
        if (!cpfValido) {
          await this.MensagensComuns(
            celular,
            "❌ *CPF* inválido. Por favor, insira um *CPF* válido.",
          );
          return; // Não avança para a próxima pergunta
        }
      }

      session.dadosCadastro[ultimaPergunta] = texto; // Armazena a resposta
      console.log(`Resposta para ${ultimaPergunta}:`, texto);
      console.log("Dados atualizados:", session.dadosCadastro);
    }

    // Encontra a próxima pergunta
    const proximaPerguntaIndex =
      perguntas.findIndex((q) => q.campo === ultimaPergunta) + 1;

    if (proximaPerguntaIndex < perguntas.length) {
      const proximaPergunta = perguntas[proximaPerguntaIndex].pergunta;
      session.ultimaPergunta = perguntas[proximaPerguntaIndex].campo; // Atualiza para a próxima pergunta
      console.log("Próxima pergunta:", proximaPergunta);
      await this.MensagensComuns(celular, proximaPergunta); // Envia a próxima pergunta
    } else {
      console.log("Dados atualizados:", session.dadosCadastro);
      await this.MensagemTermos(
        celular,
        "Contrato Hospedado",
        "Este é o Nosso Contrato Oficial Completo",
        "Ler o contrato",
        "https://wiptelecomunicacoes.com.br/contrato",
      );
      await this.MensagemTermos(
        celular,
        "Termos Mudança de Cômodo",
        "📄 Para dar *continuidade*, é preciso que *leia* o *Termo* abaixo e escolha a forma que deseja",
        "Ler Termos",
        "https://wipdiversos.wiptelecomunicacoes.com.br/doc/mudanca_comodo",
      );
      await this.MensagemBotao(celular, "Escolha a Forma", "Grátis", "Paga");
      session.stage = "choose_type_comodo";

      // Aqui você armazena todos os dados na sessão
      session.dadosCompleto = {
        ...session.dadosCadastro, // Inclui todos os dados do cadastro
      };

      // Finaliza o cadastro
      session.dadosCadastro = null;
      session.ultimaPergunta = null;
    }
  }

  async iniciarMudancaTitularidade(
    celular: any,
    texto: any,
    session: any,
    type: any,
  ) {
    if (type !== "text" && type !== "interactive" && type !== undefined) {
      await this.MensagensComuns(
        celular,
        "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Digite",
      );
      return;
    }

    const perguntas = [
      { campo: "nome", pergunta: "➡️ Digite seu *nome completo*:" },
      { campo: "cpf", pergunta: "➡️ Digite seu *CPF/CNPJ:" },
      { campo: "celular", pergunta: "➡️ Digite seu *Celular* com *DDD*:" },
      {
        campo: "nome_novo_titular",
        pergunta: "➡️ Digite o *Nome Completo* do *Novo Titular*:",
      },
      {
        campo: "celular_novo_titular",
        pergunta: "➡️ Digite o *Celular do Novo Titular* com *DDD*:",
      },
    ];

    // Se a sessão ainda não foi iniciada ou estamos começando, inicia o cadastro
    if (!session.dadosCadastro || session.ultimaPergunta === null) {
      console.log("Iniciando mudança...");
      await this.MensagensComuns(
        celular,
        "🔤 Agora vamos coletar todos os *Dados* para realizar a troca de titularidade",
      );
      session.dadosCadastro = {}; // Inicializa os dados do cadastro
      session.ultimaPergunta = perguntas[0].campo; // Começa com a primeira pergunta
      await this.MensagensComuns(celular, perguntas[0].pergunta); // Envia a primeira pergunta
      return;
    }

    // Se existe uma última pergunta, armazena a resposta
    const ultimaPergunta = session.ultimaPergunta;
    if (ultimaPergunta) {
      // Valida o CPF antes de prosseguir
      if (ultimaPergunta === "cpf") {
        const cpfValido = await this.validarCPF(texto);
        if (!cpfValido) {
          await this.MensagensComuns(
            celular,
            "❌ *CPF* inválido. Por favor, insira um *CPF* válido.",
          );
          return; // Não avança para a próxima pergunta
        }
      }

      session.dadosCadastro[ultimaPergunta] = texto; // Armazena a resposta
      console.log(`Resposta para ${ultimaPergunta}:`, texto);
      console.log("Dados atualizados:", session.dadosCadastro);
    }

    // Encontra a próxima pergunta
    const proximaPerguntaIndex =
      perguntas.findIndex((q) => q.campo === ultimaPergunta) + 1;

    if (proximaPerguntaIndex < perguntas.length) {
      const proximaPergunta = perguntas[proximaPerguntaIndex].pergunta;
      session.ultimaPergunta = perguntas[proximaPerguntaIndex].campo; // Atualiza para a próxima pergunta
      console.log("Próxima pergunta:", proximaPergunta);
      await this.MensagensComuns(celular, proximaPergunta); // Envia a próxima pergunta
    } else {
      console.log("Dados atualizados:", session.dadosCadastro);

      session.stage = "choose_type_titularidade";

      await this.MensagemBotao(
        celular,
        "Aperte Em *Continuar* para Concluir a Troca de *Titularidade*",
        "Continuar",
      );

      // Aqui você armazena todos os dados na sessão
      session.dadosCompleto = {
        ...session.dadosCadastro, // Inclui todos os dados do cadastro
      };

      // Finaliza o cadastro
      session.dadosCadastro = null;
      session.ultimaPergunta = null;
    }
  }

  async iniciarTrocaPlano(celular: any, texto: any, session: any, type: any) {
    if (type !== "text" && type !== "interactive" && type !== undefined) {
      await this.MensagensComuns(
        celular,
        "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Digite",
      );
      return;
    }

    const perguntas = [
      { campo: "nome", pergunta: "➡️ Digite seu *nome completo*:" },
      { campo: "cpf", pergunta: "➡️ Digite seu *CPF/CNPJ*:" },
      { campo: "celular", pergunta: "➡️ Digite seu *Celular* com *DDD*:" },
    ];

    // Se a sessão ainda não foi iniciada ou estamos começando, inicia o cadastro
    if (!session.dadosCadastro || session.ultimaPergunta === null) {
      console.log("Iniciando mudança...");
      await this.MensagensComuns(
        celular,
        "🔤 Pronto, agora vamos coletar todos os *Dados* para realizar a Alteração de Plano",
      );
      session.dadosCadastro = {}; // Inicializa os dados do cadastro
      session.ultimaPergunta = perguntas[0].campo; // Começa com a primeira pergunta
      await this.MensagensComuns(celular, perguntas[0].pergunta); // Envia a primeira pergunta
      return;
    }

    // Se existe uma última pergunta, armazena a resposta
    const ultimaPergunta = session.ultimaPergunta;
    if (ultimaPergunta) {
      // Valida o CPF antes de prosseguir
      if (ultimaPergunta === "cpf") {
        const cpfValido = await this.validarCPF(texto);
        if (!cpfValido) {
          await this.MensagensComuns(
            celular,
            "❌ *CPF* inválido. Por favor, insira um *CPF* válido.",
          );
          return; // Não avança para a próxima pergunta
        }
      }

      session.dadosCadastro[ultimaPergunta] = texto; // Armazena a resposta
      console.log(`Resposta para ${ultimaPergunta}:`, texto);
      console.log("Dados atualizados:", session.dadosCadastro);
    }

    // Encontra a próxima pergunta
    const proximaPerguntaIndex =
      perguntas.findIndex((q) => q.campo === ultimaPergunta) + 1;

    if (proximaPerguntaIndex < perguntas.length) {
      const proximaPergunta = perguntas[proximaPerguntaIndex].pergunta;
      session.ultimaPergunta = perguntas[proximaPerguntaIndex].campo; // Atualiza para a próxima pergunta
      console.log("Próxima pergunta:", proximaPergunta);
      await this.MensagensComuns(celular, proximaPergunta); // Envia a próxima pergunta
    } else {
      console.log("Dados atualizados:", session.dadosCadastro);
      await this.MensagemTermos(
        celular,
        "Contrato Hospedado",
        "Este é o Nosso Contrato Oficial Completo",
        "Ler o contrato",
        "https://wiptelecomunicacoes.com.br/contrato",
      );
      await this.MensagemTermos(
        celular,
        "Termos Alteração de Plano",
        "📄 Para dar *continuidade*, é preciso que *leia* o *Termo abaixo* e escolha a opção que deseja",
        "Ler Termos",
        "https://wipdiversos.wiptelecomunicacoes.com.br/doc/altera_plano",
      );
      await this.MensagemBotao(
        celular,
        "Escolha a Opção",
        "Sim Concordo",
        "Não",
      );
      session.stage = "choose_type_troca_plano";

      // Aqui você armazena todos os dados na sessão
      session.dadosCompleto = {
        ...session.dadosCadastro, // Inclui todos os dados do cadastro
      };

      // Finaliza o cadastro
      session.dadosCadastro = null;
      session.ultimaPergunta = null;
    }
  }

  async iniciarRenovacao(celular: any, texto: any, session: any, type: any) {
    if (type !== "text" && type !== "interactive" && type !== undefined) {
      await this.MensagensComuns(
        celular,
        "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Digite",
      );
      return;
    }

    const perguntas = [
      { campo: "nome", pergunta: "➡️ Digite seu *nome completo*:" },
      { campo: "cpf", pergunta: "➡️ Digite seu *CPF/CNPJ*:" },
      { campo: "celular", pergunta: "➡️ Digite seu *Celular* com *DDD*:" },
    ];

    // Se a sessão ainda não foi iniciada ou estamos começando, inicia o cadastro
    if (!session.dadosCadastro || session.ultimaPergunta === null) {
      console.log("Iniciando Renovação...");
      await this.MensagensComuns(
        celular,
        "🔤 Pronto, agora vamos coletar todos os *Dados* para realizar a *Renovação Contratual*",
      );
      session.dadosCadastro = {}; // Inicializa os dados do cadastro
      session.ultimaPergunta = perguntas[0].campo; // Começa com a primeira pergunta
      await this.MensagensComuns(celular, perguntas[0].pergunta); // Envia a primeira pergunta
      return;
    }

    // Se existe uma última pergunta, armazena a resposta
    const ultimaPergunta = session.ultimaPergunta;
    if (ultimaPergunta) {
      // Valida o CPF antes de prosseguir
      if (ultimaPergunta === "cpf") {
        const cpfValido = await this.validarCPF(texto);
        if (!cpfValido) {
          await this.MensagensComuns(
            celular,
            "❌ *CPF* inválido. Por favor, insira um *CPF* válido.",
          );
          return; // Não avança para a próxima pergunta
        }
      }

      session.dadosCadastro[ultimaPergunta] = texto; // Armazena a resposta
      console.log(`Resposta para ${ultimaPergunta}:`, texto);
      console.log("Dados atualizados:", session.dadosCadastro);
    }

    // Encontra a próxima pergunta
    const proximaPerguntaIndex =
      perguntas.findIndex((q) => q.campo === ultimaPergunta) + 1;

    if (proximaPerguntaIndex < perguntas.length) {
      const proximaPergunta = perguntas[proximaPerguntaIndex].pergunta;
      session.ultimaPergunta = perguntas[proximaPerguntaIndex].campo; // Atualiza para a próxima pergunta
      console.log("Próxima pergunta:", proximaPergunta);
      await this.MensagensComuns(celular, proximaPergunta); // Envia a próxima pergunta
    } else {
      console.log("Dados atualizados:", session.dadosCadastro);
      await this.MensagemTermos(
        celular,
        "Contrato Hospedado",
        "Este é o Nosso Contrato Oficial Completo",
        "Ler o contrato",
        "https://wiptelecomunicacoes.com.br/contrato",
      );
      await this.MensagemTermos(
        celular,
        "Termos Renovação Contratual",
        "📄 Para dar *continuidade*, é preciso que *leia* o *Termo abaixo* e escolha a opção que deseja",
        "Ler Termos",
        "https://wipdiversos.wiptelecomunicacoes.com.br/doc/renovacao",
      );
      await this.MensagemBotao(
        celular,
        "Escolha a Opção",
        "Sim Concordo",
        "Não",
      );
      session.stage = "choose_type_renovacao";

      // Aqui você armazena todos os dados na sessão
      session.dadosCompleto = {
        ...session.dadosCadastro, // Inclui todos os dados do cadastro
      };

      // Finaliza o cadastro
      session.dadosCadastro = null;
      session.ultimaPergunta = null;
    }
  }

  async LGPD(celular: any) {
    await this.MensagemTermos(
      celular,
      "Termos LGPD",
      "📄 Para dar *continuidade*, é preciso que leia e *aceite* os *Termos abaixo* para a segurança dos seus dados pessoais, de acordo com a *LGPD*.",
      "Ler Termos",
      "https://wipdiversos.wiptelecomunicacoes.com.br/doc/privacidade",
    );
    await this.MensagemBotao(
      celular,
      "Concorda com os Termos?",
      "Sim Aceito",
      "Não",
    );
  }

  async formatarData(data: any) {
    const date = new Date(data);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0"); // Janeiro é 0!
    const day = date.getDate().toString().padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  async enviarBoleto(pppoe: any, celular: any, end: any, cpf: any) {
    const cliente: any = await MkauthDataSource.getRepository(Record).findOne({
      where: {
        login: pppoe,
        status: In(["vencido", "aberto"]),
        datadel: IsNull(),
      },
      order: { datavenc: "ASC" },
    });

    const sis_cliente: any = await MkauthDataSource.getRepository(
      Sis_Cliente,
    ).findOne({
      where: { login: pppoe, cpf_cnpj: cpf, cli_ativado: "s" },
    });

    const desconto = sis_cliente.desconto;

    let valor: number | string = Number(cliente.valor);
    const dataVenc = cliente.datavenc;
    let id = cliente.id;

    let corpo = {
      tipoCob: "cob" as "cob",
    };

    const efipayLoc = new EfiPay(options);

    const loc: any = await efipayLoc
      .pixCreateLocation([], corpo)
      .catch((error: any) => {
        console.log(error);
      });

    if (!loc) {
      console.log("Erro ao criar Location");
      return;
    }

    const locID = loc.id;

    console.log(locID);

    const efipayLocLink = new EfiPay(options);

    const qrlink: any = await efipayLocLink
      .pixGenerateQRCode({ id: Number(locID) })
      .catch((error: any) => {
        console.log(error);
      });

    if (!qrlink) {
      console.log("Erro ao gerar QR Link");
      return;
    }

    const link = qrlink.linkVisualizacao;

    valor -= desconto;

    const dataHoje = new Date();

    function resetTime(date: any) {
      date.setHours(0, 0, 0, 0);
      return date;
    }

    let dataVencSemHora = resetTime(new Date(dataVenc));
    let dataHojeSemHora = resetTime(new Date(dataHoje));

    if (dataVencSemHora > dataHojeSemHora) {
      console.log("Não está em atraso");
    } else if (dataVencSemHora < dataHojeSemHora) {
      console.log("está em atraso");

      const date1 = new Date(dataVenc);
      const date2 = new Date(dataHoje);

      // Função para calcular a diferença em dias
      function differenceInDays(date1: any, date2: any) {
        const oneDay = 24 * 60 * 60 * 1000;
        const diffDays = Math.floor(Math.abs((date1 - date2) / oneDay));
        return diffDays;
      }

      const diffInDays = differenceInDays(date1, date2);

      // Definindo as multas
      const monthlyFine = 0.02; // 2% por mês
      const dailyFine = 0.00033; // 0.033% por dia

      // Calculando a multa mensal
      let multaMensal = valor * monthlyFine;

      // Calculando a multa diária
      let multaDiaria = valor * ((diffInDays - 4) * dailyFine);

      // Somando as multas ao valor original
      let valorFinal = valor + multaMensal + multaDiaria;

      // Arredondando o valor final para cima até duas casas decimais
      let valorFinalArredondado = Math.floor(valorFinal * 100) / 100;

      let valorFinalFormatado = valorFinalArredondado.toFixed(2);

      valor = valorFinalFormatado;
    } else if (dataVencSemHora === dataHojeSemHora) {
      console.log("Vence Hoje");
    }

    fs.readFile(logFilePath, "utf8", (err, data) => {
      let logs = [];
      if (err && err.code === "ENOENT") {
        console.log("Arquivo de log não encontrado, criando um novo.");
      } else if (err) {
        console.error("Erro ao ler o arquivo de log:", err);
        return;
      } else {
        try {
          logs = JSON.parse(data);
          if (!Array.isArray(logs)) {
            logs = [];
          }
        } catch (parseErr) {
          console.error("Erro ao analisar o arquivo de log:", parseErr);
          logs = [];
        }
      }

      const log = {
        tipo: "BOLETO/PIX BOT SOLICITADO",
        cpf: cpf,
        pppoe: pppoe,
        id: id,
        valor: valor,
        dataVenc: dataVenc,
        timestamp: new Date().toISOString(),
      };

      logs.push(log);

      const jsonString = JSON.stringify(logs, null, 2);

      fs.writeFile(logFilePath, jsonString, "utf8", (err) => {
        if (err) {
          console.error("Erro ao escrever no arquivo de log:", err);
          return;
        }
        console.log("Log atualizado com sucesso!");
      });
    });

    console.log(valor);

    if (typeof valor !== "string") {
      valor = valor.toFixed(2);
    } else {
      // Se valor for uma string, converta-o para número antes de chamar toFixed
      valor = Number(valor).toFixed(2);
    }

    const efipay = new EfiPay(options);

    console.log(id);

    let body;

    if (cpf.length === 11) {
      body = {
        calendario: {
          expiracao: 43200,
        },
        devedor: {
          cpf: cpf,
          nome: pppoe,
        },
        valor: {
          original: valor,
        },
        chave: chave_pix,
        solicitacaoPagador: "Mensalidade",
        infoAdicionais: [
          {
            nome: "ID",
            valor: String(id),
          },
          {
            nome: "VALOR",
            valor: String(valor),
          },
          {
            nome: "QR",
            valor: String(link),
          },
        ],
        loc: {
          id: locID,
        },
      };
    } else {
      body = {
        calendario: {
          expiracao: 43200,
        },
        devedor: {
          cnpj: cpf,
          nome: pppoe,
        },
        valor: {
          original: valor,
        },
        chave: chave_pix,
        solicitacaoPagador: "Mensalidade",
        infoAdicionais: [
          {
            nome: "ID",
            valor: String(id),
          },
          {
            nome: "VALOR",
            valor: String(valor),
          },
          {
            nome: "QR",
            valor: String(link),
          },
        ],
        loc: {
          id: locID,
        },
      };
    }

    let params = {
      txid: crypto.randomBytes(16).toString("hex"),
    };

    let pix: any = await efipay
      .pixCreateCharge(params, body)
      .catch((error: any) => {
        console.log(error);
      });

    console.log(pix);

    if (!pix) {
      console.log("Erro ao criar PIX");
      return;
    }

    let pix_code = pix.pixCopiaECola;

    const options2 = {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    } as const;
    const formattedDate = new Intl.DateTimeFormat("pt-BR", options2).format(
      dataVenc,
    );

    await this.enviarMensagemVencimento(
      celular,
      formattedDate,
      cliente.linhadig,
      link,
      end,
      valor,
      pppoe,
      sis_cliente.numero,
      cliente.uuid_lanc,
    );
  }

  async MensagensComuns(recipient_number: any, msg: any) {
    try {
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient_number,
        type: "text",
        text: {
          preview_url: false,
          body: String(msg),
        },
      };

      await whatsappOutgoingQueue.add(
        "send-message",
        {
          url,
          payload,
          headers: {
            Authorization: `Bearer ${token}`,
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

      const insertMessage = await ApiMkDataSource.getRepository(Mensagens).save(
        {
          conv_id: conversation.conv_id as number,
          sender_id: conversation.receiver_id,
          content: msg,
          timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000),
        },
      );
    } catch (error) {
      console.error("Error queueing message:", error);
    }
  }

  async PodeMePassarOCpf(recipient_number: any) {
    try {
      let msg =
        "Sim, De acordo com a *Lei Geral de Proteção de Dados* 🔒 é preciso do seu consentimento para troca de dados, pode me fornecer seu *CPF/CNPJ*? 🖋️\n\n";
      msg += "Caso queira voltar ao Menu Inicial digite *início*";

      await whatsappOutgoingQueue.add(
        "send-message",
        {
          url,
          payload: {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipient_number,
            type: "text",
            text: {
              preview_url: false,
              body: String(msg),
            },
          },
          headers: {
            Authorization: `Bearer ${token}`,
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

      const insertMessage = await ApiMkDataSource.getRepository(Mensagens).save(
        {
          conv_id: conversation.conv_id as number,
          sender_id: conversation.receiver_id,
          content: "Pode me passar o CPF?",
          timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000),
        },
      );
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  async validarCPF(doc: any) {
    // Remove qualquer coisa que não seja dígito
    doc = doc.replace(/[^\d]+/g, "");

    if (doc.length === 11) {
      // Validação de CPF
      let soma = 0,
        resto;
      if (/^(\d)\1+$/.test(doc)) return false; // Elimina CPFs com todos os dígitos iguais

      for (let i = 1; i <= 9; i++)
        soma += parseInt(doc.substring(i - 1, i)) * (11 - i);
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      if (resto !== parseInt(doc.substring(9, 10))) return false;

      soma = 0;
      for (let i = 1; i <= 10; i++)
        soma += parseInt(doc.substring(i - 1, i)) * (12 - i);
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      if (resto !== parseInt(doc.substring(10, 11))) return false;

      return true;
    } else if (doc.length === 14) {
      // Validação de CNPJ
      let tamanho = doc.length - 2;
      let numeros = doc.substring(0, tamanho);
      let digitos = doc.substring(tamanho);
      let soma = 0;
      let pos = tamanho - 7;
      let multiplicador;

      if (/^(\d)\1+$/.test(doc)) return false; // Elimina CNPJs com todos os dígitos iguais

      for (let i = tamanho; i >= 1; i--) {
        multiplicador = pos--;
        soma += parseInt(numeros.charAt(tamanho - i)) * multiplicador;
        if (pos < 2) pos = 9;
      }

      let resto = soma % 11;
      if (resto < 2) resto = 0;
      else resto = 11 - resto;

      if (resto !== parseInt(digitos.charAt(0))) return false;

      tamanho = tamanho + 1;
      numeros = doc.substring(0, tamanho);
      soma = 0;
      pos = tamanho - 7;

      for (let i = tamanho; i >= 1; i--) {
        multiplicador = pos--;
        soma += parseInt(numeros.charAt(tamanho - i)) * multiplicador;
        if (pos < 2) pos = 9;
      }

      resto = soma % 11;
      if (resto < 2) resto = 0;
      else resto = 11 - resto;

      if (resto !== parseInt(digitos.charAt(1))) return false;

      return true;
    } else {
      // Documento não tem tamanho válido para CPF ou CNPJ
      return false;
    }
  }

  async validarRG(rg: any) {
    // Remove tudo que não for número
    rg = rg.replace(/[^\d]+/g, "");

    // Valida o comprimento do RG (geralmente varia entre 7 e 10 dígitos)
    if (rg.length < 7 || rg.length > 10) return false;

    // Verifica se todos os dígitos são iguais (não permitido)
    if (/^(\d)\1+$/.test(rg)) return false;

    // RG parece válido (não existe fórmula como no CPF)
    return true;
  }

  verificaType(type: any) {
    if (type == "text" || type == "interactive") {
      console.log("TYPE: " + type);
      return true;
    } else {
      console.log("TYPE: " + type);
      return false;
    }
  }

  async enviarMensagemVencimento(
    receivenumber: any,
    dia: any,
    linha_dig: any,
    pix: any,
    end: any,
    valor: any,
    pppoe: any,
    numero: any,
    boletoID: any,
  ) {
    try {
      await this.MensagensComuns(receivenumber, "🔎 *Só um Momento* 🕵️");
      // await wa.messages.template(test, receivenumber);
      let msg = `Aqui está a sua Mensalidade do dia *${dia}*\n\n`;
      msg += `*Endereço*: ${end}  Nº: ${numero}\n`;
      msg += `*Valor*: ${valor}\n`;

      await this.MensagensComuns(receivenumber, "*Pix* Acesse o Site 👇");
      await this.MensagensComuns(receivenumber, pix);

      await this.MensagensComuns(receivenumber, msg);
      if (linha_dig !== null) {
        await this.downloadPdfFromSftp(
          receivenumber,
          process.env.SFTP_HOST,
          process.env.SFTP_USER,
          process.env.SFTP_PASSWORD,
          `${process.env.PDF_PATH}${boletoID}.pdf`,
          path.join(__dirname, "..", "..", "temp", `${boletoID}.pdf`),
        );
        await this.MensagensComuns(receivenumber, "Linha Digitavel 👇");
        await this.MensagensComuns(receivenumber, linha_dig);
      }
    } catch (e) {
      console.error(JSON.stringify(e));
    }
  }

  async boasVindas(receivenumber: any) {
    try {
      await whatsappOutgoingQueue.add(
        "send-template",
        {
          url,
          payload: {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: receivenumber,
            type: "template",
            template: {
              name: "bem_vindo",
              language: {
                code: "pt_BR",
              },
              components: [
                {
                  type: "body",
                },
              ],
            },
          },
          headers: {
            Authorization: `Bearer ${token}`,
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

      const insertMessage = await ApiMkDataSource.getRepository(Mensagens).save(
        {
          conv_id: conversation.conv_id as number,
          sender_id: conversation.receiver_id,
          content: "Bem-vindo ao nosso serviço de WhatsApp!",
          timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000),
        },
      );
    } catch (error) {
      console.error("Error sending template message:", error);
    }
  }

  async downloadPdfFromSftp(
    receivenumber: any,
    host: any,
    username: any,
    password: any,
    remoteFilePath: any,
    localFilePath: any,
  ) {
    const client = new SftpClient();
    try {
      await client.connect({
        host,
        port: 22,
        username,
        password,
      });
      console.log(remoteFilePath);
      const fileExists = await client.exists(remoteFilePath);
      console.log("FILEEXISTS: " + fileExists);

      if (fileExists) {
        console.log(`Arquivo encontrado no servidor: ${remoteFilePath}`);
        await client.fastGet(remoteFilePath, localFilePath);
        await this.getMediaID(receivenumber, localFilePath, "whatsapp");
        console.log("PDF baixado com sucesso via SFTP");
      } else {
        console.error(`Arquivo não encontrado no servidor: ${remoteFilePath}`);
      }
    } catch (error) {
      console.error("Erro ao baixar o PDF via SFTP: ", error);
    } finally {
      client.end();
    }
  }

  async MensagemTermos(
    receivenumber: any,
    header: any,
    body: any,
    right_text_url: any,
    url_site: any,
  ) {
    try {
      await whatsappOutgoingQueue.add(
        "send-terms",
        {
          url,
          payload: {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: receivenumber, // O número de telefone do destinatário
            type: "interactive",
            interactive: {
              type: "cta_url",
              header: {
                type: "text",
                text: header,
              },
              body: {
                text: body,
              },
              action: {
                name: "cta_url",
                parameters: {
                  display_text: right_text_url,
                  url: url_site,
                },
              },
            },
          },
          headers: {
            Authorization: `Bearer ${token}`, // Substitua pelo seu token de acesso
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

      const insertMessage = await ApiMkDataSource.getRepository(Mensagens).save(
        {
          conv_id: conversation.conv_id as number,
          sender_id: conversation.receiver_id,
          content: "Termos Enviados",
          timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000),
        },
      );

      console.log("Termos na fila para enviar"); // Log placeholder res
    } catch (error: any) {
      console.error(
        "Erro ao enviar mensagem com botão de link:",
        error.message,
      );
    }
  }

  async MensagemFlow(receivenumber: any, flowName: string, ctaText: string) {
    try {
      await whatsappOutgoingQueue.add(
        "send-flow",
        {
          url,
          payload: {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: receivenumber,
            type: "interactive",
            interactive: {
              type: "flow",
              body: {
                text: "Preencha o formulário abaixo para prosseguir com o seu cadastro.",
              },
              action: {
                name: "flow",
                parameters: {
                  flow_message_version: "3",
                  flow_name: flowName,
                  flow_cta: ctaText,
                },
              },
            },
          },
          headers: {
            Authorization: `Bearer ${token}`,
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

      console.log(`Flow '${flowName}' enviado para ${receivenumber}`);
    } catch (error: any) {
      console.error("Erro ao enviar Flow:", error.message);
    }
  }

  async Flow(req: Request, res: Response): Promise<void> {
    try {
      const { body } = req;

      const privatePemPath = path.resolve(__dirname, "..", "..", "private.pem");

      if (!fs.existsSync(privatePemPath)) {
        console.error(
          "Arquivo private.pem não encontrado na raiz do projeto. Necessário para WhatsApp Flows.",
        );
        res.status(500).json({
          message: "Servidor não configurado propriamente para Flows",
        });
        return;
      }

      const privatePem = fs.readFileSync(privatePemPath, "utf-8");

      const { decryptedBody, aesKeyBuffer, initialVectorBuffer } =
        decryptFlowRequest(body, privatePem);
      const { screen, data, version, action, flow_token } = decryptedBody;

      console.log("Recebido via Flow", { action, screen, data, flow_token });

      if (action === "ping") {
        const responseData = { data: { status: "active" } };
        res.send(
          encryptFlowResponse(responseData, aesKeyBuffer, initialVectorBuffer),
        );
        return;
      }

      if (action === "INIT" || action === "data_exchange") {
        // Retorna tela e dados customizados para o Whatsapp Cliente.
        const screenData = {
          screen: "SUCCESS", // Substitua "SUCCESS" pelo nome da primeira tela do seu Flow
          data: {
            // Insira os campos esperados pela tela
            status_message: "Processamento concluído com sucesso!",
          },
        };

        res.send(
          encryptFlowResponse(screenData, aesKeyBuffer, initialVectorBuffer),
        );
        return;
      }
    } catch (error) {
      console.error(
        "Erro na descriptografia/processamento do Flow Endpoint:",
        error,
      );
      // O Guia do Meta Flows recomenda enviar HTTP 421 se o body não puder ser descriptografado.
      res.status(421).send();
    }
  }

  async MensagemLista(receivenumber: any, titulo: any, campos: any) {
    try {
      await whatsappOutgoingQueue.add(
        "send-list",
        {
          url,
          payload: {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: receivenumber,
            type: "interactive",
            interactive: {
              type: "list",
              body: {
                text: titulo,
              },
              action: {
                button: "Ver opções",
                sections: campos.sections.map(
                  (section: { title: any; rows: any[] }) => ({
                    title: section.title, // Título da seção
                    rows: section.rows.map((row: { id: any; title: any }) => ({
                      id: row.id, // ID da linha
                      title: row.title, // Título da linha
                    })),
                  }),
                ),
              },
            },
          },
          headers: {
            Authorization: `Bearer ${token}`, // Substitua pelo seu token de acesso
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

      const insertMessage = await ApiMkDataSource.getRepository(Mensagens).save(
        {
          conv_id: conversation.conv_id as number,
          sender_id: conversation.receiver_id,
          content: "Lista de Opções Enviada",
          timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000),
        },
      );

      console.log("Lista de opções enviada a fila."); // Log da API
    } catch (error: any) {
      console.error("Erro ao enviar mensagem de lista:", error.message);
    }
  }

  async MensagemBotao(
    receivenumber: any,
    texto: any,
    title1: any,
    title2: any = 0,
    title3: any = 0,
  ) {
    try {
      if (title3 != 0 && title2 != 0) {
        await whatsappOutgoingQueue.add(
          "send-button",
          {
            url,
            payload: {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: receivenumber,
              type: "interactive",
              interactive: {
                type: "button",
                body: {
                  text: texto,
                },
                action: {
                  buttons: [
                    {
                      type: "reply",
                      reply: {
                        id: "1",
                        title: title1,
                      },
                    },
                    {
                      type: "reply",
                      reply: {
                        id: "2",
                        title: title2,
                      },
                    },
                    {
                      type: "reply",
                      reply: {
                        id: "3",
                        title: title3,
                      },
                    },
                  ],
                },
              },
            },
            headers: {
              Authorization: `Bearer ${token}`,
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
      } else if (title3 != 0) {
        await whatsappOutgoingQueue.add(
          "send-button",
          {
            url,
            payload: {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: receivenumber,
              type: "interactive",
              interactive: {
                type: "button",
                body: {
                  text: texto,
                },
                action: {
                  buttons: [
                    {
                      type: "reply",
                      reply: {
                        id: "1",
                        title: title1,
                      },
                    },
                    {
                      type: "reply",
                      reply: {
                        id: "2",
                        title: title2,
                      },
                    },
                  ],
                },
              },
            },
            headers: {
              Authorization: `Bearer ${token}`,
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
      } else if (title3 == 0 && title2 == 0) {
        await whatsappOutgoingQueue.add(
          "send-button",
          {
            url,
            payload: {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: receivenumber,
              type: "interactive",
              interactive: {
                type: "button",
                body: {
                  text: texto,
                },
                action: {
                  buttons: [
                    {
                      type: "reply",
                      reply: {
                        id: "1",
                        title: title1,
                      },
                    },
                  ],
                },
              },
            },
            headers: {
              Authorization: `Bearer ${token}`,
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
      } else {
        await whatsappOutgoingQueue.add(
          "send-button",
          {
            url,
            payload: {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: receivenumber,
              type: "interactive",
              interactive: {
                type: "button",
                body: {
                  text: texto,
                },
                action: {
                  buttons: [
                    {
                      type: "reply",
                      reply: {
                        id: "1",
                        title: title1,
                      },
                    },
                    {
                      type: "reply",
                      reply: {
                        id: "2",
                        title: title2,
                      },
                    },
                  ],
                },
              },
            },
            headers: {
              Authorization: `Bearer ${token}`,
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

      const insertMessage = await ApiMkDataSource.getRepository(Mensagens).save(
        {
          conv_id: conversation.conv_id as number,
          sender_id: conversation.receiver_id,
          content: "Mensagem de Botão Enviada",
          timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000),
        },
      );
    } catch (error: any) {
      console.error("Error queueing button message:", error.message);
    }
  }

  async getMediaID(
    receivenumber: any,
    filePath: any,
    type: any,
    messaging_product: any = "whatsapp",
  ) {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));
    formData.append("type", type);
    formData.append("messaging_product", messaging_product);

    // Media upload will remain synchronous since getMediaID needs the ID right away
    // to pass to MensagensDeMidia.
    try {
      const response = await axios.post(urlMedia, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
        },
      });

      console.log("Mídia enviada com sucesso:", response.data);
      const mediaId = response.data.id;
      console.log("MEDIA ID: " + mediaId);
      this.MensagensDeMidia(receivenumber, "document", mediaId, "Boleto");
    } catch (error: any) {
      console.error(
        "Erro ao enviar a mídia:",
        error.response?.data || error.message,
      );
    }
  }

  async MensagensDeMidia(
    receivenumber: any,
    type: any,
    mediaID: any,
    filename: any,
  ) {
    try {
      await whatsappOutgoingQueue.add(
        "send-media",
        {
          url,
          payload: {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: receivenumber,
            type: type,
            document: {
              // Substituímos "image" por "document"
              id: mediaID,
              filename: filename, // O nome do arquivo enviado
            },
          },
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
        { removeOnComplete: true, removeOnFail: false },
      );

      const insertMessage = await ApiMkDataSource.getRepository(Mensagens).save(
        {
          conv_id: conversation.conv_id as number,
          sender_id: conversation.receiver_id,
          content: "Arquivo Enviado",
          timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000),
        },
      );
    } catch (error: any) {
      console.error("Error queueing media message:", error.message);
    }
  }

  async Finalizar(msg: any, celular: any, sessions: any) {
    try {
      await this.MensagensComuns(process.env.TEST_PHONE, msg);
      if (sessions[celular] && sessions[celular].inactivityTimer) {
        clearTimeout(sessions[celular].inactivityTimer);
      }
      this.deleteSession(celular);

      const insertMessage = await ApiMkDataSource.getRepository(Mensagens).save(
        {
          conv_id: conversation.conv_id as number,
          sender_id: conversation.receiver_id,
          content: msg,
          timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000),
        },
      );
    } catch (error) {
      console.log("Error sending message:", error);
    }
  }
}

const whatsPixController = new WhatsPixController();

// --- Incoming Message Worker ---
const incomingWorker = new Worker(
  "whatsapp-incoming",
  async (job: Job) => {
    const { texto, celular, type, manutencao, messageId } = job.data;
    console.log(`[BullMQ] Processando webhook ID: ${messageId}`);

    // Use the live in-memory session, NOT the serialized copy from the job.
    // The serialized copy is a dead snapshot — changes to session.stage would be lost.
    if (!sessions[celular]) {
      // Tenta buscar do banco caso o servidor tenha reiniciado
      const sessionDB = await ApiMkDataSource.getRepository(Sessions).findOne({
        where: { celular },
      });
      if (sessionDB) {
        sessions[celular] = {
          stage: sessionDB.stage,
          ...sessionDB.dados,
        };
      } else {
        sessions[celular] = { stage: "" };
      }
    }
    const session = sessions[celular];

    try {
      await whatsPixController.handleMessage(
        session,
        texto,
        celular,
        type,
        manutencao,
      );
    } catch (err: any) {
      console.error(
        `[BullMQ] Erro ao processar mensagem ${messageId}:`,
        err.message,
      );
      throw err; // re-throw para o BullMQ marcar como falha
    }

    // Save session state after handling the message correctly in the background
    if (sessions[celular]) {
      sessions[celular].last_message_id = messageId;
    }
    await whatsPixController.saveSession(celular);
  },
  { connection: redisOptions },
);

// --- Outgoing Message Worker ---
const outgoingWorker = new Worker(
  "whatsapp-outgoing",
  async (job: Job) => {
    const { url, payload, headers } = job.data;
    console.log(`[BullMQ] Enviando mensagem para ${payload?.to || "mídia"}`);

    try {
      await axios.post(url, payload, { headers });
    } catch (err: any) {
      console.error(
        `[BullMQ] Erro ao enviar mensagem:`,
        err.response?.data || err.message,
      );
      throw err; // re-throw para o BullMQ marcar como falha
    }
  },
  {
    connection: redisOptions,
    limiter: { max: 10, duration: 1000 }, // Rate limit: max 10 msgs/seg
  },
);

// --- Worker Event Listeners ---
incomingWorker.on("failed", (job, err) => {
  console.error(`[BullMQ:incoming] Job ${job?.id} falhou:`, err.message);
});

outgoingWorker.on("failed", (job, err) => {
  console.error(`[BullMQ:outgoing] Job ${job?.id} falhou:`, err.message);
});

// Limpa jobs falhados antigos na inicialização
(async () => {
  try {
    const failedIncoming = await whatsappIncomingQueue.getFailed(0, 100);
    const failedOutgoing = await whatsappOutgoingQueue.getFailed(0, 100);
    for (const job of failedIncoming) await job.remove();
    for (const job of failedOutgoing) await job.remove();
    console.log(
      `[BullMQ] Limpou ${failedIncoming.length} incoming + ${failedOutgoing.length} outgoing jobs falhados`,
    );
  } catch (e: any) {
    console.error("[BullMQ] Erro ao limpar jobs falhados:", e.message);
  }
})();

export default whatsPixController;
