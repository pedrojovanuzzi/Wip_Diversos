import { Worker, Job } from "bullmq";
import axios from "axios";
import { redisOptions } from "./config";
import { sessions, saveSession } from "./services/session.service";
import { whatsappIncomingQueue, whatsappOutgoingQueue } from "./services/messaging.service";
import { handleMessage } from "./handlers/message.handler";
import ApiMkDataSource from "../../database/API_MK";
import Sessions from "../../entities/APIMK/Sessions";

// --- Incoming Message Worker ---
export const incomingWorker = new Worker(
  "whatsapp-incoming",
  async (job: Job) => {
    const { texto, celular, type, manutencao, messageId } = job.data;
    console.log(`[BullMQ] Processando webhook ID: ${messageId}`);

    if (!sessions[celular]) {
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
      await handleMessage(session, texto, celular, type, manutencao);
    } catch (err: any) {
      console.error(
        `[BullMQ] Erro ao processar mensagem ${messageId}:`,
        err.message,
      );
      throw err;
    }

    if (sessions[celular]) {
      sessions[celular].last_message_id = messageId;
    }
    await saveSession(celular);
  },
  { connection: redisOptions },
);

// --- Outgoing Message Worker ---
export const outgoingWorker = new Worker(
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
      throw err;
    }
  },
  {
    connection: redisOptions,
    limiter: { max: 10, duration: 1000 },
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
