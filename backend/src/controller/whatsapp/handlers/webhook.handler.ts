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

const processedMessages = new Set<string>();

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
  console.log("Webhook recebido");
  console.log(req.body);

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
        where: { id: 1 },
        defaults: { nome: "Você" },
      },
    );

    const body = req.body;

    if (body.reqbody) {
      res.sendStatus(200);
      return;
    }

    if (!body.entry) {
      res.sendStatus(200);
      return;
    }

    if (body.entry) {
      const entryId = body.entry?.[0]?.id;

      if (entryId === process.env.WHATS_BUSSINES_TESTID && !isSandbox) {
        console.log("Mensagem de teste ignorada em produção");
        res.sendStatus(200);
        return;
      }

      if (entryId !== process.env.WHATS_BUSSINES_TESTID && isSandbox) {
        console.log("Mensagem de produção ignorada em sandbox");
        res.sendStatus(200);
        return;
      }

      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            const value = change.value;

            if (value && value.messages) {
              for (const message of value.messages) {
                const celular = message.from;
                const type = message.type;
                const messageId = message.id;

                if (processedMessages.has(messageId)) {
                  console.log(`Mensagem duplicada ignorada: ${messageId}`);
                  res.sendStatus(200);
                  return;
                }

                processedMessages.add(messageId);
                setTimeout(
                  () => processedMessages.delete(messageId),
                  5 * 60 * 1000,
                );

                if (!celular || !type) {
                  res.sendStatus(200);
                  return;
                }

                if (!sessions[celular]) {
                  sessions[celular] = { stage: "" };

                  const sessionDB = await ApiMkDataSource.getRepository(
                    Sessions,
                  ).findOne({ where: { celular } });

                  if (sessionDB) {
                    if (sessionDB.last_message_id === messageId) {
                      console.log(`Mensagem já processada: ${messageId}`);
                      res.sendStatus(200);
                      return;
                    }
                    sessions[celular] = {
                      stage: sessionDB.stage,
                      ...sessionDB.dados,
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
                    const responseJson =
                      interactive.nfm_reply?.response_json;
                    if (responseJson) {
                      mensagemCorpo = responseJson;
                    }
                  }
                } else if (type === "text") {
                  mensagemCorpo = message.text?.body || "";
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
                      session: { ...session },
                    },
                    {
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

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(200);
  }
}
