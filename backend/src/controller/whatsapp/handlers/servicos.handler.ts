import { validarCPF, verificaType } from "../utils/validation";
import { writeMessageLog } from "../utils/logging";
import { sendServiceEmail } from "../services/email.service";
import { sessions, deleteSession, saveSession } from "../services/session.service";
import ApiMkDataSource from "../../../database/API_MK";
import MkauthDataSource from "../../../database/MkauthSource";
import AppDataSource from "../../../database/DataSource";
import { ClientesEntities as Sis_Cliente } from "../../../entities/ClientesEntities";
import { Faturas as Record } from "../../../entities/Faturas";
import Sessions from "../../../entities/APIMK/Sessions";
import { SolicitacaoServico } from "../../../entities/SolicitacaoServico";
import Pix from "../../Pix";
import ZapSign from "../../ZapSign";
import moment from "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import {
  MensagensComuns,
  MensagemBotao,
  MensagemTermos,
  MensagemLista,
  MensagemFlowEndereco,
  MensagemFlowTrocaPlano,
  MensagemFlowTrocaTitularidadeContato,
  MensagemFlowTrocaTitularidadeContratacao,
  MensagemFlowMudancaComodo,
  enviarNotificacaoServico,
  Finalizar,
  boasVindas,
  whatsappOutgoingQueue,
} from "../services/messaging.service";
import { url as waUrl, token as waToken } from "../config";
import { getPlanosDoSistema } from "../services/plano.service";
import { criarChamadoMkauth } from "../services/chamado.service";

const FLOW_TROCA_TITULARIDADE_CONTATO =
  process.env.WA_FLOW_TROCA_TITULARIDADE_CONTATO ||
  process.env.WA_FLOW_TROCA_TITULARIDADE_CONTATO_ID ||
  "TROCA_TITULARIDADE_CONTATO";

const FLOW_TROCA_TITULARIDADE_CONTRATACAO =
  process.env.WA_FLOW_TROCA_TITULARIDADE_CONTRATACAO ||
  process.env.WA_FLOW_TROCA_TITULARIDADE_CONTRATACAO_ID ||
  "TROCA_TITULARIDADE_CONTRATACAO";

// --- Coleta de dados genérica ---
interface Pergunta {
  campo: string;
  pergunta: string;
}

function normalizarCelularWhatsapp(celular: string): string {
  const somenteNumeros = (celular || "").replace(/\D/g, "");
  if (somenteNumeros.startsWith("55") && somenteNumeros.length >= 12) {
    return somenteNumeros;
  }
  if (somenteNumeros.length === 10 || somenteNumeros.length === 11) {
    return `55${somenteNumeros}`;
  }
  return somenteNumeros;
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


async function gerarLancamentoServicoMudancaComodo(session: any) {
  const valor = process.env.SERVIDOR_HOMOLOGACAO === "true" ? 1 : 200;
  const cpf = (session.cpf || "").trim();
  const loginSessao = session.login;

  let cliente: Sis_Cliente | null = null;
  const clientesRepository = MkauthDataSource.getRepository(Sis_Cliente);

  if (loginSessao) {
    cliente = await clientesRepository.findOne({
      where: { login: loginSessao, cli_ativado: "s" },
    });
  }

  if (!cliente && cpf) {
    cliente = await clientesRepository.findOne({
      where: { cpf_cnpj: cpf.replace(/\s/g, ""), cli_ativado: "s" },
    });
  }

  if (!cliente) {
    return null;
  }

  const faturasRepository = MkauthDataSource.getRepository(Record);
  return await faturasRepository.save({
    login: cliente.login,
    nome: cliente.nome || cliente.login,
    tipo: "servicos",
    valor: valor.toFixed(2),
    datavenc: new Date(),
    processamento: new Date(),
    status: "aberto",
    recibo: `SRV-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    obs: "Serviço: Mudança de Cômodo - Gerado automaticamente via WhatsApp Bot",
    valorger: "completo",
    aviso: "nao",
    imp: "nao",
    tipocob: "fat",
    cfop_lanc: "5307",
    referencia: moment().format("MM/YYYY"),
    uuid_lanc: uuidv4().slice(0, 16),
  });
}

async function salvarSolicitacaoMudancaComodo(
  session: any,
  dados: any,
  celularConversa: string,
) {
  const repo = AppDataSource.getRepository(SolicitacaoServico);
  const novaSolicitacao = new SolicitacaoServico();

  novaSolicitacao.servico = "Mudança de Cômodo";
  novaSolicitacao.login_cliente = session.login || "Desconhecido";
  novaSolicitacao.data_solicitacao = new Date();
  novaSolicitacao.assinado = false;
  novaSolicitacao.pago = false;
  novaSolicitacao.id_fatura = session.idFatura || null;
  novaSolicitacao.gratis =
    session.formaPagamento === "Grátis" ||
    session.formaPagamento === "Grátis (Fidelidade)"
      ? 1
      : 0;
  novaSolicitacao.dados = {
    ...dados,
    nome: session.nome || dados.nome || "Não informado",
    cpf: session.cpf || dados.cpf || "Não informado",
    email: session.email || dados.email || "financeiro@wiptelecom.com.br",
    telefone: session.celularCliente || celularConversa,
    telefone_conversa: celularConversa,
    login: session.login || "Não informado",
    endereco: session.endereco_comodo || "Não informado",
    rg: session.rg || "Não informado",
    forma_pagamento: session.formaPagamento || "Não informada",
    valor: session.formaPagamento === "Paga com Pix" ? "200.00" : "0.00",
  };

  return await repo.save(novaSolicitacao);
}

async function salvarSolicitacaoAlteracaoPlano(
  session: any,
  celularConversa: string,
) {
  const repo = AppDataSource.getRepository(SolicitacaoServico);
  const novaSolicitacao = new SolicitacaoServico();

  novaSolicitacao.servico = "Alteração de Plano";
  novaSolicitacao.login_cliente = session.login || "Desconhecido";
  novaSolicitacao.data_solicitacao = new Date();
  novaSolicitacao.assinado = false;
  novaSolicitacao.pago = true;
  novaSolicitacao.gratis = 1;
  novaSolicitacao.dados = {
    nome: session.nome || "Não informado",
    cpf: session.cpf || "Não informado",
    email: session.email || "financeiro@wiptelecom.com.br",
    telefone: session.celularCliente || celularConversa,
    telefone_conversa: celularConversa,
    login: session.login || "Não informado",
    endereco: session.endereco_troca_plano || "Não informado",
    rg: session.rg || "Não informado",
    plano: session.planoEscolhido || "Não informado",
    observacao: session.observacaoTrocaPlano || "",
    valor: "0.00",
  };

  return await repo.save(novaSolicitacao);
}

// --- Mudança de Cômodo ---
export async function iniciarMudancaComodo(
  celular: any,
  texto: any,
  session: any,
  type: any,
) {
  if (type !== "text" && type !== "interactive" && type !== undefined) {
    await MensagensComuns(
      celular,
      "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Digite",
    );
    return;
  }

  if (!session.mudancaComodoStep) {
    session.mudancaComodoStep = "ask_cpf";
    await MensagensComuns(
      celular,
      "Para iniciar a mudança de cômodo, por favor digite o seu *CPF/CNPJ*:",
    );
    session.stage = "mudanca_comodo";
    return;
  }

  if (session.mudancaComodoStep === "ask_cpf") {
    const cpf = texto.replace(/[^\d]+/g, "");
    const cpfValido = validarCPF(texto);

    if (!cpfValido && cpf.length !== 14 && cpf.length !== 11) {
      await MensagensComuns(
        celular,
        "❌ *CPF/CNPJ* inválido. Por favor, verifique e digite novamente.",
      );
      return;
    }

    session.cpf = cpf;
    const sis_cliente = await MkauthDataSource.getRepository(Sis_Cliente).find({
      select: {
        id: true,
        nome: true,
        endereco: true,
        login: true,
        numero: true,
        email: true,
        rg: true,
        cpf_cnpj: true,
        celular: true,
      },
      where: { cpf_cnpj: cpf, cli_ativado: "s" },
    });

    if (sis_cliente.length > 1) {
      let currentIndex = 1;
      const structuredData = sis_cliente.map((client) => ({
        index: currentIndex++,
        id: Number(client.id),
        nome: client.nome,
        endereco: client.endereco,
        login: client.login,
        numero: client.numero,
        cpf,
        email: client.email,
        rg: client.rg,
        celular: client.celular,
      }));

      session.structuredDataComodo = structuredData;
      session.mudancaComodoStep = "select_address";

      let messageText =
        "🔍 Encontramos mais de um *Cadastro!* Digite o *Número* para o qual deseja realizar a Mudança de Cômodo 👇🏻\n\n";
      structuredData.forEach((client) => {
        messageText += `*${client.index}* Nome: ${client.nome}, Endereço: ${client.endereco} N: ${client.numero}\n\n`;
      });
      messageText += "👉🏻 Caso queira cancelar digite *início*";

      await MensagensComuns(celular, messageText);
      return;
    }

    if (sis_cliente.length === 1) {
      session.login = sis_cliente[0].login;
      session.nome = sis_cliente[0].nome;
      session.email = sis_cliente[0].email;
      session.rg = sis_cliente[0].rg;
      session.endereco_comodo = `${sis_cliente[0].endereco}, ${sis_cliente[0].numero}`;
      session.celularCliente = sis_cliente[0].celular;
      session.dadosCompleto = {};

      await MensagemTermos(
        celular,
        "Termos Mudança de Cômodo",
        "📄 Para dar *continuidade*, é preciso que *leia* o *Termo* abaixo e escolha como deseja seguir com a solicitação.",
        "Ler Termos",
        "https://wipdiversos.wiptelecomunicacoes.com.br/doc/mudanca_comodo",
      );
      await MensagemBotao(
        celular,
        "📝 Este serviço pode ser realizado de 2 formas: *Grátis* renovação contratual 12 meses ou *Paga* via Pix.",
        "Grátis",
        "Paga",
      );
      session.stage = "choose_type_comodo";
      return;
    }

    await MensagensComuns(
      celular,
      "🙁 Seu cadastro *não* foi *encontrado*, verifique se digitou corretamente o seu *CPF/CNPJ* ou digite *início* para voltar.",
    );
    return;
  }

  if (session.mudancaComodoStep === "select_address") {
    if (
      texto.toLowerCase() === "inicio" ||
      texto.toLowerCase() === "início"
    ) {
      session.mudancaComodoStep = undefined;
      session.structuredDataComodo = undefined;
      session.login = undefined;
      session.endereco_comodo = undefined;
      await boasVindas(celular);
      await MensagemBotao(
        celular,
        "Escolha um Botão",
        "Boleto/Pix",
        "Serviços/Contratação",
        "Falar com Atendente",
      );
      session.stage = "options_start";
      return;
    }

    const selectedIndex = parseInt(texto, 10) - 1;

    if (
      !isNaN(selectedIndex) &&
      selectedIndex >= 0 &&
      selectedIndex < session.structuredDataComodo.length
    ) {
      const selectedClient = session.structuredDataComodo[selectedIndex];
      session.login = selectedClient.login;
      session.nome = selectedClient.nome;
      session.email = selectedClient.email;
      session.rg = selectedClient.rg;
      session.endereco_comodo = `${selectedClient.endereco}, ${selectedClient.numero}`;
      session.celularCliente = selectedClient.celular;
      session.dadosCompleto = {};

      await MensagemTermos(
        celular,
        "Termos Mudança de Cômodo",
        "📄 Para dar *continuidade*, é preciso que *leia* o *Termo* abaixo e escolha como deseja seguir com a solicitação.",
        "Ler Termos",
        "https://wipdiversos.wiptelecomunicacoes.com.br/doc/mudanca_comodo",
      );
      await MensagemBotao(
        celular,
        "📝 Este serviço pode ser realizado de 2 formas: *Grátis* renovação contratual 12 meses ou *Paga* via Pix.",
        "Grátis",
        "Paga",
      );
      session.stage = "choose_type_comodo";
      return;
    }

    await MensagensComuns(
      celular,
      "⚠️ Opção *inválida*, por favor digite o número correto da opção desejada.",
    );
    return;
  }

  if (session.mudancaComodoStep === "flow") {
    try {
      const payload = JSON.parse(texto);
      if (payload.flow_token) {
        let dadosFlow = session.dadosCadastro;
        try {
          const dbSession = await ApiMkDataSource.getRepository(Sessions).findOne({
            where: { celular },
          });
          if (dbSession && dbSession.dados) {
            dadosFlow = dbSession.dados.dadosCadastro;
            session.dadosCadastro = dadosFlow;
          }
        } catch (e) {
          console.error("Erro ao recarregar sessão (Cômodo):", e);
        }

        if (!dadosFlow || Object.keys(dadosFlow).length === 0) {
          const observacao =
            payload.observacao || payload.nome || payload.descricao || "";
          dadosFlow = { observacao };
          session.dadosCadastro = dadosFlow;
        }

        const dadosSolicitacao = {
          nome: session.nome,
          cpf: session.cpf,
          login: session.login,
          email: session.email,
          rg: session.rg,
          endereco: session.endereco_comodo,
          celular: session.celularCliente,
          observacao: dadosFlow?.observacao || "Sem observação",
        };

        const resumoMudanca =
          `🧱 *Nova Solicitação de Mudança de Cômodo*\n\n` +
          `👤 *Nome:* ${dadosSolicitacao.nome}\n` +
          `📄 *CPF:* ${dadosSolicitacao.cpf}\n` +
          `📱 *Celular:* ${dadosSolicitacao.celular}\n` +
          `🔑 *Login Escolhido:* ${dadosSolicitacao.login}\n` +
          `📍 *Endereço:* ${dadosSolicitacao.endereco}\n` +
          `📝 *Observação:* ${dadosSolicitacao.observacao}\n` +
          `💰 *Forma de Pagamento:* ${session.formaPagamento || "Não informada"}`;

        const resumoEmailHtml =
          `<h3>Solicitação de Mudança de Cômodo</h3>` +
          `<p><b>Nome:</b> ${dadosSolicitacao.nome}</p>` +
          `<p><b>CPF:</b> ${dadosSolicitacao.cpf}</p>` +
          `<p><b>Celular:</b> ${dadosSolicitacao.celular}</p>` +
          `<p><b>Login Escolhido:</b> ${dadosSolicitacao.login}</p>` +
          `<p><b>Endereço:</b> ${dadosSolicitacao.endereco}</p>` +
          `<p><b>Observação:</b> ${dadosSolicitacao.observacao}</p>` +
          `<p><b>Forma de Pagamento:</b> ${session.formaPagamento || "Não informada"}</p>`;

        try {
          sendServiceEmail(resumoEmailHtml);
        } catch (e) {
          console.error("Erro ao enviar email de mudança de cômodo:", e);
        }

        let lancamento = null;
        if (session.formaPagamento === "Paga com Pix") {
          try {
            lancamento = await gerarLancamentoServicoMudancaComodo(session);
            if (lancamento) {
              session.idFatura = lancamento.id;
            }
          } catch (e) {
            console.error("Erro ao gerar lançamento da mudança de cômodo:", e);
          }
        }

        let solicitacaoSalva: SolicitacaoServico | null = null;
        try {
          solicitacaoSalva = await salvarSolicitacaoMudancaComodo(
            session,
            dadosSolicitacao,
            celular,
          );
        } catch (e) {
          console.error("Erro ao salvar solicitação de mudança de cômodo:", e);
        }

        try {
          await criarChamadoMkauth("MUDANCA DE COMODO", session, resumoMudanca, solicitacaoSalva);
        } catch (e) {
          console.error("[Chamado] Erro ao criar chamado de mudança de cômodo:", e);
        }

        await Finalizar(resumoMudanca, celular, true);

        if (session.formaPagamento === "Paga com Pix" && lancamento) {
          try {
            const pixController = new Pix();
            const pixData = await pixController.gerarPixServico({
              idLancamento: lancamento.id,
              valor: lancamento.valor,
              pppoe: lancamento.login,
              cpf: session.cpf || dadosSolicitacao.cpf,
            });

            await MensagensComuns(
              celular,
              "✅ Recebemos a sua solicitação!\nAgora, finalize o pagamento para que possamos enviar o link com Termo de Mudança de Cômodo para assinatura. Obrigado pela confiança!",
            );
            await MensagensComuns(
              celular,
              `✨ *Aqui está seu PIX para pagamento da Mudança de Cômodo:*\n\n💰 *Valor:* R$ ${lancamento.valor}\n\n🔗 *Link para QR Code:* ${pixData.link}`,
            );
          } catch (e) {
            console.error("Erro ao gerar PIX da mudança de cômodo:", e);
            await MensagensComuns(
              celular,
              "✅ Recebemos a sua solicitação!\nEntraremos em contato em breve para concluir o envio da cobrança e do Termo de Mudança de Cômodo. Obrigado pela confiança!",
            );
          }
          session.stage = "awaiting_payment_confirmation";
        } else {
          try {
            const payloadZap = {
              ...(solicitacaoSalva?.dados || dadosSolicitacao),
              valor: "0.00",
            };
            const zapResponse =
              await ZapSign.createContractMudancaComodo(payloadZap as any);
            const zapSignUrl = zapResponse.signers[0].sign_url;

            if (solicitacaoSalva) {
              solicitacaoSalva.token_zapsign = zapResponse.token;
              await AppDataSource.getRepository(SolicitacaoServico).save(
                solicitacaoSalva,
              );
            }

            await MensagensComuns(
              celular,
              "✅ Recebemos a sua solicitação!\nAqui está o link com Termo de Mudança de Cômodo para assinatura. Obrigado pela confiança!",
            );
            await MensagensComuns(
              celular,
              `📄 *Aqui está o seu Link de Assinatura:* ${zapSignUrl}\n\nPor favor, *Assine* para formalizarmos o serviço! 🚀`,
            );
            session.stage = "awaiting_signature_link";
          } catch (e) {
            console.error(
              "Erro ao gerar link de assinatura da mudança de cômodo grátis:",
              e,
            );
            await MensagensComuns(
              celular,
              "✅ Recebemos a sua solicitação!\nEntraremos em contato em breve para enviar o link com Termo de Mudança de Cômodo. Obrigado pela confiança!",
            );
            session.stage = "awaiting_signature_link";
          }
        }

        session.mudancaComodoStep = null;
        session.dadosCadastro = null;
        return;
      }
    } catch (e) {
      await MensagensComuns(
        celular,
        "📋 Por favor, preencha o *formulário* acima para continuar.",
      );
    }
  }
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

// --- Troca de Titularidade ---
async function selecionarCadastroTitularidade(celular: any, session: any, cliente: any) {
  session.login = cliente.login;
  session.nome = cliente.nome;
  session.email = cliente.email;
  session.rg = cliente.rg;
  session.celularCliente = cliente.celular;
  session.dadosCompleto = {
    nome: cliente.nome,
    cpf: session.cpf,
    email: cliente.email,
    rg: cliente.rg,
    celular: cliente.celular,
    login: cliente.login,
    endereco: `${cliente.endereco}, ${cliente.numero}`,
  };
  await MensagemTermos(
    celular,
    "Termos Troca de Titularidade",
    "📄 Para dar *continuidade*, leia o *Termo de Troca de Titularidade* abaixo e em seguida informe os dados de contato da pessoa que receberá a titularidade.",
    "Ler Termos",
    "https://wipdiversos.wiptelecomunicacoes.com.br/doc/troca_de_titularidade",
  );
  await saveSession(celular);
  await MensagemFlowTrocaTitularidadeContato(
    celular,
    FLOW_TROCA_TITULARIDADE_CONTATO,
    "📱 Informar Contato",
  );
  session.stage = "awaiting_troca_titularidade_contato_flow";
}

export async function iniciarTrocaTitularidade(
  celular: any,
  texto: any,
  session: any,
  type: any,
) {
  if (type !== "text" && type !== "interactive" && type !== undefined) {
    await MensagensComuns(
      celular,
      "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Digite",
    );
    return;
  }

  if (!session.trocaTitularidadeStep) {
    session.trocaTitularidadeStep = "ask_cpf";
    await MensagensComuns(
      celular,
      "Para iniciar a troca de titularidade, por favor digite o seu *CPF/CNPJ* (do titular atual):",
    );
    session.stage = "troca_titularidade";
    return;
  }

  if (session.trocaTitularidadeStep === "ask_cpf") {
    const cpf = texto.replace(/[^\d]+/g, "");
    const cpfValido = validarCPF(texto);

    if (!cpfValido && cpf.length !== 14 && cpf.length !== 11) {
      await MensagensComuns(
        celular,
        "❌ *CPF/CNPJ* inválido. Por favor, verifique e digite novamente.",
      );
      return;
    }

    session.cpf = cpf;
    const sis_cliente = await MkauthDataSource.getRepository(Sis_Cliente).find({
      select: {
        id: true,
        nome: true,
        endereco: true,
        login: true,
        numero: true,
        email: true,
        rg: true,
        cpf_cnpj: true,
        celular: true,
      },
      where: { cpf_cnpj: cpf, cli_ativado: "s" },
    });

    if (sis_cliente.length > 1) {
      let currentIndex = 1;
      const structuredData = sis_cliente.map((client) => ({
        index: currentIndex++,
        id: Number(client.id),
        nome: client.nome,
        endereco: client.endereco,
        login: client.login,
        numero: client.numero,
        cpf,
        email: client.email,
        rg: client.rg,
        celular: client.celular,
      }));

      session.structuredDataTitularidade = structuredData;
      session.trocaTitularidadeStep = "select_cadastro";

      let messageText =
        "🔍 Encontramos mais de um *Cadastro!* Digite o *Número* para o qual deseja realizar a Troca de Titularidade 👇🏻\n\n";
      structuredData.forEach((client) => {
        messageText += `*${client.index}* Nome: ${client.nome}, Endereço: ${client.endereco} N: ${client.numero}\n\n`;
      });
      messageText += "👉🏻 Caso queira cancelar digite *início*";

      await MensagensComuns(celular, messageText);
      return;
    }

    if (sis_cliente.length === 1) {
      await selecionarCadastroTitularidade(celular, session, sis_cliente[0]);
      return;
    }

    await MensagensComuns(
      celular,
      "🙁 Seu cadastro *não* foi *encontrado*, verifique se digitou corretamente o seu *CPF/CNPJ* ou digite *início* para voltar.",
    );
    return;
  }

  if (session.trocaTitularidadeStep === "select_cadastro") {
    if (
      texto.toLowerCase() === "inicio" ||
      texto.toLowerCase() === "início"
    ) {
      session.trocaTitularidadeStep = undefined;
      session.structuredDataTitularidade = undefined;
      await boasVindas(celular);
      await MensagemBotao(
        celular,
        "Escolha um Botão",
        "Boleto/Pix",
        "Serviços/Contratação",
        "Falar com Atendente",
      );
      session.stage = "options_start";
      return;
    }

    const selectedIndex = parseInt(texto, 10) - 1;

    if (
      !isNaN(selectedIndex) &&
      selectedIndex >= 0 &&
      selectedIndex < session.structuredDataTitularidade.length
    ) {
      const selectedClient = session.structuredDataTitularidade[selectedIndex];
      await selecionarCadastroTitularidade(celular, session, selectedClient);
      return;
    }

    await MensagensComuns(
      celular,
      "⚠️ Opção *inválida*, por favor digite o número correto da opção desejada.",
    );
  }
}

// --- Troca de Plano ---
export async function iniciarTrocaPlano(
  celular: any,
  texto: any,
  session: any,
  type: any,
) {
  if (type !== "text" && type !== "interactive" && type !== undefined) {
    await MensagensComuns(
      celular,
      "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Digite",
    );
    return;
  }

  if (!session.trocaPlanoStep) {
    session.trocaPlanoStep = "ask_cpf";
    await MensagensComuns(
      celular,
      "Para iniciar a alteração de plano, por favor digite o seu *CPF/CNPJ*:",
    );
    session.stage = "troca_plano";
    return;
  }

  if (session.trocaPlanoStep === "ask_cpf") {
    const cpf = texto.replace(/[^\d]+/g, "");
    const cpfValido = validarCPF(texto);

    if (!cpfValido && cpf.length !== 14 && cpf.length !== 11) {
      await MensagensComuns(
        celular,
        "❌ *CPF/CNPJ* inválido. Por favor, verifique e digite novamente.",
      );
      return;
    }

    session.cpf = cpf;
    const sis_cliente = await MkauthDataSource.getRepository(Sis_Cliente).find({
      select: {
        id: true,
        nome: true,
        endereco: true,
        login: true,
        numero: true,
        email: true,
        rg: true,
        cpf_cnpj: true,
        celular: true,
      },
      where: { cpf_cnpj: cpf, cli_ativado: "s" },
    });

    if (sis_cliente.length > 1) {
      let currentIndex = 1;
      const structuredData = sis_cliente.map((client) => ({
        index: currentIndex++,
        id: Number(client.id),
        nome: client.nome,
        endereco: client.endereco,
        login: client.login,
        numero: client.numero,
        cpf,
        email: client.email,
        rg: client.rg,
        celular: client.celular,
      }));

      session.structuredDataTrocaPlano = structuredData;
      session.trocaPlanoStep = "select_address";

      let messageText =
        "🔍 Encontramos mais de um *Cadastro!* Digite o *Número* para o qual deseja realizar a Alteração de Plano 👇🏻\n\n";
      structuredData.forEach((client) => {
        messageText += `*${client.index}* Nome: ${client.nome}, Endereço: ${client.endereco} N: ${client.numero}\n\n`;
      });
      messageText += "👉🏻 Caso queira cancelar digite *início*";

      await MensagensComuns(celular, messageText);
      return;
    }

    if (sis_cliente.length === 1) {
      session.login = sis_cliente[0].login;
      session.nome = sis_cliente[0].nome;
      session.email = sis_cliente[0].email;
      session.rg = sis_cliente[0].rg;
      session.endereco_troca_plano = `${sis_cliente[0].endereco}, ${sis_cliente[0].numero}`;
      session.celularCliente = sis_cliente[0].celular;
      session.dadosCompleto = {
        nome: sis_cliente[0].nome,
        cpf,
        email: sis_cliente[0].email,
        rg: sis_cliente[0].rg,
        celular: sis_cliente[0].celular,
        login: sis_cliente[0].login,
        endereco: `${sis_cliente[0].endereco}, ${sis_cliente[0].numero}`,
      };

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
      return;
    }

    await MensagensComuns(
      celular,
      "🙁 Seu cadastro *não* foi *encontrado*, verifique se digitou corretamente o seu *CPF/CNPJ* ou digite *início* para voltar.",
    );
    return;
  }

  if (session.trocaPlanoStep === "select_address") {
    if (
      texto.toLowerCase() === "inicio" ||
      texto.toLowerCase() === "início"
    ) {
      session.trocaPlanoStep = undefined;
      session.structuredDataTrocaPlano = undefined;
      session.login = undefined;
      await boasVindas(celular);
      await MensagemBotao(
        celular,
        "Escolha um Botão",
        "Boleto/Pix",
        "Serviços/Contratação",
        "Falar com Atendente",
      );
      session.stage = "options_start";
      return;
    }

    const selectedIndex = parseInt(texto, 10) - 1;

    if (
      !isNaN(selectedIndex) &&
      selectedIndex >= 0 &&
      selectedIndex < session.structuredDataTrocaPlano.length
    ) {
      const selectedClient = session.structuredDataTrocaPlano[selectedIndex];
      session.login = selectedClient.login;
      session.nome = selectedClient.nome;
      session.email = selectedClient.email;
      session.rg = selectedClient.rg;
      session.endereco_troca_plano = `${selectedClient.endereco}, ${selectedClient.numero}`;
      session.celularCliente = selectedClient.celular;
      session.dadosCompleto = {
        nome: selectedClient.nome,
        cpf: session.cpf,
        email: selectedClient.email,
        rg: selectedClient.rg,
        celular: selectedClient.celular,
        login: selectedClient.login,
        endereco: `${selectedClient.endereco}, ${selectedClient.numero}`,
      };

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
      return;
    }

    await MensagensComuns(
      celular,
      "⚠️ Opção *inválida*, por favor digite o número correto da opção desejada.",
    );
  }
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
  if (texto === "Pix") {
    if (session.service === "mudanca_endereco") {
      if (texto !== "Pix") {
        await MensagensComuns(
          celular,
          "⚠️ No momento, a forma de pagamento disponível para mudança de endereço é *Pix*.",
        );
        return;
      }

      session.formaPagamento = "Paga com Pix";

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
      if (texto !== "Pix") {
        await MensagensComuns(
          celular,
          "⚠️ No momento, a forma de pagamento disponível para mudança de cômodo é *Pix*.",
        );
        return;
      }
      session.formaPagamento = "Paga com Pix";
      await MensagensComuns(
        celular,
        "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nAgora, por favor, preencha o formulário abaixo para concluir a sua *mudança de cômodo*.",
      );
      await MensagemFlowMudancaComodo(
        celular,
        "mudanca_comodo",
        "Preencher Formulário",
      );
      session.mudancaComodoStep = "flow";
      session.stage = "mudanca_comodo";
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
    );
    session.stage = "choose_type_payment";
  } else if (
    texto.toLowerCase() === "grátis" ||
    texto.toLowerCase() === "gratis"
  ) {
    session.formaPagamento = "Grátis (Fidelidade)";
    await MensagensComuns(
      celular,
      "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nAgora, por favor, preencha o formulário abaixo para concluir a sua *mudança de cômodo*.",
    );
    await MensagemFlowMudancaComodo(
      celular,
      "mudanca_comodo",
      "Preencher Formulário",
    );
    session.mudancaComodoStep = "flow";
    session.stage = "mudanca_comodo";
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
    );
    session.stage = "choose_type_payment";
  } else if (
    texto.toLowerCase() === "grátis" ||
    texto.toLowerCase() === "gratis"
  ) {
    session.formaPagamento = "Grátis (Fidelidade)";
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

export async function handleAwaitingTrocaTitularidadeContatoFlow(
  celular: any,
  texto: any,
  session: any,
) {
  try {
    const payload = JSON.parse(texto);
    console.log("[TrocaTitularidadeContato] payload recebido:", JSON.stringify(payload));

    const nome = (payload.nome || "").trim();
    const rawCelular = String(payload.celular_destino || payload.celular || "");
    const celularDestino = normalizarCelularWhatsapp(rawCelular);

    console.log("[TrocaTitularidadeContato] nome:", nome, "| celularDestino:", celularDestino);

    const partesNome = nome.split(/\s+/).filter(Boolean);
    if (partesNome.length < 2) {
      console.log("[TrocaTitularidadeContato] Falhou: nome com menos de 2 partes:", nome);
      await MensagensComuns(
        celular,
        "⚠️ Por favor, informe o *nome completo* (nome e sobrenome) do novo titular.",
      );
      await MensagemFlowTrocaTitularidadeContato(
        celular,
        FLOW_TROCA_TITULARIDADE_CONTATO,
        "📱 Preencher novamente",
      );
      return;
    }

    if (celularDestino.length < 12) {
      console.log("[TrocaTitularidadeContato] Falhou: celular inválido, length:", celularDestino.length);
      await MensagemFlowTrocaTitularidadeContato(
        celular,
        FLOW_TROCA_TITULARIDADE_CONTATO,
        "📱 Preencher novamente",
      );
      return;
    }

    session.dadosTitularidadeContato = {
      nome,
      celular_origem: celular,
      celular_destino: celularDestino,
    };

    // Dados do titular para usar depois na criação do documento
    const dadosTitular = {
      nome: session.dadosCompleto?.nome || session.nome || "Não informado",
      cpf: session.dadosCompleto?.cpf || session.cpf || "Não informado",
      email: session.dadosCompleto?.email || session.email || "financeiro@wiptelecom.com.br",
      telefone: session.dadosCompleto?.celular || session.celularCliente || celular,
      telefone_conversa: celular,
      endereco: session.dadosCompleto?.endereco || "Não informado",
      rg: session.dadosCompleto?.rg || session.rg || "Não informado",
      nome_novo_titular: nome,
      celular_novo_titular: celularDestino,
      celular_destino: celularDestino,
    };

    // Salva a solicitação sem token (doc será criado após o novo titular preencher os dados)
    const repo = AppDataSource.getRepository(SolicitacaoServico);
    const novaSolicitacao = new SolicitacaoServico();
    novaSolicitacao.servico = "Troca de Titularidade Titular";
    novaSolicitacao.login_cliente = session.login || session.dadosCompleto?.login || "Desconhecido";
    novaSolicitacao.data_solicitacao = new Date();
    novaSolicitacao.assinado = false;
    novaSolicitacao.pago = false;
    novaSolicitacao.gratis = 1;
    novaSolicitacao.token_zapsign = undefined;
    novaSolicitacao.dados = { ...dadosTitular };
    await repo.save(novaSolicitacao);

    // Configura sessão do novo titular com todos os dados do titular
    sessions[celularDestino] = {
      ...(sessions[celularDestino] || {}),
      stage: "awaiting_novo_titular_autorizacao",
      service: "troca_titularidade",
      celular_titular: celular,
      dados_titular: dadosTitular,
      solicitacao_id_titular: novaSolicitacao.id,
      dadosTitularidadeContato: {
        nome,
        celular_origem: celular,
        celular_destino: celularDestino,
      },
    };
    await saveSession(celularDestino);

    // Notifica o novo titular via template aceita_titularidade
    const phoneRaw = String(celularDestino).replace(/\D/g, "");
    const phoneTo = phoneRaw.startsWith("55") ? phoneRaw : "55" + phoneRaw;
    await whatsappOutgoingQueue.add(
      "send-template",
      {
        url: waUrl,
        payload: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phoneTo,
          type: "template",
          template: {
            name: "aceita_titularidade",
            language: { code: "pt_BR" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", parameter_name: "titular", text: nome },
                ],
              },
            ],
          },
        },
        headers: {
          Authorization: `Bearer ${waToken}`,
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

    await MensagensComuns(
      celular,
      `✅ Perfeito! Enviamos uma mensagem para *${nome}* solicitando autorização.\n\nAguarde a confirmação do novo titular para prosseguirmos. 🚀`,
    );
    session.stage = "awaiting_novo_titular_acceptance";
    return;
  } catch (error) {
    await MensagemFlowTrocaTitularidadeContato(
      celular,
      FLOW_TROCA_TITULARIDADE_CONTATO,
      "📱 Informar Contato",
    );
  }
}

export async function handleNovoTitularAutorizacao(
  celular: any,
  texto: any,
  session: any,
) {
  const celularTitular = session.celular_titular;
  const t = texto.toLowerCase();

  if (t === "sim") {
    const planosDoSistema = await getPlanosDoSistema();
    await MensagensComuns(
      celular,
      "✅ Ótimo! Por favor, preencha o formulário abaixo com os seus dados para gerarmos os documentos de assinatura.",
    );
    await MensagemFlowTrocaTitularidadeContratacao(
      celular,
      FLOW_TROCA_TITULARIDADE_CONTRATACAO,
      "📋 Preencher Dados",
      planosDoSistema,
    );
    await saveSession(celular);
    session.stage = "awaiting_troca_titularidade_contratacao_flow";

    if (celularTitular) {
      await MensagensComuns(
        celularTitular,
        "✅ O novo titular *autorizou* o recebimento dos links de assinatura! Estamos aguardando o preenchimento dos dados.",
      );
    }
  } else if (t === "não" || t === "nao") {
    await MensagensComuns(
      celular,
      "Certo, sua escolha foi registrada. O processo de troca de titularidade foi *cancelado*. Obrigado!",
    );

    if (celularTitular) {
      await MensagensComuns(
        celularTitular,
        `🚫 Infelizmente o *novo titular* (${session.dadosTitularidadeContato?.nome || "indicado"}) *não autorizou* o recebimento dos links de assinatura.\n\nO processo de Troca de Titularidade foi encerrado. Entre em contato conosco para mais informações.`,
      );
      if (sessions[celularTitular]) {
        clearTimeout(sessions[celularTitular].inactivityTimer);
        delete sessions[celularTitular];
      }
      await deleteSession(celularTitular);
    }

    if (sessions[celular]) {
      clearTimeout(sessions[celular].inactivityTimer);
      delete sessions[celular];
    }
    await deleteSession(celular);
  } else {
    await MensagensComuns(
      celular,
      "Por favor, responda *Sim* ou *Não* para continuar.",
    );
  }
}

export async function handleAwaitingTrocaTitularidadeContratacaoFlow(
  celular: any,
  texto: any,
  session: any,
) {
  try {
    const dadosFlow = JSON.parse(texto);
    if (!dadosFlow || !dadosFlow.nome) {
      await MensagensComuns(
        celular,
        "📋 Preencha o formulário de *troca de titularidade* para continuar.",
      );
      return;
    }

    session.dadosCompleto = {
      ...dadosFlow,
      contato_solicitacao: session.dadosTitularidadeContato || {},
    };

    try {
      const dadosTitular = session.dados_titular || {};
      const celularTitular = session.celular_titular || dadosTitular.telefone_conversa;

      // Cria o documento de Troca de Titularidade com dados de AMBOS
      const payloadZapTitularidade = {
        ...dadosTitular,
        nome_novo_titular: dadosFlow.nome,
        celular_novo_titular: String(dadosFlow.celular || celular),
        celular_destino: celular,
        cpf_novo_titular: String(dadosFlow.cpf || ""),
        rg_novo_titular: String(dadosFlow.rg || ""),
        email_novo_titular: dadosFlow.email || "",
        endereco_novo_titular: dadosFlow.rua || "",
        numero_novo_titular: String(dadosFlow.numero || ""),
        bairro_novo_titular: dadosFlow.bairro || "",
        celular2_novo_titular: String(dadosFlow.celularSecundario || ""),
        login_novo_titular: dadosFlow.login || "",
      };
      const zapTitularidade = await ZapSign.createContractTrocaTitularidadeTitular(payloadZapTitularidade as any);
      const urlTitularAssinatura = zapTitularidade.signers[0].sign_url;
      const urlNovoTitularTitularidade = zapTitularidade.second_signer?.sign_url || null;

      // Atualiza a SolicitacaoServico do titular com o token do documento criado
      const repo = AppDataSource.getRepository(SolicitacaoServico);
      if (session.solicitacao_id_titular) {
        const solicitacaoTitular = await repo.findOne({ where: { id: session.solicitacao_id_titular } });
        if (solicitacaoTitular) {
          solicitacaoTitular.token_zapsign = zapTitularidade.token;
          solicitacaoTitular.dados = {
            ...solicitacaoTitular.dados,
            nome_novo_titular: dadosFlow.nome,
            sign_url_novo_titular: urlNovoTitularTitularidade,
          };
          await repo.save(solicitacaoTitular);
        }
      }

      // Cria o Termo de Cadastro (Adesão) para o novo titular
      const payloadZapCadastro = {
        nome: dadosFlow.nome,
        cpf: dadosFlow.cpf || "Não informado",
        email: dadosFlow.email || "financeiro@wiptelecom.com.br",
        telefone: dadosFlow.celular || celular,
        telefone_conversa: celular,
        endereco: dadosFlow.rua || "",
        numero: dadosFlow.numero || "",
        complemento: dadosFlow.complemento || "",
        bairro: dadosFlow.bairro || "",
        cidade: dadosFlow.cidade || "",
        estado: dadosFlow.estado || "",
        cep: dadosFlow.cep || "",
        plano: dadosFlow.plano_escolhido || dadosFlow.plano || "A definir",
        valor: "0.00",
        vencimento: dadosFlow.vencimento || "5",
        rg: dadosFlow.rg || "Não informado",
      };
      const zapCadastro = await ZapSign.createContractInstalacao(payloadZapCadastro as any);
      const urlCadastro = zapCadastro.signers[0].sign_url;

      // Salva SolicitacaoServico do novo titular (Adesão)
      const novaSolicitacao = new SolicitacaoServico();
      novaSolicitacao.servico = "Troca de Titularidade Novo Titular";
      novaSolicitacao.login_cliente = dadosFlow.nome || "Novo Titular";
      novaSolicitacao.data_solicitacao = new Date();
      novaSolicitacao.assinado = false;
      novaSolicitacao.pago = false;
      novaSolicitacao.gratis = 1;
      novaSolicitacao.token_zapsign = zapCadastro.token;
      novaSolicitacao.dados = { ...dadosFlow, telefone_conversa: celular, solicitacao_id_titular: session.solicitacao_id_titular || null };
      await repo.save(novaSolicitacao);

      // Atualiza a solicitação do titular com o ID da solicitação do novo titular para link bidirecional
      if (session.solicitacao_id_titular && novaSolicitacao.id) {
        const solTitularLink = await repo.findOne({ where: { id: session.solicitacao_id_titular } });
        if (solTitularLink) {
          solTitularLink.dados = { ...solTitularLink.dados, solicitacao_id_novo_titular: novaSolicitacao.id };
          await repo.save(solTitularLink);
        }
      }

      const msgDados = `*🎭 Troca de Titularidade - Novo Titular*\n\nNovo Titular: ${dadosFlow.nome}\nCPF: ${dadosFlow.cpf}\nCelular: ${celular}`;
      logAndEmailFinalize({ msgDadosFinais: msgDados });
      try {
        await criarChamadoMkauth("TROCA DE TITULARIDADE", session, msgDados);
      } catch (e) {
        console.error("[Chamado] Erro ao criar chamado:", e);
      }

      // Envia link para o TITULAR assinar
      if (celularTitular) {
        await MensagensComuns(celularTitular, "✅ O novo titular preencheu os dados! Aqui está o seu link para assinar o *Termo de Troca de Titularidade*:");
        await MensagensComuns(celularTitular, `📄 *Termo de Troca de Titularidade:*\n${urlTitularAssinatura}`);
      }

      // Envia links para o NOVO TITULAR assinar ambos
      await MensagensComuns(celular, "✅ Perfeito! Aqui estão os links para assinatura dos documentos:");
      if (urlNovoTitularTitularidade) {
        await MensagensComuns(celular, `📄 *Termo de Troca de Titularidade:*\n${urlNovoTitularTitularidade}`);
      }
      await MensagensComuns(
        celular,
        `📄 *Termo de Cadastro (Adesão):*\n${urlCadastro}\n\nPor favor, assine *ambos* os documentos para formalizar a sua contratação! 🚀`,
      );
      session.stage = "awaiting_signature_link";
    } catch (zapError) {
      console.error("[ZapSign] Erro ao criar contratos para novo titular:", zapError);
      const msgDados = `*🎭 Troca de Titularidade - Novo Titular*\n\nDados: ${JSON.stringify(dadosFlow, null, 2)}`;
      logAndEmailFinalize({ msgDadosFinais: msgDados });
      try {
        await criarChamadoMkauth("TROCA DE TITULARIDADE", session, msgDados);
      } catch (e) {
        console.error("[Chamado] Erro ao criar chamado:", e);
      }
      await MensagensComuns(
        celular,
        "✅ Seus dados foram recebidos! Nossa equipe enviará os links de assinatura em breve. Obrigado pela confiança!",
      );
      session.stage = "awaiting_manual_review";
    }
    return;
  } catch (error) {
    await MensagensComuns(
      celular,
      "📋 Por favor, preencha o formulário de *troca de titularidade* para continuar.",
    );
  }
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
  try {
    await criarChamadoMkauth("WIFI ESTENDIDO", session, session.msgDadosFinais);
  } catch (e) {
    console.error("[Chamado] Erro ao criar chamado de wifi estendido:", e);
  }
  await MensagemBotao(celular, "Concluir Solicitação", "Finalizar");
  session.stage = "finalizar";
}

export async function handleChooseTypeTrocaPlano(
  celular: any,
  texto: any,
  session: any,
) {
  if (texto.toLowerCase() === "sim concordo") {
    const planosDoSistema = await getPlanosDoSistema();
    await MensagensComuns(
      celular,
      "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nAgora, escolha no formulário abaixo o novo plano desejado.",
    );
    await MensagemFlowTrocaPlano(
      celular,
      "alteracao_plano",
      "Escolher Plano",
      planosDoSistema,
    );
    session.stage = "awaiting_troca_plano_flow";
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

export async function handleAwaitingTrocaPlanoFlow(
  celular: any,
  texto: any,
  session: any,
) {
  try {
    const payload = JSON.parse(texto);
    const planoEscolhido = payload.plano || payload.plano_escolhido;

    if (!planoEscolhido) {
      await MensagensComuns(
        celular,
        "📋 Por favor, escolha um plano no formulário enviado acima para continuar.",
      );
      return;
    }

    session.planoEscolhido = planoEscolhido;
    session.observacaoTrocaPlano = payload.observacao || "";
    session.trocaPlanoStep = null;

    const resumoAlteracaoPlano =
      `📶 *Nova Solicitação de Alteração de Plano*\n\n` +
      `👤 *Nome:* ${session.nome || "Não informado"}\n` +
      `📄 *CPF:* ${session.cpf || "Não informado"}\n` +
      `📱 *Celular:* ${session.celularCliente || celular}\n` +
      `📧 *Email:* ${session.email || "Não informado"}\n` +
      `🔑 *Login:* ${session.login || "Não informado"}\n` +
      `📍 *Endereço:* ${session.endereco_troca_plano || "Não informado"}\n` +
      `🪪 *RG:* ${session.rg || "Não informado"}\n` +
      `🛜 *Plano Solicitado:* ${session.planoEscolhido}\n` +
      `📝 *Observação:* ${session.observacaoTrocaPlano || "Sem observação"}`;

    let solicitacaoSalva: SolicitacaoServico | null = null;
    try {
      solicitacaoSalva = await salvarSolicitacaoAlteracaoPlano(session, celular);
    } catch (error) {
      console.error("Erro ao salvar solicitação de alteração de plano:", error);
    }

    try {
      await criarChamadoMkauth("ALTERACAO DE PLANO", session, resumoAlteracaoPlano, solicitacaoSalva);
    } catch (e) {
      console.error("[Chamado] Erro ao criar chamado de alteração de plano:", e);
    }

    await Finalizar(resumoAlteracaoPlano, celular, true);
    if (process.env.TEST_PHONE) {
      await enviarNotificacaoServico(process.env.TEST_PHONE);
    }

    try {
      const payloadZap = {
        ...(solicitacaoSalva?.dados || {}),
        nome: session.nome || "Não informado",
        cpf: session.cpf || "Não informado",
        email: session.email || "financeiro@wiptelecom.com.br",
        telefone: session.celularCliente || celular,
        telefone_conversa: celular,
        endereco: session.endereco_troca_plano || "Não informado",
        rg: session.rg || "Não informado",
        plano: session.planoEscolhido,
        valor: "0.00",
      };

      const zapResponse =
        await ZapSign.createContractAlteracaoPlano(payloadZap as any);
      const zapSignUrl = zapResponse.signers[0].sign_url;

      if (solicitacaoSalva) {
        solicitacaoSalva.token_zapsign = zapResponse.token;
        await AppDataSource.getRepository(SolicitacaoServico).save(
          solicitacaoSalva,
        );
      }

      await MensagensComuns(
        celular,
        "✅ Recebemos a sua solicitação!\nAqui está o link com Termo de Alteração de Plano para assinatura. Obrigado pela confiança!",
      );
      await MensagensComuns(
        celular,
        `📄 *Aqui está o seu Link de Assinatura:* ${zapSignUrl}\n\nPor favor, *Assine* para formalizarmos o serviço! 🚀`,
      );
      session.stage = "awaiting_signature_link";
    } catch (error) {
      console.error(
        "Erro ao gerar link de assinatura da alteração de plano:",
        error,
      );
      await MensagensComuns(
        celular,
        "✅ Recebemos a sua solicitação!\nEntraremos em contato em breve para enviar o link com Termo de Alteração de Plano. Obrigado pela confiança!",
      );
      session.stage = "awaiting_signature_link";
    }
    return;
  } catch (error) {
    await MensagensComuns(
      celular,
      "📋 Por favor, preencha o formulário de alteração de plano clicando no botão enviado acima.",
    );
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
  try {
    await criarChamadoMkauth("ALTERACAO DE PLANO", session, session.msgDadosFinais);
  } catch (e) {
    console.error("[Chamado] Erro ao criar chamado de alteração de plano:", e);
  }
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
    try {
      await criarChamadoMkauth("RENOVACAO CONTRATUAL", session, session.msgDadosFinais);
    } catch (e) {
      console.error("[Chamado] Erro ao criar chamado de renovação contratual:", e);
    }
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
