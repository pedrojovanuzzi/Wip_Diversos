import ApiMkDataSource from "../../../database/API_MK";
import Sessions from "../../../entities/APIMK/Sessions";

export const sessions: { [key: string]: any } = {};

export let conversation: {
  conv_id: number | null;
  sender_id: number | null;
  receiver_id: number;
} = {
  conv_id: null,
  sender_id: null,
  receiver_id: 1,
};

export function setConversation(conv: typeof conversation) {
  conversation = conv;
}

export async function saveSession(celular: string) {
  if (sessions[celular]) {
    const { stage, inactivityTimer, ...dados } = sessions[celular];
    await ApiMkDataSource.getRepository(Sessions).save({
      celular,
      stage: stage || "",
      dados: dados || {},
    });
  }
}

export async function deleteSession(celular: string) {
  if (sessions[celular]) {
    delete sessions[celular];
  }
  await ApiMkDataSource.getRepository(Sessions).delete({ celular });
  console.log(`Sessão removida do banco para ${celular}`);
}

export function getActiveSessionsCount() {
  return Object.keys(sessions).length;
}
