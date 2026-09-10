/**
 * Aceite do Termo de Adesão SVA no bot.
 *
 * O plano combo inclui a Watch TV, um Serviço de Valor Adicionado — e o
 * cliente precisa aceitar o termo antes de o pedido ser fechado, do mesmo
 * jeito que o site pede o aceite antes do formulário.
 *
 * O termo só aparece depois da escolha do plano: é ali que se sabe se ele tem
 * SVA. Por isso o fluxo original é interrompido, o aceite é pedido, e depois
 * o mesmo passo é reexecutado — agora com `aceitouTermoSva` marcado.
 */

import { planoTemSva } from "../../../config/planosComSva";
import {
  MensagemBotao,
  MensagensComuns,
} from "../services/messaging.service";

/** De onde o cliente veio, para retomar no lugar certo depois do aceite. */
export type OrigemTermoSva = "instalacao" | "troca_plano";

/**
 * Precisa pedir o aceite agora?
 *
 * Só quando o plano tem SVA e o cliente ainda não aceitou nesta conversa.
 */
export function precisaAceitarTermoSva(session: any, plano?: string | null) {
  return planoTemSva(plano) && !session.aceitouTermoSva;
}

/** Interrompe o fluxo e pede o aceite do termo. */
export async function pedirAceiteTermoSva(
  celular: any,
  session: any,
  origem: OrigemTermoSva,
  /** O que reexecutar depois do aceite (o mesmo texto que chegou agora). */
  textoOriginal: string,
) {
  session.termoSvaOrigem = origem;
  session.termoSvaTexto = textoOriginal;
  session.stage = "aguardando_termo_sva";

  // Sem botão de "ler": o Termo de Adesão SVA não é um PDF no site, é o
  // documento que sai no ZapSign junto do contrato do plano. Aqui o cliente
  // confirma que aceita recebê-lo para assinar.
  await MensagensComuns(
    celular,
    `📺 Este plano inclui a *Watch TV*, um Serviço de Valor Adicionado (SVA).\n\n` +
      `📄 Junto do contrato do plano você recebe o *Termo de Adesão SVA*, ` +
      `para assinar pelo mesmo link.`,
  );
  await MensagemBotao(
    celular,
    "Podemos seguir com a contratação?",
    "Sim Aceito",
    "Não",
  );
}

/**
 * Resposta do cliente ao termo.
 *
 * Aceitou: o passo que foi interrompido roda de novo, agora até o fim.
 * Recusou: o atendimento encerra, porque sem o termo o plano não pode ser
 * contratado.
 */
export async function handleTermoSva(
  celular: any,
  texto: any,
  session: any,
) {
  const t = String(texto || "").trim().toLowerCase();

  if (t === "sim aceito") {
    session.aceitouTermoSva = true;
    const origem: OrigemTermoSva = session.termoSvaOrigem;
    const original = session.termoSvaTexto;
    session.termoSvaOrigem = undefined;
    session.termoSvaTexto = undefined;

    if (origem === "troca_plano") {
      const { handleAwaitingTrocaPlanoFlow } = await import("./servicos.handler");
      session.stage = "awaiting_troca_plano_flow";
      await handleAwaitingTrocaPlanoFlow(celular, original, session);
      return;
    }

    const { handleAwaitingFlowCadastro, handleFinalRegister } = await import(
      "./cadastro.handler"
    );
    // O cadastro tem dois caminhos: o formulário do WhatsApp, que volta como
    // JSON, e o passo a passo, que termina no botão de aceite.
    if (original && original.trim().startsWith("{")) {
      session.stage = "awaiting_flow_cadastro";
      await handleAwaitingFlowCadastro(celular, original, session);
    } else {
      session.stage = "final_register";
      await handleFinalRegister(celular, "sim, li e aceito", session);
    }
    return;
  }

  if (t === "não" || t === "nao") {
    await MensagensComuns(
      celular,
      "🥹 Sem o aceite do *Termo de Adesão SVA* não conseguimos seguir com um " +
        "plano que inclui a Watch TV.\n\nDigite *início* para escolher outro plano.",
    );
    session._deleted = true;
    return;
  }

  await MensagemBotao(
    celular,
    "Podemos seguir com a contratação?",
    "Sim Aceito",
    "Não",
  );
}
