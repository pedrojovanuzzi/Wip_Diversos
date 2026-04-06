import { Worker, Queue, Job } from "bullmq";
import axios from "axios";
import Redis from "ioredis";
import { redisOptions } from "./config";
import { saveSession, deleteSession } from "./services/session.service";
import { whatsappIncomingQueue, whatsappOutgoingQueue } from "./services/messaging.service";
import { handleMessage } from "./handlers/message.handler";
import ApiMkDataSource from "../../database/API_MK";
import Sessions from "../../entities/APIMK/Sessions";
import { MensagensComuns } from "./services/messaging.service";

// Chave Redis para marcar mensagens JÁ processadas pelo worker.
// Evita reprocessamento de jobs "stale" após restart do servidor.
const redisDedupWorker = new Redis(redisOptions);
const PROCESSED_KEY = (id: string) => `wa:msg:processed:${id}`;

// Fila de inatividade: jobs atrasados de 15 min por usuário
export const whatsappInactivityQueue = new Queue("whatsapp-inactivity", {
  connection: redisOptions,
});

let incomingWorker: Worker;
let outgoingWorker: Worker;
let inactivityWorker: Worker;

export function initQueues() {
  // --- Incoming Message Worker ---
  incomingWorker = new Worker(
    "whatsapp-incoming",
    async (job: Job) => {
      const { texto, celular, type, manutencao, messageId } = job.data;
      console.log(`[BullMQ] Processando webhook ID: ${messageId}`);

      // Dedup de processamento: descarta jobs stale que sobreviveram a um restart.
      const alreadyProcessed = await redisDedupWorker.exists(PROCESSED_KEY(messageId));
      if (alreadyProcessed) {
        console.log(`[BullMQ] Job descartado — já processado anteriormente: ${messageId}`);
        return;
      }

      // 1. Busca a sessão EXCLUSIVAMENTE do banco de dados (sem estado global).
      const sessionDB = await ApiMkDataSource.getRepository(Sessions).findOne({
        where: { celular },
      });

      // 2. Cria um contexto ISOLADO e LOCAL — nenhuma outra requisição tem acesso a ele.
      let sessionContext: any;
      if (sessionDB) {
        if (sessionDB.last_message_id === messageId) {
          console.log(`[BullMQ] Job descartado — last_message_id já registrado: ${messageId}`);
          return;
        }
        sessionContext = {
          stage: sessionDB.stage,
          ...sessionDB.dados,
        };
      } else {
        sessionContext = { stage: "" };
      }

      console.log(`[BullMQ] sessionContext[${celular}] stage ANTES = "${sessionContext.stage}"`);

      // Marca como processado antes de executar (TTL 24h, igual ao dedup do webhook)
      await redisDedupWorker.set(PROCESSED_KEY(messageId), "1", "EX", 86400);

      // Cancela timer de inatividade anterior e reagenda para 15 min a partir de agora
      const inactivityJobId = `inactivity-${celular}`;
      try {
        const existingJob = await whatsappInactivityQueue.getJob(inactivityJobId);
        if (existingJob) await existingJob.remove();
      } catch (_) {}

      try {
        // 3. Passa o contexto isolado para a lógica de negócio
        await handleMessage(sessionContext, texto, celular, type, manutencao);
      } catch (err: any) {
        console.error(
          `[BullMQ] Erro ao processar mensagem ${messageId}:`,
          err.message,
        );
        throw err;
      }

      console.log(`[BullMQ] sessionContext[${celular}] stage DEPOIS = "${sessionContext.stage}"`);

      // 4. Salva ou deleta conforme o que aconteceu dentro do handleMessage
      if (sessionContext._deleted) {
        await deleteSession(celular);
      } else {
        await saveSession(celular, sessionContext, messageId);
        // Reagenda inatividade de 15 min para este usuário
        await whatsappInactivityQueue.add(
          "session-timeout",
          { celular },
          {
            jobId: inactivityJobId,
            delay: 900000,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
      }
    },
    { connection: redisOptions },
  );

  // --- Inactivity Worker ---
  inactivityWorker = new Worker(
    "whatsapp-inactivity",
    async (job: Job) => {
      const { celular } = job.data;
      console.log(`[BullMQ:inactivity] Encerrando sessão por inatividade: ${celular}`);
      await MensagensComuns(
        celular,
        "🤷🏻 Seu atendimento foi *finalizado* devido à inatividade!!\nEntre em contato novamente 👍",
      );
      await deleteSession(celular);
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

  inactivityWorker.on("failed", (job, err) => {
    console.error(`[BullMQ:inactivity] Job ${job?.id} falhou:`, err.message);
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
              "⚠️ Não consegui abrir o formulário agora. Um atendente continuará com você por aqui para seguir com a alteração de titularidade.",
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
