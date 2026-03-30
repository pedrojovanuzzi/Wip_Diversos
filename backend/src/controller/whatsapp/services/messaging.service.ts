import { Queue } from "bullmq";
import { url, token, redisOptions } from "../config";
import ApiMkDataSource from "../../../database/API_MK";
import Mensagens from "../../../entities/APIMK/Mensagens";
import { conversation, sessions, deleteSession } from "./session.service";

export const whatsappOutgoingQueue = new Queue("whatsapp-outgoing", {
  connection: redisOptions,
});

export const whatsappIncomingQueue = new Queue("whatsapp-incoming", {
  connection: redisOptions,
});

const defaultJobOptions = {
  removeOnComplete: true,
  removeOnFail: false,
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
};

async function saveOutgoingMessage(content: string) {
  if (
    conversation?.conv_id === null ||
    conversation?.conv_id === undefined ||
    typeof conversation.conv_id !== "number"
  ) {
    return;
  }

  try {
    await ApiMkDataSource.getRepository(Mensagens).save({
      conv_id: conversation.conv_id,
      sender_id: conversation.receiver_id,
      content,
      timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000),
    });
  } catch (error) {
    console.error("Erro ao salvar mensagem de saída no histórico:", error);
  }
}

function authHeaders() {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function MensagensComuns(recipient_number: any, msg: any) {
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
      { url, payload, headers: authHeaders() },
      defaultJobOptions,
    );

    await saveOutgoingMessage(msg);
  } catch (error) {
    console.error("Error queueing message:", error);
  }
}

export async function enviarNotificacaoServico(recipient_number: any) {
  try {
    await whatsappOutgoingQueue.add(
      "send-template",
      {
        url,
        payload: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient_number,
          type: "template",
          template: {
            name: "notificacao_servico",
            language: { code: "pt_BR" },
          },
        },
        headers: authHeaders(),
      },
      defaultJobOptions,
    );
  } catch (error: any) {
    console.error(
      "Error queueing notificacao_servico template:",
      error.message,
    );
  }
}

export async function PodeMePassarOCpf(recipient_number: any) {
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
          text: { preview_url: false, body: String(msg) },
        },
        headers: authHeaders(),
      },
      defaultJobOptions,
    );

    await saveOutgoingMessage("Pode me passar o CPF?");
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

export async function boasVindas(receivenumber: any) {
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
            language: { code: "pt_BR" },
            components: [{ type: "body" }],
          },
        },
        headers: authHeaders(),
      },
      defaultJobOptions,
    );

    await saveOutgoingMessage("Bem-vindo ao nosso serviço de WhatsApp!");
  } catch (error) {
    console.error("Error sending template message:", error);
  }
}

export async function MensagemTermos(
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
          to: receivenumber,
          type: "interactive",
          interactive: {
            type: "cta_url",
            header: { type: "text", text: header },
            body: { text: body },
            action: {
              name: "cta_url",
              parameters: { display_text: right_text_url, url: url_site },
            },
          },
        },
        headers: authHeaders(),
      },
      defaultJobOptions,
    );

    await saveOutgoingMessage("Termos Enviados");
    console.log("Termos na fila para enviar");
  } catch (error: any) {
    console.error("Erro ao enviar mensagem com botão de link:", error.message);
  }
}

export async function MensagemBotao(
  receivenumber: any,
  texto: any,
  title1: any,
  title2: any = 0,
  title3: any = 0,
) {
  try {
    const buttons: any[] = [
      { type: "reply", reply: { id: "1", title: title1 } },
    ];

    if (title2 != 0) {
      buttons.push({ type: "reply", reply: { id: "2", title: title2 } });
    }
    if (title3 != 0) {
      buttons.push({ type: "reply", reply: { id: "3", title: title3 } });
    }

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
            body: { text: texto },
            action: { buttons },
          },
        },
        headers: authHeaders(),
      },
      defaultJobOptions,
    );

    await saveOutgoingMessage("Mensagem de Botão Enviada");
  } catch (error: any) {
    console.error("Error queueing button message:", error.message);
  }
}

export async function MensagemLista(
  receivenumber: any,
  titulo: any,
  campos: any,
) {
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
            body: { text: titulo },
            action: {
              button: "Ver opções",
              sections: campos.sections.map(
                (section: { title: any; rows: any[] }) => ({
                  title: section.title,
                  rows: section.rows.map((row: { id: any; title: any }) => ({
                    id: row.id,
                    title: row.title,
                  })),
                }),
              ),
            },
          },
        },
        headers: authHeaders(),
      },
      defaultJobOptions,
    );

    await saveOutgoingMessage("Lista de Opções Enviada");
    console.log("Lista de opções enviada a fila.");
  } catch (error: any) {
    console.error("Erro ao enviar mensagem de lista:", error.message);
  }
}

export async function MensagemFlow(
  receivenumber: any,
  flowName: string,
  ctaText: string,
  planosDoSistema: any[] = [],
) {
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
                flow_token: `sessao_${receivenumber}_${Date.now()}`,
                flow_action: "navigate",
                flow_action_payload: {
                  screen: "CADASTRO_COMPLETO",
                  data: { planos_do_sistema: planosDoSistema },
                },
                mode: "published",
              },
            },
          },
        },
        headers: authHeaders(),
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 1,
      },
    );

    console.log(`Flow '${flowName}' enviado para ${receivenumber}`);
  } catch (error: any) {
    console.error("Erro ao enviar Flow:", error.message);
  }
}

export async function MensagemFlowEndereco(
  receivenumber: any,
  flowName: string,
  ctaText: string,
) {
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
              text: "Preencha o formulário abaixo para prosseguir com a mudança de endereço.",
            },
            action: {
              name: "flow",
              parameters: {
                flow_message_version: "3",
                flow_name: flowName,
                flow_cta: ctaText,
                flow_token: `sessao_${receivenumber}_${Date.now()}`,
                flow_action: "navigate",
                flow_action_payload: { screen: "MUDANCA_ENDERECO" },
                mode: "published",
              },
            },
          },
        },
        headers: authHeaders(),
      },
      defaultJobOptions,
    );

    console.log(`Flow '${flowName}' enviado para ${receivenumber}`);
  } catch (error: any) {
    console.error(
      "Erro ao enviar Flow de Mudança de Endereço:",
      error.message,
    );
  }
}

 export async function MensagemFlowMudancaComodo(
    receivenumber: any,
    flowName: string,
    ctaText: string,
  ) {
    try {
      const planoAviso =
        "⚠️ *Atenção*: Contratação sujeita à *análise técnica e consulta cadastral (CPF/CNPJ)*. Podendo influenciar na disponibilidade, valores da instalação (grátis ou paga), valor do plano e condições do serviço.\n\n✅ *A contratação será confirmada após a análise*. Se estiver de acordo, prossiga com o preenchimento do formulário abaixo👇🏻";

      // await this.MensagensComuns(receivenumber, planoAviso);

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
                text: "Preencha o formulário abaixo para prosseguir com a mudança de cômodo.",
              },
              action: {
                name: "flow",
                parameters: {
                  flow_message_version: "3",
                  flow_name: flowName,
                  flow_cta: ctaText,
                  flow_token: `sessao_${receivenumber}_${Date.now()}`,
                  flow_action: "navigate",
                  flow_action_payload: {
                    screen: "MUDANCA_COMODO",
                  },
                  mode: "published",
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
      console.error("Erro ao enviar Flow de Mudança de Cômodo:", error.message);
    }
  }

export async function MensagensDeMidia(
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
          document: { id: mediaID, filename: filename },
        },
        headers: authHeaders(),
      },
      { removeOnComplete: true, removeOnFail: false },
    );

    await saveOutgoingMessage("Arquivo Enviado");
  } catch (error: any) {
    console.error("Error queueing media message:", error.message);
  }
}

export async function Finalizar(msg: any, celular: any, keepSession = false) {
  try {
    await MensagensComuns(process.env.TEST_PHONE, msg);
    if (!keepSession) {
      if (sessions[celular] && sessions[celular].inactivityTimer) {
        clearTimeout(sessions[celular].inactivityTimer);
      }
      deleteSession(celular);
    }

    await saveOutgoingMessage(msg);
  } catch (error) {
    console.log("Error sending message:", error);
  }
}
