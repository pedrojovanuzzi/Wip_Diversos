import moment from "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import MkauthDataSource from "../../../database/MkauthSource";
import AppDataSource from "../../../database/DataSource";
import { ChamadosEntities } from "../../../entities/ChamadosEntities";
import { SisMsg } from "../../../entities/SisMsg";
import { SolicitacaoServico } from "../../../entities/SolicitacaoServico";

/**
 * Cria um chamado no Mkauth (sis_suporte + sis_msg) e opcionalmente
 * associa o id_chamado à solicitação de serviço.
 */
export async function criarChamadoMkauth(
  assunto: string,
  session: any,
  mensagem: string,
  solicitacao?: SolicitacaoServico | null,
): Promise<string | null> {
  try {
    const agora = new Date();
    // Formato DDMMYYHHmmss + 2 dígitos aleatórios (igual ao padrão do Mkauth)
    const chamadoId =
      moment().tz("America/Sao_Paulo").format("DDMMYYHHmmss") +
      Math.floor(Math.random() * 100).toString().padStart(2, "0");

    await MkauthDataSource.getRepository(ChamadosEntities).save({
      uuid_suporte: uuidv4().substring(0, 36),
      assunto: assunto.toUpperCase(),
      abertura: agora,
      email: session.email || "",
      status: "aberto",
      chamado: chamadoId,
      nome: session.nome || "",
      login: session.login || "",
      atendente: "BOT WHATSAPP",
      ramal: "",
      prioridade: "normal",
      tecnico: "todos",
    });

    await MkauthDataSource.getRepository(SisMsg).save({
      chamado: chamadoId,
      msg: mensagem,
      tipo: "provedor",
      login: session.login || "",
      atendente: "BOT WHATSAPP",
      msg_data: agora,
    });

    if (solicitacao) {
      solicitacao.id_chamado = chamadoId;
      await AppDataSource.getRepository(SolicitacaoServico).save(solicitacao);
    }

    console.log(`[Chamado] Criado chamado ${chamadoId} para: ${assunto}`);
    return chamadoId;
  } catch (error) {
    console.error("[Chamado] Erro ao criar chamado no Mkauth:", error);
    return null;
  }
}
