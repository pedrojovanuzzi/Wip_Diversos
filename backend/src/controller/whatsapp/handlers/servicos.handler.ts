import { validarCPF, verificaType } from "../utils/validation";
import { writeMessageLog } from "../utils/logging";
import { sendServiceEmail } from "../services/email.service";
import { sessions, deleteSession } from "../services/session.service";
import {
  MensagensComuns,
  MensagemBotao,
  MensagemTermos,
  MensagemLista,
  MensagemFlowEndereco,
  Finalizar,
} from "../services/messaging.service";

// --- Coleta de dados genérica ---
interface Pergunta {
  campo: string;
  pergunta: string;
}

async function coletarDados(
  celular: any,
  texto: any,
  session: any,
  type: any,
  perguntas: Pergunta[],
  mensagemInicial: string,
  onComplete: () => Promise<void>,
) {
  if (type !== "text" && type !== "interactive" && type !== undefined) {
    await MensagensComuns(
      celular,
      "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Digite",
    );
    return;
  }

  if (!session.dadosCadastro || session.ultimaPergunta === null) {
    await MensagensComuns(celular, mensagemInicial);
    session.dadosCadastro = {};
    session.ultimaPergunta = perguntas[0].campo;
    await MensagensComuns(celular, perguntas[0].pergunta);
    return;
  }

  const ultimaPergunta = session.ultimaPergunta;
  if (ultimaPergunta) {
    if (ultimaPergunta === "cpf") {
      const cpfValido = validarCPF(texto);
      if (!cpfValido) {
        await MensagensComuns(
          celular,
          "❌ *CPF* inválido. Por favor, insira um *CPF* válido.",
        );
        return;
      }
    }

    session.dadosCadastro[ultimaPergunta] = texto;
    console.log(`Resposta para ${ultimaPergunta}:`, texto);
    console.log("Dados atualizados:", session.dadosCadastro);
  }

  const proximaPerguntaIndex =
    perguntas.findIndex((q) => q.campo === ultimaPergunta) + 1;

  if (proximaPerguntaIndex < perguntas.length) {
    const proximaPergunta = perguntas[proximaPerguntaIndex].pergunta;
    session.ultimaPergunta = perguntas[proximaPerguntaIndex].campo;
    console.log("Próxima pergunta:", proximaPergunta);
    await MensagensComuns(celular, proximaPergunta);
  } else {
    session.dadosCompleto = { ...session.dadosCadastro };
    session.dadosCadastro = null;
    session.ultimaPergunta = null;
    await onComplete();
  }
}

const perguntasBasicas: Pergunta[] = [
  { campo: "nome", pergunta: "➡️ Digite seu *nome completo*:" },
  { campo: "cpf", pergunta: "➡️ Digite seu *CPF/CNPJ*:" },
  { campo: "celular", pergunta: "➡️ Digite seu *Celular* com *DDD*:" },
];

const perguntasTitularidade: Pergunta[] = [
  { campo: "nome", pergunta: "➡️ Digite seu *nome completo*:" },
  { campo: "cpf", pergunta: "➡️ Digite seu *CPF/CNPJ:" },
  { campo: "celular", pergunta: "➡️ Digite seu *Celular* com *DDD*:" },
  {
    campo: "nome_novo_titular",
    pergunta: "➡️ Digite o *Nome Completo* do *Novo Titular*:",
  },
  {
    campo: "celular_novo_titular",
    pergunta: "➡️ Digite o *Celular do Novo Titular* com *DDD*:",
  },
];

// --- Mudança de Cômodo ---
export async function iniciarMudancaComodo(
  celular: any,
  texto: any,
  session: any,
  type: any,
) {
  await coletarDados(
    celular,
    texto,
    session,
    type,
    perguntasBasicas,
    "🔤 Agora vamos coletar todos os *Dados* para realizar a mudança de cômodo e agendar a visita",
    async () => {
      await MensagemTermos(
        celular,
        "Finalizando....",
        `*Em breve, enviaremos o link para assinatura dos demais documentos, para formalização do contrato.*\nEnquanto isso, leia o contrato de SCM, padrão entre o provedor e todos os clientes, devidamente registrado em cartório.`,
        "Ler o contrato",
        "https://wipdiversos.wiptelecomunicacoes.com.br/doc/contrato",
      );
      await MensagemTermos(
        celular,
        "Termos Mudança de Cômodo",
        "📄 Para dar *continuidade*, é preciso que *leia* o *Termo* abaixo e escolha a forma que deseja",
        "Ler Termos",
        "https://wipdiversos.wiptelecomunicacoes.com.br/doc/mudanca_comodo",
      );
      await MensagemBotao(
        celular,
        "📝 Este serviço pode ser realizado de 2 formas: *Grátis* renovação contratual 12 meses ou *Paga* consulte o valor.",
        "Grátis",
        "Paga",
      );
      session.stage = "choose_type_comodo";
    },
  );
}

// --- Wifi Estendido ---
export async function iniciarWifiEstendido(
  celular: any,
  texto: any,
  session: any,
  type: any,
) {
  await coletarDados(
    celular,
    texto,
    session,
    type,
    perguntasBasicas,
    "🔤 Pronto, agora vamos coletar todos os *Dados* para realizar o Wifi Estendido",
    async () => {
      await MensagemTermos(
        celular,
        "Finalizando....",
        `*Em breve, enviaremos o link para assinatura dos demais documentos, para formalização do contrato.*\nEnquanto isso, leia o contrato de SCM, padrão entre o provedor e todos os clientes, devidamente registrado em cartório.`,
        "Ler o contrato",
        "https://wipdiversos.wiptelecomunicacoes.com.br/doc/contrato",
      );
      await MensagemBotao(celular, "Escolha a Opção", "Sim Concordo", "Não");
      session.stage = "choose_est";
    },
  );
}

// --- Mudança de Titularidade ---
export async function iniciarMudancaTitularidade(
  celular: any,
  texto: any,
  session: any,
  type: any,
) {
  await coletarDados(
    celular,
    texto,
    session,
    type,
    perguntasTitularidade,
    "🔤 Agora vamos coletar todos os *Dados* para realizar a troca de titularidade",
    async () => {
      session.stage = "choose_type_titularidade";
      await MensagemBotao(
        celular,
        "Aperte Em *Continuar* para Concluir a Troca de *Titularidade*",
        "Continuar",
      );
    },
  );
}

// --- Troca de Plano ---
export async function iniciarTrocaPlano(
  celular: any,
  texto: any,
  session: any,
  type: any,
) {
  await coletarDados(
    celular,
    texto,
    session,
    type,
    perguntasBasicas,
    "🔤 Pronto, agora vamos coletar todos os *Dados* para realizar a Alteração de Plano",
    async () => {
      await MensagemTermos(
        celular,
        "Finalizando....",
        `*Em breve, enviaremos o link para assinatura dos demais documentos, para formalização do contrato.*\nEnquanto isso, leia o contrato de SCM, padrão entre o provedor e todos os clientes, devidamente registrado em cartório.`,
        "Ler o contrato",
        "https://wipdiversos.wiptelecomunicacoes.com.br/doc/contrato",
      );
      await MensagemTermos(
        celular,
        "Termos Alteração de Plano",
        "📄 Para dar *continuidade*, é preciso que *leia* o *Termo abaixo* e escolha a opção que deseja",
        "Ler Termos",
        "https://wipdiversos.wiptelecomunicacoes.com.br/doc/altera_plano",
      );
      await MensagemBotao(
        celular,
        "Escolha a Opção",
        "Sim Concordo",
        "Não",
      );
      session.stage = "choose_type_troca_plano";
    },
  );
}

// --- Renovação Contratual ---
export async function iniciarRenovacao(
  celular: any,
  texto: any,
  session: any,
  type: any,
) {
  await coletarDados(
    celular,
    texto,
    session,
    type,
    perguntasBasicas,
    "🔤 Pronto, agora vamos coletar todos os *Dados* para realizar a *Renovação Contratual*",
    async () => {
      await MensagemTermos(
        celular,
        "Finalizando....",
        `*Em breve, enviaremos o link para assinatura dos demais documentos, para formalização do contrato.*\nEnquanto isso, leia o contrato de SCM, padrão entre o provedor e todos os clientes, devidamente registrado em cartório.`,
        "Ler o contrato",
        "https://wipdiversos.wiptelecomunicacoes.com.br/doc/contrato",
      );
      await MensagemTermos(
        celular,
        "Termos Renovação Contratual",
        "📄 Para dar *continuidade*, é preciso que *leia* o *Termo abaixo* e escolha a opção que deseja",
        "Ler Termos",
        "https://wipdiversos.wiptelecomunicacoes.com.br/doc/renovacao",
      );
      await MensagemBotao(
        celular,
        "Escolha a Opção",
        "Sim Concordo",
        "Não",
      );
      session.stage = "choose_type_renovacao";
    },
  );
}

// --- Handlers de Stage auxiliares ---

export function logAndEmailFinalize(session: any) {
  writeMessageLog({
    messages: session.msgDadosFinais,
    timestamp: new Date().toISOString(),
  });
  sendServiceEmail(session.msgDadosFinais);
}

export async function handleChooseTypePayment(
  celular: any,
  texto: any,
  session: any,
) {
  if (texto === "Pix" || texto === "Dinheiro" || texto === "Cartão") {
    if (session.service === "mudanca_endereco") {
      session.formaPagamento = `Paga com ${texto}`;
      await MensagensComuns(
        celular,
        "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nAgora, por favor, preencha o formulário abaixo com os dados do seu *Novo Endereço*.",
      );
      await MensagemFlowEndereco(
        celular,
        "mudanca_endereco",
        "Preencher Formulário",
      );
      session.stage = "awaiting_mudanca_flow";
    } else if (session.service === "mudanca_comodo") {
      await MensagensComuns(
        celular,
        "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nUm de nossos *atendentes* entrará em contato para concluir a sua *mudança de cômodo*\n\n*Clique no Botão abaixo para finalizar*",
      );
      let dadosCliente = session.dadosCompleto
        ? JSON.stringify(session.dadosCompleto, null, 2)
        : "Dados não encontrados";
      session.msgDadosFinais = `*🧱 Mudança de Cômodo* \n\n*💰 Forma: Paga com ${texto}*\nDados do Cliente: ${dadosCliente}`;
      logAndEmailFinalize(session);
      await MensagemBotao(celular, "Concluir Solicitação", "Finalizar");
      session.stage = "finalizar";
    }
  } else {
    await MensagensComuns(celular, "Invalido, aperte em um Botão da lista");
  }
}

export async function handleChooseTypeComodo(
  celular: any,
  texto: any,
  session: any,
) {
  if (texto.toLowerCase() === "paga") {
    await MensagemBotao(
      celular,
      "Escolha Forma de Pagamento",
      "Pix",
      "Cartão",
      "Dinheiro",
    );
    session.stage = "choose_type_payment";
  } else if (
    texto.toLowerCase() === "grátis" ||
    texto.toLowerCase() === "gratis"
  ) {
    await MensagensComuns(
      celular,
      "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nUm de nossos *atendentes* entrará em contato para concluir a sua *mudança de cômodo* enviando o *link* com os *Termos de Adesão e Contrato de Permanência* a serem *assinados*\n\n*Clique no botão abaixo para finalizar*",
    );
    let dadosCliente = session.dadosCompleto
      ? JSON.stringify(session.dadosCompleto, null, 2)
      : "Dados não encontrados";
    session.msgDadosFinais = `*🧱 Mudança de Cômodo* \n\n*🆓 Forma: Gratis*\nDados do Cliente: ${dadosCliente}`;
    logAndEmailFinalize(session);
    await MensagemBotao(celular, "Concluir Solicitação", "Finalizar");
    session.stage = "finalizar";
  } else {
    await MensagensComuns(celular, "Opção Invalída, Selecione a Opção da Lista");
  }
}

export async function handleChooseTypeEndereco(
  celular: any,
  texto: any,
  session: any,
) {
  if (texto.toLowerCase() === "paga") {
    await MensagemBotao(
      celular,
      "Escolha Forma de Pagamento",
      "Pix",
      "Cartão",
      "Dinheiro",
    );
    session.stage = "choose_type_payment";
  } else if (
    texto.toLowerCase() === "grátis" ||
    texto.toLowerCase() === "gratis"
  ) {
    session.formaPagamento = "Grátis";
    await MensagensComuns(
      celular,
      "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nAgora, por favor, preencha o formulário abaixo com os dados do seu *Novo Endereço*.",
    );
    await MensagemFlowEndereco(
      celular,
      "mudanca_endereco",
      "Preencher Formulário",
    );
    session.stage = "awaiting_mudanca_flow";
  } else {
    await MensagensComuns(celular, "Opção Invalída, Selecione a Opção da Lista");
  }
}

export async function handleTrocaTitularidade(
  celular: any,
  texto: any,
  session: any,
) {
  if (texto.toLowerCase() === "sim") {
    await MensagemTermos(
      celular,
      "Finalizando....",
      `*Em breve, enviaremos o link para assinatura dos demais documentos, para formalização do contrato.*\nEnquanto isso, leia o contrato de SCM, padrão entre o provedor e todos os clientes, devidamente registrado em cartório.`,
      "Ler o contrato",
      "https://wipdiversos.wiptelecomunicacoes.com.br/doc/contrato",
    );
    await MensagemTermos(
      celular,
      "Termos Troca de Titularidade",
      "📄 Para dar *continuidade*, é preciso que *leia* o *Termo* abaixo e escolha a opção que deseja.",
      "Ler Termos",
      "https://wipdiversos.wiptelecomunicacoes.com.br/doc/troca_de_titularidade",
    );
    await MensagemBotao(celular, "Escolha a Opção", "Concordo", "Não Concordo");
    session.stage = "handle_titularidade";
  } else if (
    texto.toLowerCase() === "não" ||
    texto.toLowerCase() === "nao"
  ) {
    await MensagensComuns(
      celular,
      "🤷🏽 *Infelizmente* não podemos dar continuidade ao seu *atendimento* por não ser o *Titular do Cadastro!!!*",
    );
    clearTimeout(sessions[celular].inactivityTimer);
    delete sessions[celular];
  } else {
    await MensagensComuns(celular, "Aperte nos Botoes de Sim ou Não");
  }
}

export async function handleTitularidadeConcordo(
  celular: any,
  texto: any,
  session: any,
  type: any,
) {
  if (texto.toLowerCase() === "concordo") {
    await iniciarMudancaTitularidade(celular, texto, session, type);
    session.stage = "handle_titularidade_2";
  } else if (
    texto.toLowerCase() === "não concordo" ||
    texto.toLowerCase() === "nao concordo"
  ) {
    await MensagensComuns(
      celular,
      "🤷🏽 *Infelizmente* não podemos dar continuidade ao seu *atendimento* por não Aceitar os *Termos!!*",
    );
    clearTimeout(sessions[celular].inactivityTimer);
    delete sessions[celular];
  } else {
    await MensagensComuns(celular, "Aperte nos Botoes de Sim ou Não");
  }
}

export async function handleChooseTypeTitularidade(
  celular: any,
  session: any,
) {
  await MensagensComuns(
    celular,
    "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nUm de nossos *atendentes* entrará em contato para concluir a sua *Alteração de Titularidade* enviando o *link* para o cliente atual com o *Termo de Alteração de Titularidade* \n\ne ao Novo Cliente o *link* com os *Termos de Adesão, Alteração de Titularidade e Contrato de Permanência* a serem *assinados*.\n\n*Clique no Botão abaixo para finalizar*",
  );
  let dadosCliente = session.dadosCompleto
    ? JSON.stringify(session.dadosCompleto, null, 2)
    : "Dados não encontrados";
  session.msgDadosFinais = `*🎭 Troca de Titularidade*\n\nDados do Cliente: ${dadosCliente}`;
  logAndEmailFinalize(session);
  await MensagemBotao(celular, "Concluir Solicitação", "Finalizar");
  session.stage = "finalizar";
}

export async function handleChooseEst(
  celular: any,
  texto: any,
  session: any,
) {
  if (texto.toLowerCase() === "sim concordo") {
    await MensagensComuns(
      celular,
      "👍🏻 *Confirmação* para Instalação de *Wi-Fi Estendido*",
    );
    await MensagemBotao(
      celular,
      "Escolha a opção desejada:",
      "Wifi 100 Mbps",
      "Wifi 1000 Mbps",
    );
    session.stage = "choose_wifi_est";
  } else if (
    texto.toLowerCase() === "não" ||
    texto.toLowerCase() === "nao"
  ) {
    await MensagensComuns(
      celular,
      "🤷🏽 *Infelizmente* não podemos dar continuidade ao seu *atendimento* por não Aceitar os *Termos!!*",
    );
    clearTimeout(sessions[celular].inactivityTimer);
    delete sessions[celular];
  } else {
    await MensagensComuns(celular, "Aperte nos Botoes de Sim ou Não");
  }
}

export async function handleChooseWifiEst(
  celular: any,
  texto: any,
  session: any,
) {
  if (texto.toLowerCase() === "wifi 100 mbps") {
    await MensagensComuns(
      celular,
      "⚠️ *Atenção* \nCada plano possui *valor distinto*, previamente informado por telefone ao cliente, e devidamente descrito no *Termo de Adesão*, que deverá ser assinado digitalmente antes da realização da instalação.",
    );
    await MensagemBotao(celular, "Concluir Solicitação", "Concluir");
    session.stage = "choose_wifi_est_100";
  } else if (texto.toLowerCase() === "wifi 1000 mbps") {
    await MensagensComuns(
      celular,
      "⚠️ *Atenção* \nCada plano possui *valor distinto*, previamente informado por telefone ao cliente, e devidamente descrito no *Termo de Adesão*, que deverá ser assinado digitalmente antes da realização da instalação.",
    );
    await MensagemBotao(celular, "Concluir Solicitação", "Concluir");
    session.stage = "choose_wifi_est_1gbps";
  } else {
    await MensagensComuns(celular, "Aperte em uma das 2 opções");
  }
}

export async function handleWifiEstFinalize(
  celular: any,
  session: any,
  label: string,
) {
  await MensagensComuns(celular, "🫱🏻‍🫲🏼 Tudo certo!");
  await MensagensComuns(
    celular,
    "✅️ Receberá em breve o *Termo de Adesão* e *Contrato de Permanência*  para assinatura online. Após a *confirmação*, daremos continuidade com a instalação do *Wi-Fi Estendido*.",
  );
  let dadosCliente = session.dadosCompleto
    ? JSON.stringify(session.dadosCompleto, null, 2)
    : "Dados não encontrados";
  session.msgDadosFinais = `*🔌 ${label}* \nDados do Cliente: ${dadosCliente}`;
  logAndEmailFinalize(session);
  await MensagemBotao(celular, "Concluir Solicitação", "Finalizar");
  session.stage = "finalizar";
}

export async function handleChooseTypeTrocaPlano(
  celular: any,
  texto: any,
  session: any,
) {
  if (texto.toLowerCase() === "sim concordo") {
    await MensagemBotao(
      celular,
      "Escolha qual seu *Tipo* de *Tecnologia*: \n(Caso tenha dúvida, pergunte para nossos atendentes)",
      "Fibra",
      "Rádio",
    );
    session.stage = "select_plan_troca";
  } else if (
    texto.toLowerCase() === "nao" ||
    texto.toLowerCase() === "não"
  ) {
    await MensagensComuns(
      celular,
      "🤷🏽 *Infelizmente* não podemos dar continuidade ao seu *atendimento* por não Aceitar os *Termos!!*",
    );
    clearTimeout(sessions[celular].inactivityTimer);
    delete sessions[celular];
  } else {
    await MensagensComuns(celular, "Aperte nos Botoes de Sim ou Não");
  }
}

export async function handleSelectPlanTroca(
  celular: any,
  texto: any,
  session: any,
) {
  if (texto.toLowerCase() === "fibra") {
    await MensagemLista(celular, "Escolha seu Plano", {
      sections: [
        {
          title: "Fibra (Urbano)",
          rows: [
            { id: "option_1", title: "🟣 400 MEGA R$ 89,90" },
            { id: "option_2", title: "🟩 500 MEGA R$ 99,90" },
            { id: "option_3", title: "🔴 600 MEGA R$ 109,90" },
            { id: "option_4", title: "🟡 700 MEGA R$ 129,90" },
            { id: "option_5", title: "🟦 800 MEGA R$ 159,90" },
          ],
        },
        {
          title: "Fibra (Rural)",
          rows: [
            { id: "option_6", title: "🟤 340 MEGA R$ 159,90" },
            { id: "option_7", title: "🟠 500 MEGA R$ 199,90" },
          ],
        },
      ],
    });
    session.stage = "plan_troca_final";
  } else if (
    texto.toLowerCase() === "radio" ||
    texto.toLowerCase() === "rádio"
  ) {
    await MensagemLista(celular, "Escolha seu Plano", {
      sections: [
        {
          title: "Escolha seu Plano",
          rows: [
            { id: "option_8", title: "🟩 20 MEGA R$ 89,90" },
            { id: "option_9", title: "🟦 30 MEGA R$ 119,90" },
          ],
        },
      ],
    });
    session.stage = "plan_troca_final";
  } else {
    await MensagensComuns(celular, "Aperte nos Botoes de Fibra ou Rádio");
  }
}

const planosValidos = [
  "🟣 400 MEGA R$ 89,90",
  "🟩 500 MEGA R$ 99,90",
  "🔴 600 MEGA R$ 109,90",
  "🟡 700 MEGA R$ 129,90",
  "🟦 800 MEGA R$ 159,90",
  "🟤 340 MEGA R$ 159,90",
  "🟠 500 MEGA R$ 199,90",
  "🟩 20 MEGA R$ 89,90",
  "🟦 30 MEGA R$ 119,90",
];

export async function handlePlanTrocaFinal(
  celular: any,
  texto: any,
  session: any,
) {
  if (planosValidos.includes(texto)) {
    session.planoEscolhido = texto;
    session.stage = "finish_troca_plan";
    await MensagemBotao(
      celular,
      "Clique em *Concluir* para Terminar a *Alteração de Plano*",
      "Concluir",
    );
  } else {
    await MensagensComuns(celular, "Aperte nos Botoes da Lista");
  }
}

export async function handleFinishTrocaPlan(
  celular: any,
  session: any,
) {
  await MensagensComuns(
    celular,
    "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\n🔍 Um de nossos *atendentes* entrará em contato para concluir a sua *Alteração de plano* enviando o *link* com os *Termos de Alteração de Plano, Termo de Adesão e Contrato de Permanência* a serem *assinados*\n\nClique no botão abaixo para finalizar",
  );
  let dadosCliente = session.dadosCompleto
    ? JSON.stringify(session.dadosCompleto, null, 2)
    : "Dados não encontrados";
  session.msgDadosFinais = `*🔌 Alteração de Plano* \nPlano Escolhido: ${session.planoEscolhido}\nDados do Cliente: ${dadosCliente}`;
  logAndEmailFinalize(session);
  await MensagemBotao(celular, "Concluir Solicitação", "Finalizar");
  session.stage = "finalizar";
}

export async function handleChooseTypeRenovacao(
  celular: any,
  texto: any,
  session: any,
) {
  if (texto.toLowerCase() === "sim concordo") {
    await MensagensComuns(
      celular,
      "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\n🔍 Um de nossos *atendentes* entrará em contato para concluir a sua *Renovação* enviando o *link* com os *Termos de Adesão e Contrato de Permanência* a serem *assinados*\n\n Clique em finalizar abaixo para terminar a conversa",
    );
    let dadosCliente = session.dadosCompleto
      ? JSON.stringify(session.dadosCompleto, null, 2)
      : "Dados não encontrados";
    session.msgDadosFinais = `*🆕 Renovação Contratual* \nDados do Cliente: ${dadosCliente}`;
    logAndEmailFinalize(session);
    await MensagemBotao(celular, "Concluir Solicitação", "Finalizar");
    session.stage = "finalizar";
  } else if (
    texto.toLowerCase() === "nao" ||
    texto.toLowerCase() === "não"
  ) {
    await MensagensComuns(
      celular,
      "🤷🏽 *Infelizmente* não podemos dar continuidade ao seu *atendimento* por não Aceitar os *Termos!!*",
    );
    setTimeout(() => {
      clearTimeout(sessions[celular].inactivityTimer);
      delete sessions[celular];
    }, 5000);
  } else {
    await MensagensComuns(celular, "Aperte nos Botoes de Sim ou Não");
  }
}
