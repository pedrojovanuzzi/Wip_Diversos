import ApiMkDataSource from "../../../database/API_MK";
import Sessions from "../../../entities/APIMK/Sessions";

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

// Salva a sessão diretamente no banco. messageId só é atualizado quando fornecido (não null).
export async function saveSession(celular: string, sessionData: any, messageId: string | null = null) {
  const { stage, _deleted, inactivityTimer, ...dados } = sessionData;
  const repo = ApiMkDataSource.getRepository(Sessions);

  const updateData: any = {
    stage: stage || "",
    dados: dados || {},
  };
  if (messageId !== null) {
    updateData.last_message_id = messageId;
  }

  const result = await repo.update({ celular }, updateData);
  if (result.affected === 0) {
    await repo.save({ celular, ...updateData });
  }
}

export async function deleteSession(celular: string) {
  await ApiMkDataSource.getRepository(Sessions).delete({ celular });
  console.log(`Sessão removida do banco para ${celular}`);
}

export async function getActiveSessionsCount() {
  return await ApiMkDataSource.getRepository(Sessions).count();
}
