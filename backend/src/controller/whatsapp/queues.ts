import { Worker, Job } from "bullmq";
import axios from "axios";
import { redisOptions } from "./config";
import { sessions, saveSession } from "./services/session.service";
import { whatsappIncomingQueue, whatsappOutgoingQueue } from "./services/messaging.service";
import { handleMessage } from "./handlers/message.handler";
import ApiMkDataSource from "../../database/API_MK";
import Sessions from "../../entities/APIMK/Sessions";

let incomingWorker: Worker;
let outgoingWorker: Worker;

export function initQueues() {
  // --- Incoming Message Worker ---
  incomingWorker = new Worker(
    "whatsapp-incoming",
    async (job: Job) => {
      const { texto, celular, type, manutencao, messageId } = job.data;
      console.log(`[BullMQ] Processando webhook ID: ${messageId}`);
      console.log(`[BullMQ] sessions[${celular}] stage ANTES = "${sessions[celular]?.stage}"`);

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
      console.log(`[BullMQ] sessions[${celular}] stage DEPOIS = "${sessions[celular]?.stage}"`);
      await saveSession(celular);
    },
    { connection: redisOptions },
  );

  // --- Outgoing Message Worker ---
  outgoingWorker = new Worker(
    "whatsapp-outgoing",
    async (job: Job) => {
      const { url, payload, headers } = job.data;
      console.log(`[BullMQ] Enviando mensagem para ${payload?.to || "mídia"} (job: ${job.name})`);

      try {
        await axios.post(url, payload, { headers });
      } catch (err: any) {
        const apiError = err.response?.data;
        const status = err.response?.status;
        console.error(
          `[BullMQ] Erro ao enviar mensagem (HTTP ${status ?? "sem resposta"}):`,
          apiError || err.message,
        );
        if (apiError) {
          throw new Error(JSON.stringify(apiError));
        }
        throw err;
      }
    },
    {
      connection: redisOptions,
      // 20 msgs/s: reduz atraso perceptível em fluxos que enviam 3-4 mensagens seguidas
      limiter: { max: 20, duration: 1000 },
    },
  );

  // --- Worker Event Listeners ---
  incomingWorker.on("failed", (job, err) => {
    console.error(`[BullMQ:incoming] Job ${job?.id} falhou:`, err.message);
  });

  outgoingWorker.on("failed", async (job, err) => {
    console.error(`[BullMQ:outgoing] Job ${job?.id} falhou:`, err.message);

    const to = job?.data?.payload?.to;
    const url = job?.data?.url;
    const headers = job?.data?.headers;
    const isFlowMessage = job?.data?.payload?.interactive?.type === "flow";

    if (!to || !url || !headers || !isFlowMessage) {
      return;
    }

    const errorMessage = String(err.message || "");
    const invalidFlow =
      errorMessage.includes("flow_name") &&
      errorMessage.includes("is invalid");

    if (!invalidFlow) {
      return;
    }

    await whatsappOutgoingQueue.add(
      "send-message",
      {
        url,
        payload: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: {
            preview_url: false,
            body:
              "⚠️ Não consegui abrir o formulário agora. Um atendente continuará com você por aqui para seguir com a troca de titularidade.",
          },
        },
        headers,
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 1,
      },
    );
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

  console.log("[BullMQ] Workers inicializados com sucesso");
}
