import { Request, Response } from "express";
import { token } from "../config";
import { findOrCreate } from "../utils/helpers";
import { writeLog } from "../utils/logging";
import { sessions, saveSession, deleteSession } from "../services/session.service";
import { whatsappIncomingQueue } from "../services/messaging.service";
import ApiMkDataSource from "../../../database/API_MK";
import PeopleConversation from "../../../entities/APIMK/People_Conversations";
import Conversations from "../../../entities/APIMK/Conversations";
import Sessions from "../../../entities/APIMK/Sessions";
import { isSandbox, logFilePath, manutencao } from "../config";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

const processedMessages = new Map<string, number>(); // messageId → timestamp

export async function verify(req: Request, res: Response) {
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

export async function index(req: Request, res: Response) {
  // Responde 200 imediatamente para evitar retries do Meta por timeout
  res.sendStatus(200);

  try {
    const body = req.body;

    if (body.reqbody || !body.entry) {
      return;
    }

    if (body.entry) {
      const entryId = body.entry?.[0]?.id;

      if (entryId === process.env.WHATS_BUSSINES_TESTID && !isSandbox) {
        console.log("Mensagem de teste ignorada em produção");
        return;
      }

      if (entryId !== process.env.WHATS_BUSSINES_TESTID && isSandbox) {
        console.log("Mensagem de produção ignorada em sandbox");
        return;
      }

      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            const value = change.value;

            if (value && value.messages) {
              console.log("Webhook recebido - mensagem(ns) detectada(s)");

              await findOrCreate(
                ApiMkDataSource.getRepository(PeopleConversation),
                {
                  where: { telefone: process.env.SENDER_NUMBER },
                  defaults: { nome: "Você", telefone: process.env.SENDER_NUMBER },
                },
              );

              await findOrCreate(
                ApiMkDataSource.getRepository(Conversations),
                {
                  where: { id: 1 },
                  defaults: { nome: "Você" },
                },
              );

              for (const message of value.messages) {
                const celular = message.from;
                const type = message.type;
                const messageId = message.id;

                // Deduplicação: TTL de 24h para cobrir a janela de retry do Meta
                const now = Date.now();
                const TTL_24H = 24 * 60 * 60 * 1000;
                if (processedMessages.has(messageId)) {
                  console.log(`Mensagem duplicada ignorada: ${messageId}`);
                  continue;
                }
                processedMessages.set(messageId, now);
                // Limpa entradas expiradas periodicamente ao invés de setTimeout por mensagem
                if (processedMessages.size > 500) {
                  for (const [id, ts] of processedMessages) {
                    if (now - ts > TTL_24H) processedMessages.delete(id);
                  }
                }

                if (!celular || !type) {
                  continue;
                }

                // Checa last_message_id tanto na sessão em memória quanto no banco (primeiro acesso)
                if (sessions[celular]) {
                  if (sessions[celular].last_message_id === messageId) {
                    console.log(`Mensagem já processada (sessão ativa): ${messageId}`);
                    continue;
                  }
                  // Garante que sessões antigas em memória também tenham conversationId
                  if (!sessions[celular].conversationId) {
                    sessions[celular].conversationId = uuidv4();
                  }
                } else {
                  const newConversationId = uuidv4();
                  sessions[celular] = { stage: "", conversationId: newConversationId };

                  const sessionDB = await ApiMkDataSource.getRepository(
                    Sessions,
                  ).findOne({ where: { celular } });

                  if (sessionDB) {
                    if (sessionDB.last_message_id === messageId) {
                      console.log(`Mensagem já processada (banco): ${messageId}`);
                      continue;
                    }
                    sessions[celular] = {
                      stage: sessionDB.stage,
                      ...sessionDB.dados,
                      // Preserva o conversationId salvo no banco; se não houver, usa o gerado acima
                      conversationId: sessionDB.dados?.conversationId || newConversationId,
                    };
                  }
                }

                let mensagemCorpo = "";

                if (type === "interactive") {
                  const interactive = message.interactive;

                  if (interactive.type === "button_reply") {
                    mensagemCorpo = interactive.button_reply.title;
                  }

                  if (interactive.type === "list_reply") {
                    mensagemCorpo = interactive.list_reply.title;
                  }

                  if (interactive.type === "nfm_reply") {
                    const responseJson = interactive.nfm_reply?.response_json;
                    if (responseJson) {
                      // Se o nfm_reply contém APENAS flow_token, o usuário fechou o Flow
                      // sem enviar — não é uma submissão, deve ser ignorado.
                      try {
                        const parsed = JSON.parse(responseJson);
                        const keys = Object.keys(parsed);
                        if (keys.length === 1 && keys[0] === "flow_token") {
                          console.log(`[Webhook] Flow descartado sem envio (flow_token only): ${celular}`);
                          continue;
                        }
                      } catch (_) {
                        // não é JSON válido — ignora silenciosamente
                        continue;
                      }
                      mensagemCorpo = responseJson;
                    }
                  }
                } else if (type === "text") {
                  mensagemCorpo = message.text?.body || "";
                } else if (type === "button") {
                  mensagemCorpo = message.button?.text || message.button?.payload || "";
                }

                if (mensagemCorpo || type) {
                  const texto = mensagemCorpo;
                  const session = sessions[celular];

                  if (type === "undefined" || type === undefined) {
                    break;
                  }

                  // Log
                  fs.readFile(logFilePath, "utf8", (err, data) => {
                    let logs: any[] = [];
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
                      celular: celular,
                      type: type,
                      texto: texto,
                      timestamp: new Date().toISOString(),
                    };

                    logs.push(log);

                    const jsonString = JSON.stringify(logs, null, 2);

                    fs.writeFile(logFilePath, jsonString, "utf8", (err) => {
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

                  await whatsappIncomingQueue.add(
                    "process-message",
                    {
                      texto,
                      celular,
                      type,
                      manutencao,
                      messageId,
                      conversationId: sessions[celular]?.conversationId,
                    },
                    {
                      jobId: messageId,
                      removeOnComplete: true,
                      removeOnFail: false,
                      attempts: 1,
                    },
                  );
                }
              }
            }
          }
        }
      }
    }

  } catch (error) {
    console.error(error);
  }
}
