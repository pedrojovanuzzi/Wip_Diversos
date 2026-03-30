import { verificaType } from "../utils/validation";
import { validarCPF } from "../utils/validation";
import { findOrCreate } from "../utils/helpers";
import { writeLog } from "../utils/logging";
import { sendServiceEmail } from "../services/email.service";
import {
  sessions,
  deleteSession,
  getActiveSessionsCount,
  conversation,
  setConversation,
} from "../services/session.service";
import {
  MensagensComuns,
  MensagemBotao,
  MensagemLista,
  MensagemFlow,
  boasVindas,
  PodeMePassarOCpf,
  Finalizar,
} from "../services/messaging.service";
import { enviarBoleto } from "../services/payment.service";
import { getPlanosDoSistema } from "../services/plano.service";
import ApiMkDataSource from "../../../database/API_MK";
import MkauthDataSource from "../../../database/MkauthSource";
import { ClientesEntities as Sis_Cliente } from "../../../entities/ClientesEntities";
import PeopleConversation from "../../../entities/APIMK/People_Conversations";
import Conversations from "../../../entities/APIMK/Conversations";
import ConversationsUsers from "../../../entities/APIMK/Conversation_Users";
import Mensagens from "../../../entities/APIMK/Mensagens";

import {
  iniciarCadastro,
  handleAwaitingFlowCadastro,
  handlePlanSelection,
  handleVencDate,
  handleFinalRegister,
} from "./cadastro.handler";
import {
  iniciarMudancaComodo,
  iniciarWifiEstendido,
  iniciarMudancaTitularidade,
  iniciarTrocaPlano,
  iniciarRenovacao,
  handleChooseTypePayment,
  handleChooseTypeComodo,
  handleChooseTypeEndereco,
  handleTrocaTitularidade,
  handleTitularidadeConcordo,
  handleChooseTypeTitularidade,
  handleChooseEst,
  handleChooseWifiEst,
  handleWifiEstFinalize,
  handleChooseTypeTrocaPlano,
  handleSelectPlanTroca,
  handlePlanTrocaFinal,
  handleFinishTrocaPlan,
  handleChooseTypeRenovacao,
} from "./servicos.handler";
import { iniciarMudanca } from "./mudanca-endereco.handler";

export function resetInactivityTimer(celular: any, session: any) {
  if (session.inactivityTimer) {
    clearTimeout(session.inactivityTimer);
  }

  session.inactivityTimer = setTimeout(() => {
    MensagensComuns(
      celular,
      "🤷🏻 Seu atendimento foi *finalizado* devido à inatividade!!\nEntre em contato novamente 👍",
    );
    deleteSession(celular);
  }, 900000);
}

async function LGPD(celular: any) {
  const { MensagemTermos, MensagemBotao } = await import(
    "../services/messaging.service"
  );
  await MensagemTermos(
    celular,
    "Termos LGPD",
    "📄 Para dar *continuidade*, é preciso que leia e *aceite* os *Termos abaixo* para a segurança dos seus dados pessoais, de acordo com a *LGPD*.",
    "Ler Termos",
    "https://wipdiversos.wiptelecomunicacoes.com.br/doc/privacidade",
  );
  await MensagemTermos(
    celular,
    "Termos SCM",
    "📄 Leia também o contrato para provedores de serviços SCM, devidamente registrado em cartório.",
    "Ler Termos",
    "https://wipdiversos.wiptelecomunicacoes.com.br/doc/contrato",
  );
  await MensagemBotao(celular, "Aceita as informações?", "Sim Aceito", "Não");
}

export async function handleMessage(
  session: any,
  texto: any,
  celular: any,
  type: any,
  manutencao: any,
) {
  if (
    manutencao == true &&
    celular != process.env.TEST_PHONE &&
    celular != process.env.TEST_PHONE2
  ) {
    MensagensComuns(
      celular,
      "Olá, no momento nosso Bot está em Manutenção ⚙, tente novamente mais tarde!",
    );
    return;
  }

  resetInactivityTimer(celular, session);

  console.log(`[HANDLE_MESSAGE] Stage: ${session.stage}, Texto: ${texto}`);

  try {
    const [insertPeople] = await findOrCreate(
      ApiMkDataSource.getRepository(PeopleConversation),
      {
        where: { telefone: celular },
        defaults: { nome: celular, telefone: celular },
      },
    );

    const existingConvUser = await ApiMkDataSource.getRepository(
      ConversationsUsers,
    ).findOne({
      where: { user_id: insertPeople.id },
    });

    let insertConversation;
    if (existingConvUser) {
      insertConversation = await ApiMkDataSource.getRepository(
        Conversations,
      ).findOneBy({ id: existingConvUser.conv_id });
    } else {
      insertConversation = await ApiMkDataSource.getRepository(
        Conversations,
      ).save({ nome: celular });

      await ApiMkDataSource.getRepository(ConversationsUsers).save({
        conv_id: insertConversation.id,
        user_id: insertPeople.id,
      });
    }

    if (!insertConversation || !insertConversation.id) {
      throw new Error(
        "Conversa não pôde ser criada ou recuperada corretamente.",
      );
    }

    await findOrCreate(ApiMkDataSource.getRepository(ConversationsUsers), {
      where: { conv_id: insertConversation.id, user_id: 1 },
      defaults: { conv_id: insertConversation.id, user_id: 1 },
    });

    await findOrCreate(ApiMkDataSource.getRepository(ConversationsUsers), {
      where: { conv_id: insertConversation.id, user_id: insertPeople.id },
      defaults: { conv_id: insertConversation.id, user_id: insertPeople.id },
    });

    await ApiMkDataSource.getRepository(Mensagens).save({
      conv_id: insertConversation.id,
      sender_id: insertPeople.id,
      content: texto || "[sem conteúdo]",
      timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000),
    });

    setConversation({
      conv_id: insertConversation.id,
      sender_id: insertPeople.id,
      receiver_id: 1,
    });

    if (texto && texto.toLowerCase() === "resetar") {
      await MensagensComuns(
        celular,
        "Sessão resetada com sucesso! Você pode iniciar uma nova conversa agora.",
      );
      await deleteSession(celular);
      return;
    }
  } catch (error) {
    console.error("Erro ao inserir ou encontrar a pessoa:", error);
  }

  const msgRobo =
    "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, ";

  // Correção defensiva: se o stage ficou preso em "awaiting_service" mas o serviço já
  // foi selecionado (LGPD exibida), corrige o stage para "lgpd_request"
  if (
    session.stage === "awaiting_service" &&
    session.service &&
    verificaType(type) &&
    (texto.toLowerCase() === "sim aceito" ||
      texto.toLowerCase() === "não" ||
      texto.toLowerCase() === "nao")
  ) {
    session.stage = "lgpd_request";
  }

  switch (session.stage) {
    case "":
      await boasVindas(celular);
      await MensagemBotao(
        celular,
        "Escolha a Opção",
        "Boleto/Pix",
        "Serviços/Contratação",
        "Falar com Atendente",
      );
      session.stage = "options_start";
      break;

    case "options_start":
      if (verificaType(type)) {
        if (texto == "1" || texto == "Boleto/Pix") {
          await PodeMePassarOCpf(celular);
          session.stage = "awaiting_cpf";
        } else if (texto == "2" || texto == "Serviços/Contratação") {
          const campos = {
            sections: [
              {
                title: "Serviços",
                rows: [
                  { id: "option_1", title: "Instalação" },
                  { id: "option_2", title: "Mudança de Endereço" },
                  { id: "option_3", title: "Mudança de Cômodo" },
                  // { id: "option_4", title: "Troca de Titularidade" },
                  // { id: "option_5", title: "Alteração de Plano" },
                  // { id: "option_6", title: "Renovação Contratual" },
                  // { id: "option_7", title: "Wifi Estendido" },
                ],
              },
            ],
          };
          await MensagemLista(celular, "Escolha um Serviço", campos);
          await MensagensComuns(
            celular,
            "Caso deseje voltar a aba inicial, digite *inicio*",
          );
          session.stage = "awaiting_service";
        } else if (texto == "3" || texto == "Falar com Atendente") {
          if (
            session.mudancaStep === "select_address" &&
            session.structuredData?.length > 0
          ) {
            session.stage = "mudanca_endereco";
            await iniciarMudanca(celular, texto, session, type);
          } else {
            await MensagensComuns(
              celular,
              "Caso queira falar com um *Atendente*, acesse esse Link das 8 às 20h 👍🏻 https://wa.me/message/C3QNNVFXJWK5A1",
            );
            await MensagemBotao(celular, "Ainda Precisa de Ajuda?", "Sim", "Não");
            session.stage = "end_talk";
          }
        } else {
          await MensagensComuns(
            celular,
            msgRobo + "*selecione* uma opção válida!!",
          );
        }
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "*selecione* uma opção válida!!",
        );
      }
      break;

    case "awaiting_service":
      if (verificaType(type)) {
        const t = texto.toLowerCase();
        if (t === "instalaçao" || t === "instalação") {
          await LGPD(celular);
          session.stage = "lgpd_request";
          session.service = "instalacao";
        } else if (t === "mudança de endereço" || t === "mudanca de endereco") {
          await LGPD(celular);
          session.stage = "lgpd_request";
          session.service = "mudanca_endereco";
        } else if (t === "mudança de cômodo" || t === "mudanca de comodo") {
          await LGPD(celular);
          session.stage = "lgpd_request";
          session.service = "mudanca_comodo";
        } else if (t === "troca de titularidade") {
          await LGPD(celular);
          session.stage = "lgpd_request";
          session.service = "troca_titularidade";
        } else if (t === "alteração de plano") {
          await LGPD(celular);
          session.stage = "lgpd_request";
          session.service = "troca_plano";
        } else if (t === "wifi estendido") {
          await LGPD(celular);
          session.stage = "lgpd_request";
          session.service = "wifi_estendido";
        } else if (t === "inicio" || t === "inicío" || t === "início") {
          await boasVindas(celular);
          await MensagemBotao(
            celular,
            "Escolha a Opção",
            "Boleto/Pix",
            "Serviços/Contratação",
            "Falar com Atendente",
          );
          session.stage = "options_start";
        } else if (t === "renovação contratual") {
          await LGPD(celular);
          session.stage = "lgpd_request";
          session.service = "renovação_contratual";
        } else {
          await MensagensComuns(
            celular,
            "Opção Invalída, Selecione a Opção da Lista",
          );
        }
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "Selecione uma Opção da Lista",
        );
      }
      break;

    case "lgpd_request":
      if (verificaType(type)) {
        if (texto.toLowerCase() === "sim aceito") {
          if (session.service === "instalacao") {
            session.stage = "awaiting_flow_cadastro";
            const planosDoSistema = await getPlanosDoSistema();
            await MensagemFlow(celular, "Cadastro", "📋 Preencha seus dados", planosDoSistema);
          } else if (session.service === "mudanca_endereco") {
            session.stage = "mudanca_endereco";
            await iniciarMudanca(celular, texto, session, type);
          } else if (session.service === "mudanca_comodo") {
            session.stage = "mudanca_comodo";
            await iniciarMudancaComodo(celular, texto, session, type);
          } else if (session.service === "troca_titularidade") {
            session.stage = "troca_titularidade";
            await MensagemBotao(
              celular,
              "Você é o Titular do Cadastro?",
              "Sim",
              "Não",
            );
          } else if (session.service === "troca_plano") {
            session.stage = "troca_plano";
            await iniciarTrocaPlano(celular, texto, session, type);
          } else if (session.service === "renovação_contratual") {
            session.stage = "renovacao";
            await iniciarRenovacao(celular, texto, session, type);
          } else if (session.service === "wifi_estendido") {
            session.stage = "wifi_est";
            await iniciarWifiEstendido(celular, texto, session, type);
          }
        } else if (
          texto.toLowerCase() === "não" ||
          texto.toLowerCase() === "nao"
        ) {
          await MensagensComuns(
            celular,
            "🥹 *Infelizmente* não poderei mais dar \ncontinuidade ao seu atendimento, *respeitando* a sua vontade.\n🫡Estaremos sempre aqui a sua *disposição*!",
          );
          if (sessions[celular] && sessions[celular].inactivityTimer) {
            clearTimeout(sessions[celular].inactivityTimer);
          }
          deleteSession(celular);
        } else {
          await MensagensComuns(celular, "Aperte nos Botoes de Sim ou Não");
        }
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "Selecione uma Opção dos Botoes",
        );
      }
      break;

    case "choose_type_payment":
      try {
        if (verificaType(type)) {
          await handleChooseTypePayment(celular, texto, session);
        } else {
          await MensagensComuns(
            celular,
            msgRobo + "Selecione uma Opção da Lista",
          );
        }
      } catch (error) {
        console.log(error);
      }
      break;

    case "awaiting_flow_cadastro":
      await handleAwaitingFlowCadastro(celular, texto, session);
      break;

    case "plan":
      if (verificaType(type)) {
        await handlePlanSelection(celular, texto, session);
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "Selecione uma Opção da Lista",
        );
      }
      break;

    case "venc_date":
      if (verificaType(type)) {
        await handleVencDate(celular, texto, session);
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "Selecione uma Opção da Lista",
        );
      }
      break;

    case "final_register":
      try {
        if (verificaType(type)) {
          await handleFinalRegister(celular, texto, session);
        } else {
          await MensagensComuns(
            celular,
            msgRobo + "Selecione um Botão",
          );
        }
      } catch (error) {
        console.log(error);
      }
      break;

    case "mudanca_comodo":
      await iniciarMudancaComodo(celular, texto, session, type);
      break;

    case "choose_type_comodo":
      try {
        if (verificaType(type)) {
          await handleChooseTypeComodo(celular, texto, session);
        } else {
          await MensagensComuns(
            celular,
            msgRobo + "Selecione uma Opção da Lista",
          );
        }
      } catch (error) {
        console.log(error);
      }
      break;

    case "troca_titularidade":
      if (verificaType(type)) {
        await handleTrocaTitularidade(celular, texto, session);
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "Selecione uma Opção dos Botoes",
        );
      }
      break;

    case "handle_titularidade":
      if (verificaType(type)) {
        await handleTitularidadeConcordo(celular, texto, session, type);
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "Selecione uma Opção dos Botoes",
        );
      }
      break;

    case "wifi_est":
      await iniciarWifiEstendido(celular, texto, session, type);
      break;

    case "choose_est":
      if (verificaType(type)) {
        await handleChooseEst(celular, texto, session);
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "Selecione uma Opção dos Botoes",
        );
      }
      break;

    case "handle_titularidade_2":
      await iniciarMudancaTitularidade(celular, texto, session, type);
      break;

    case "choose_wifi_est":
      if (verificaType(type)) {
        await handleChooseWifiEst(celular, texto, session);
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "Selecione uma Opção dos Botoes",
        );
      }
      break;

    case "choose_type_titularidade":
      try {
        if (verificaType(type)) {
          await handleChooseTypeTitularidade(celular, session);
        } else {
          await MensagensComuns(
            celular,
            msgRobo + "Selecione uma Opção dos Botoes",
          );
        }
      } catch (error) {
        console.log(error);
      }
      break;

    case "choose_wifi_est_100":
      try {
        await handleWifiEstFinalize(celular, session, "Wifi Estendido 100 Megas");
      } catch (error) {
        console.log(error);
      }
      break;

    case "choose_wifi_est_1gbps":
      try {
        await handleWifiEstFinalize(celular, session, "Wifi Estendido 1 Gbps");
      } catch (error) {
        console.log(error);
      }
      break;

    case "troca_plano":
      await iniciarTrocaPlano(celular, texto, session, type);
      break;

    case "choose_type_troca_plano":
      if (verificaType(type)) {
        await handleChooseTypeTrocaPlano(celular, texto, session);
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "Selecione uma Opção dos Botoes",
        );
      }
      break;

    case "select_plan_troca":
      if (verificaType(type)) {
        await handleSelectPlanTroca(celular, texto, session);
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "Selecione uma Opção dos Botoes",
        );
      }
      break;

    case "plan_troca_final":
      if (verificaType(type)) {
        await handlePlanTrocaFinal(celular, texto, session);
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "Selecione uma Opção dos Botoes",
        );
      }
      break;

    case "finish_troca_plan":
      try {
        await handleFinishTrocaPlan(celular, session);
      } catch (error) {
        console.log(error);
      }
      break;

    case "mudanca_endereco":
    case "awaiting_mudanca_flow":
      if (verificaType(type)) {
        await iniciarMudanca(celular, texto, session, type);
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "Selecione uma Opção da Lista",
        );
      }
      break;

    case "choose_type_endereco":
      try {
        if (verificaType(type)) {
          await handleChooseTypeEndereco(celular, texto, session);
        } else {
          await MensagensComuns(
            celular,
            msgRobo + "Selecione uma Opção da Lista",
          );
        }
      } catch (error) {
        console.log(error);
      }
      break;

    case "renovacao":
      await iniciarRenovacao(celular, texto, session, type);
      break;

    case "choose_type_renovacao":
      try {
        if (verificaType(type)) {
          await handleChooseTypeRenovacao(celular, texto, session);
        } else {
          await MensagensComuns(
            celular,
            msgRobo + "Selecione uma Opção dos Botoes",
          );
        }
      } catch (error) {
        console.log(error);
      }
      break;

    case "awaiting_cpf":
      if (verificaType(type)) {
        if (
          texto.toLowerCase() === "inicio" ||
          texto.toLowerCase() === "início"
        ) {
          await boasVindas(celular);
          await MensagemBotao(
            celular,
            "Escolha um Botão",
            "Boleto/Pix",
            "Serviços/Contratação",
            "Falar com Atendente",
          );
          session.stage = "options_start";
        } else if (validarCPF(texto)) {
          const cpf = texto.replace(/[^\d]+/g, "");
          console.log("Consultar cadastro");
          session.cpf = cpf;

          const sis_cliente = await MkauthDataSource.getRepository(
            Sis_Cliente,
          ).find({
            select: {
              id: true,
              nome: true,
              endereco: true,
              login: true,
              numero: true,
            },
            where: { cpf_cnpj: cpf, cli_ativado: "s" },
          });

          if (sis_cliente.length > 1) {
            let currentIndex = 1;
            let structuredData = sis_cliente.map((client) => ({
              index: currentIndex++,
              id: Number(client.id),
              nome: client.nome,
              endereco: client.endereco,
              login: client.login,
              numero: client.numero,
              cpf: cpf,
            }));

            session.structuredData = structuredData;

            await MensagensComuns(celular, "🔍 Cadastros encontrados! ");
            let messageText =
              "🔍 Mais de um *Cadastro encontrado!* Digite o *Número* para qual deseja 👇🏻\n\n";
            structuredData.forEach((client) => {
              messageText += `*${client.index}* Nome: ${client.nome}, Endereço: ${client.endereco} N: ${client.numero}\n\n`;
            });
            messageText +=
              "👉🏻 Caso queira voltar ao Menu Inicial digite *início*";
            session.stage = "awaiting_selection";

            await MensagensComuns(celular, messageText);
          } else if (sis_cliente.length === 1) {
            session.stage = "end";
            await MensagensComuns(
              celular,
              `🔍 Cadastro encontrado! ${sis_cliente[0].login.toUpperCase()}`,
            );
            await enviarBoleto(
              sis_cliente[0].login,
              celular,
              sis_cliente[0].endereco,
              cpf,
            );
            await MensagensComuns(
              celular,
              "👉🏻 Digite *continuar* para terminar o atendimento",
            );
          } else {
            await MensagensComuns(
              celular,
              "🙁 Seu cadastro *não* foi *encontrado*, verifique se digitou corretamente o seu *CPF/CNPJ*",
            );
            session.stage = "awaiting_cpf";
          }
        } else {
          console.log(
            "CPF/CNPJ inválido. Por favor, verifique e tente novamente.",
          );
          session.stage = "awaiting_cpf";
        }
        resetInactivityTimer(celular, session);
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "*Digite* seu *CPF/CNPJ*!!",
        );
      }
      break;

    case "awaiting_selection":
      if (verificaType(type)) {
        if (
          texto.toLowerCase() === "inicio" ||
          texto.toLowerCase() === "início"
        ) {
          await boasVindas(celular);
          await MensagemBotao(
            celular,
            "Escolha um Botão",
            "Boleto/Pix",
            "Serviços/Contratação",
            "Falar com Atendente",
          );
          session.stage = "options_start";
        } else {
          const selectedIndex = parseInt(texto, 10) - 1;
          const options = session.structuredData.length + 1;
          if (!isNaN(selectedIndex)) {
            if (selectedIndex < options) {
              const selectedClient = session.structuredData[selectedIndex];
              console.log(selectedClient);
              console.log(
                `Usuário selecionou o cliente com ID: ${selectedClient.id}`,
              );
              await enviarBoleto(
                selectedClient.login,
                celular,
                selectedClient.endereco,
                selectedClient.cpf,
              );

              await MensagensComuns(
                celular,
                "👇🏻👇🏻👇🏻👇🏻👇🏻👇🏻\n\n🙂Deseja voltar e retirar boleto referente a outro endereço?\n⬆️ Digite *voltar* ou *continuar*",
              );

              session.stage = "end";
            } else {
              console.log(
                "⚠️ Seleção *inválida*, por favor, tente novamente.",
              );
              await MensagensComuns(
                celular,
                "⚠️ Seleção *inválida*, por favor, tente novamente.",
              );
              session.stage = "awaiting_selection";
            }
          } else {
            console.log(
              "⚠️ Seleção *inválida*, por favor, tente novamente.",
            );
            await MensagensComuns(
              celular,
              "⚠️ Seleção *inválida*, por favor, tente novamente.",
            );
            session.stage = "awaiting_selection";
          }
          resetInactivityTimer(celular, session);
        }
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "*selecione* uma opção válida!!",
        );
      }
      break;

    case "end":
      if (verificaType(type)) {
        if (texto.toLowerCase() === "voltar" && session.structuredData) {
          session.stage = "awaiting_selection";
          let messageText =
            "🔍 Mais de um *Cadastro encontrado!* Digite o *Número* para qual deseja 👇🏻\n\n";
          session.structuredData.forEach((client: any) => {
            messageText += `*${client.index}* Nome: ${client.nome}, Endereço: ${client.endereco} N: ${client.numero}\n\n`;
          });
          messageText +=
            "👉🏻 Caso queira voltar ao Menu Inicial digite *início*";
          await MensagensComuns(celular, messageText);
        } else {
          if (!session.endHandled) {
            let messageText2 = "Ainda Precisa de Ajuda? 🤓\n\n";
            messageText2 += "*1* Sim \n\n";
            messageText2 += "*2* Não \n\n";
            await MensagensComuns(celular, messageText2);
            session.endHandled = true;
            session.stage = "end_talk";
          }
          resetInactivityTimer(celular, session);
        }
      } else {
        await MensagensComuns(
          celular,
          msgRobo + "*selecione* uma opção válida!!",
        );
      }
      break;

    case "end_talk":
      if (texto == "1" || texto.toLowerCase() === "sim") {
        await boasVindas(celular);
        await MensagemBotao(
          celular,
          "Escolha um Botão",
          "Boleto/Pix",
          "Serviços/Contratação",
          "Falar com Atendente",
        );
        session.stage = "options_start";
        session.endHandled = false;
      } else if (
        texto == "2" ||
        texto.toLowerCase() === "não" ||
        texto.toLowerCase() === "nao"
      ) {
        await MensagensComuns(
          celular,
          "*Wip Telecom*\n*Obrigado*, fiquei muito feliz de ter você por aqui! \nConte Sempre Comigo 😉",
        );
        if (sessions[celular] && sessions[celular].inactivityTimer) {
          clearTimeout(sessions[celular].inactivityTimer);
        }
        deleteSession(celular);
        console.log(
          "Clientes Utilizando o Bot no momento: " +
            getActiveSessionsCount(),
        );
      } else {
        await MensagensComuns(
          celular,
          "⚠️ Seleção *Inválida*, Verifique se Digitou o Número Corretamente!!!",
        );
      }
      break;

    case "finalizar":
      try {
        if (verificaType(type)) {
          if (texto.toLowerCase() === "finalizar") {
            await Finalizar(session.msgDadosFinais, celular);
          } else {
            await MensagensComuns(
              celular,
              "Opção Invalída, Clique no Botão",
            );
          }
        } else {
          await MensagensComuns(
            celular,
            msgRobo + "Clique no Botão",
          );
        }
      } catch (error) {
        console.log(error);
      }
      break;

    case "awaiting_payment_confirmation":
      if (
        verificaType(type) &&
        (texto.toLowerCase() === "inicio" || texto.toLowerCase() === "início")
      ) {
        await boasVindas(celular);
        await MensagemBotao(
          celular,
          "Escolha a Opção",
          "Boleto/Pix",
          "Serviços/Contratação",
          "Falar com Atendente",
        );
        session.stage = "options_start";
      }
      break;

    case "awaiting_signature_link":
      if (
        verificaType(type) &&
        (texto.toLowerCase() === "inicio" || texto.toLowerCase() === "início")
      ) {
        await boasVindas(celular);
        await MensagemBotao(
          celular,
          "Escolha a Opção",
          "Boleto/Pix",
          "Serviços/Contratação",
          "Falar com Atendente",
        );
        session.stage = "options_start";
      }
      break;

    case "awaiting_manual_review":
      if (
        verificaType(type) &&
        (texto.toLowerCase() === "inicio" || texto.toLowerCase() === "início")
      ) {
        await boasVindas(celular);
        await MensagemBotao(
          celular,
          "Escolha a Opção",
          "Boleto/Pix",
          "Serviços/Contratação",
          "Falar com Atendente",
        );
        session.stage = "options_start";
      }
      break;
  }

  console.log(`Nova sessão para ${celular}:`, session);
}
