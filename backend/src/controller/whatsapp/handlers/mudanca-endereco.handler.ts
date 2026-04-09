import ApiMkDataSource from "../../../database/API_MK";
import MkauthDataSource from "../../../database/MkauthSource";
import AppDataSource from "../../../database/DataSource";
import { ClientesEntities as Sis_Cliente } from "../../../entities/ClientesEntities";
import { Faturas as Record } from "../../../entities/Faturas";
import { SisPlano } from "../../../entities/SisPlano";
import Sessions from "../../../entities/APIMK/Sessions";
import { SolicitacaoServico } from "../../../entities/SolicitacaoServico";
import { validarCPF } from "../utils/validation";
import { sendServiceEmail } from "../services/email.service";
import { criarChamadoMkauth } from "../services/chamado.service";
import Pix from "../../Pix";
import ZapSign from "../../ZapSign";
import moment from "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import {
  MensagensComuns,
  MensagemBotao,
  MensagemTermos,
  MensagemFlowEndereco,
  Finalizar,
  boasVindas,
} from "../services/messaging.service";

async function gerarLancamentoServicoMudancaEndereco(session: any) {
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
    obs: "Serviço: Mudança de Endereço - Gerado automaticamente via WhatsApp Bot",
    valorger: "completo",
    aviso: "nao",
    imp: "nao",
    tipocob: "fat",
    cfop_lanc: "5307",
    referencia: moment().format("MM/YYYY"),
    uuid_lanc: uuidv4().slice(0, 16),
  });
}

async function salvarSolicitacaoMudancaEndereco(
  session: any,
  dadosFlow: any,
  celularConversa: string,
) {
  const repo = AppDataSource.getRepository(SolicitacaoServico);
  const novaSolicitacao = new SolicitacaoServico();

  novaSolicitacao.servico = "Mudança de Endereço";
  novaSolicitacao.login_cliente = session.login || dadosFlow.login || "Desconhecido";
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
    ...dadosFlow,
    login: session.login || dadosFlow.login,
    endereco_antigo: session.endereco_antigo || dadosFlow.endereco_antigo,
    // Endereço atual do cliente (para o documento)
    endereco: session.endereco_atual || "",
    numero: session.numero_atual || "",
    bairro: session.bairro_atual || "",
    cidade: session.cidade_atual || "",
    estado: session.estado_atual || "",
    cep: session.cep_atual || "",
    // Novo endereço (do flow) com prefixo novo_
    novo_rua: dadosFlow.rua || "",
    novo_numero: dadosFlow.numero || "",
    novo_bairro: dadosFlow.novo_bairro || "",
    novo_cidade: dadosFlow.cidade || "",
    novo_estado: dadosFlow.estado || "",
    novo_cep: dadosFlow.cep || "",
    forma_pagamento: session.formaPagamento || "Não informada",
    valor: session.formaPagamento === "Paga com Pix" ? "200.00" : "0.00",
    valor_plano: session.valor_plano_atual || "",
    plano: session.plano_mudanca || "",
    vencimento: session.vencimento_mudanca || "",
    termo: session.contrato_cliente || "",
    telefone_conversa: celularConversa || dadosFlow.celular || session.celular || null,
  };

  return await repo.save(novaSolicitacao);
}

export async function finalizarMudancaEndereco(
  celular: string,
  session: any,
) {
  console.log("Dados atualizados:", session.dadosCadastro);

  await MensagemTermos(
    celular,
    "Termos Mudança de Endereço",
    "📄 Para dar *continuidade*, é preciso que *leia* o *Termo* abaixo e escolha a forma que deseja",
    "Ler Termos",
    "https://wipdiversos.wiptelecomunicacoes.com.br/doc/mudanca_endereco",
  );
  await MensagemBotao(
    celular,
    "📝 Este serviço pode ser realizado de 2 formas: *Grátis* renovação contratual 12 meses ou *Paga* consulte o valor.",
    "Grátis",
    "Paga",
  );
  session.stage = "choose_type_endereco";

  session.dadosCompleto = { ...session.dadosCadastro };
  session.dadosCadastro = null;
  session.ultimaPergunta = null;
}

export async function iniciarMudanca(
  celular: any,
  texto: any,
  session: any,
  type: any,
) {
  console.log("Mudança Type: " + type);

  if (type !== "text" && type !== "interactive" && type !== undefined) {
    await MensagensComuns(
      celular,
      "*Desculpe* eu sou um Robô e não entendo áudios ou imagens 😞\n🙏🏻Por gentileza, Digite",
    );
    return;
  }

  if (!session.mudancaStep) {
    console.log("Iniciando mudança...");
    session.mudancaStep = "ask_cpf";
    await MensagensComuns(
      celular,
      "Para iniciar a mudança de endereço, por favor digite o seu *CPF/CNPJ*:",
    );
    session.stage = "mudanca_endereco";
    return;
  }

  if (session.mudancaStep === "ask_cpf") {
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
      select: { id: true, nome: true, endereco: true, login: true, numero: true, bairro: true, cidade: true, estado: true, cep: true, termo: true, plano: true, venc: true },
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
        bairro: client.bairro,
        cidade: client.cidade,
        estado: client.estado,
        cep: client.cep,
        termo: client.termo,
        plano: client.plano,
        venc: client.venc,
        cpf: cpf,
      }));

      session.structuredData = structuredData;
      session.mudancaStep = "select_address";

      let messageText =
        "🔍 Encontramos mais de um *Cadastro!* Digite o *Número* para o qual deseja realizar a Mudança de Endereço 👇🏻\n\n";
      structuredData.forEach((client) => {
        messageText += `*${client.index}* Nome: ${client.nome}, Endereço atual: ${client.endereco} N: ${client.numero}\n\n`;
      });
      messageText += "👉🏻 Caso queira cancelar digite *início*";

      await MensagensComuns(celular, messageText);
      return;
    } else if (sis_cliente.length === 1) {
      session.login = sis_cliente[0].login;
      session.endereco_antigo = `${sis_cliente[0].endereco}, ${sis_cliente[0].numero}`;
      session.endereco_atual = sis_cliente[0].endereco || "";
      session.numero_atual = sis_cliente[0].numero || "";
      session.bairro_atual = sis_cliente[0].bairro || "";
      session.cidade_atual = sis_cliente[0].cidade || "";
      session.estado_atual = sis_cliente[0].estado || "";
      session.cep_atual = sis_cliente[0].cep || "";
      session.contrato_cliente = sis_cliente[0].termo || "";
      session.plano_mudanca = sis_cliente[0].plano || "";
      session.vencimento_mudanca = sis_cliente[0].venc || "";
      if (sis_cliente[0].plano) {
        const planoRecord = await MkauthDataSource.getRepository(SisPlano).findOne({ where: { nome: sis_cliente[0].plano } });
        session.valor_plano_atual = planoRecord?.valor || "";
      } else {
        session.valor_plano_atual = "";
      }
      session.mudancaStep = "flow";
      session.dadosCadastro = {};
      await finalizarMudancaEndereco(celular, session);
      return;
    } else {
      await MensagensComuns(
        celular,
        "🙁 Seu cadastro *não* foi *encontrado*, verifique se digitou corretamente o seu *CPF/CNPJ* ou digite *início* para voltar.",
      );
      return;
    }
  }

  if (session.mudancaStep === "select_address") {
    if (
      texto.toLowerCase() === "inicio" ||
      texto.toLowerCase() === "início"
    ) {
      session.mudancaStep = undefined;
      session.structuredData = undefined;
      session.login = undefined;
      session.endereco_antigo = undefined;
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

    if (!session.structuredData || session.structuredData.length === 0) {
      session.mudancaStep = "ask_cpf";
      await MensagensComuns(
        celular,
        "⚠️ Sessão expirada. Para iniciar a mudança de endereço, por favor digite novamente o seu *CPF/CNPJ*:",
      );
      return;
    }

    const selectedIndex = parseInt(texto, 10) - 1;

    if (
      !isNaN(selectedIndex) &&
      selectedIndex >= 0 &&
      selectedIndex < session.structuredData.length
    ) {
      const selectedClient = session.structuredData[selectedIndex];
      session.login = selectedClient.login;
      session.endereco_antigo = `${selectedClient.endereco}, ${selectedClient.numero}`;
      session.endereco_atual = selectedClient.endereco || "";
      session.numero_atual = selectedClient.numero || "";
      session.bairro_atual = selectedClient.bairro || "";
      session.cidade_atual = selectedClient.cidade || "";
      session.estado_atual = selectedClient.estado || "";
      session.cep_atual = selectedClient.cep || "";
      session.contrato_cliente = selectedClient.termo || "";
      session.plano_mudanca = selectedClient.plano || "";
      session.vencimento_mudanca = selectedClient.venc || "";
      if (selectedClient.plano) {
        const planoRecord = await MkauthDataSource.getRepository(SisPlano).findOne({ where: { nome: selectedClient.plano } });
        session.valor_plano_atual = planoRecord?.valor || "";
      } else {
        session.valor_plano_atual = "";
      }
      session.mudancaStep = "flow";
      session.dadosCadastro = {};
      await finalizarMudancaEndereco(celular, session);
      return;
    } else {
      await MensagensComuns(
        celular,
        "⚠️ Opção *inválida*, por favor digite o número correto da opção desejada.",
      );
      return;
    }
  }

  if (session.stage === "awaiting_mudanca_flow") {
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
          console.error("Erro ao recarregar sessão:", e);
        }

        if (dadosFlow && Object.keys(dadosFlow).length > 0) {
          const formaPagto = session.formaPagamento || "Não informada";
          const resumoMudanca =
            `🔄 *Nova Solicitação de Mudança de Endereço*\n\n` +
            `👤 *Nome:* ${dadosFlow.nome}\n` +
            `📄 *CPF:* ${dadosFlow.cpf}\n` +
            `📱 *Celular:* ${dadosFlow.celular}\n` +
            `🔑 *Login Escolhido:* ${dadosFlow.login}\n` +
            `📍 *Antigo Endereço:* ${dadosFlow.endereco_antigo}\n` +
            `🆕 *Novo Endereço:* ${dadosFlow.rua}, ${dadosFlow.numero} - ${dadosFlow.novo_bairro}\n` +
            `📮 *CEP:* ${dadosFlow.cep}\n` +
            `💰 *Forma de Pagamento:* ${formaPagto}`;

          const resumoEmailHtml =
            `<h3>Solicitação de Mudança de Endereço</h3>` +
            `<p><b>Nome:</b> ${dadosFlow.nome}</p>` +
            `<p><b>CPF:</b> ${dadosFlow.cpf}</p>` +
            `<p><b>Celular:</b> ${dadosFlow.celular}</p>` +
            `<p><b>Login Escolhido:</b> ${dadosFlow.login}</p>` +
            `<p><b>Antigo Endereço:</b> ${dadosFlow.endereco_antigo}</p>` +
            `<p><b>Novo Endereço:</b> ${dadosFlow.rua}, ${dadosFlow.numero} - ${dadosFlow.novo_bairro}</p>` +
            `<p><b>CEP:</b> ${dadosFlow.cep}</p>` +
            `<p><b>Forma de Pagamento:</b> ${formaPagto}</p>`;

          try {
            sendServiceEmail(resumoEmailHtml);
          } catch (e) {
            console.error("Erro ao enviar email de mudança de endereço:", e);
          }

          let lancamento = null;
          if (formaPagto === "Paga com Pix") {
            try {
              lancamento = await gerarLancamentoServicoMudancaEndereco(session);
              if (lancamento) {
                session.idFatura = lancamento.id;
              }
            } catch (e) {
              console.error(
                "Erro ao gerar lançamento da mudança de endereço:",
                e,
              );
            }
          }

          let solicitacaoSalva: SolicitacaoServico | null = null;
          try {
            solicitacaoSalva = await salvarSolicitacaoMudancaEndereco(
              session,
              dadosFlow,
              celular,
            );
          } catch (e) {
            console.error("Erro ao salvar solicitação de mudança de endereço:", e);
          }

          try {
            await criarChamadoMkauth("MUDANCA DE ENDERECO", session, resumoMudanca, solicitacaoSalva);
          } catch (e) {
            console.error("[Chamado] Erro ao criar chamado de mudança de endereço:", e);
          }

          await Finalizar(resumoMudanca, celular, true);

          if (formaPagto === "Paga com Pix" && lancamento) {
            try {
              const pixController = new Pix();
              const pixData = await pixController.gerarPixServico({
                idLancamento: lancamento.id,
                valor: lancamento.valor,
                pppoe: lancamento.login,
                cpf: session.cpf || dadosFlow.cpf,
              });

              await MensagensComuns(
                celular,
                "✅ Recebemos a sua solicitação!\nAgora, finalize o pagamento para que possamos enviar o link com Termo de Alteração de Endereço para assinatura. Obrigado pela confiança!",
              );
              await MensagensComuns(
                celular,
                `✨ *Aqui está seu PIX para pagamento da Mudança de Endereço:*\n\n💰 *Valor:* R$ ${lancamento.valor}\n\n🔗 *Link para QR Code:* ${pixData.link}`,
              );
            } catch (e) {
              console.error("Erro ao gerar PIX da mudança de endereço:", e);
              await MensagensComuns(
                celular,
                "✅ Recebemos a sua solicitação!\nEntraremos em contato em breve para concluir o envio da cobrança e do Termo de Alteração de Endereço. Obrigado pela confiança!",
              );
            }
            session.stage = "awaiting_payment_confirmation";
          } else {
            try {
              const payloadZap = {
                ...(solicitacaoSalva?.dados || dadosFlow),
                termo: session.contrato_cliente || "",
                valor: "0.00",
                valor_plano: session.valor_plano_atual || "",
                plano: session.plano_mudanca || "",
                vencimento: session.vencimento_mudanca || "",
              };
              const zapResponse =
                await ZapSign.createContractMudancaEndereco(payloadZap as any);
              const zapSignUrl = zapResponse.signers[0].sign_url;

              if (solicitacaoSalva) {
                solicitacaoSalva.token_zapsign = zapResponse.token;
                await AppDataSource.getRepository(SolicitacaoServico).save(
                  solicitacaoSalva,
                );
              }

              await MensagensComuns(
                celular,
                "✅ Recebemos a sua solicitação!\nAqui está o link com Termo de Alteração de Endereço para assinatura. Obrigado pela confiança!",
              );
              await MensagensComuns(
                celular,
                `📄 *Aqui está o seu Link de Assinatura:* ${zapSignUrl}\n\nPor favor, *Assine* para formalizarmos o serviço! 🚀`,
              );
              session.stage = "awaiting_signature_link";
            } catch (e) {
              console.error(
                "Erro ao gerar link de assinatura da mudança de endereço grátis:",
                e,
              );
              await MensagensComuns(
                celular,
                "✅ Recebemos a sua solicitação!\nEntraremos em contato em breve para enviar o link com Termo de Alteração de Endereço. Obrigado pela confiança!",
              );
              session.stage = "awaiting_signature_link";
            }
          }

          return;
        }
      }
    } catch (e) {
      // Ignora erro de parse
    }

    await MensagensComuns(
      celular,
      "Por favor, preencha o formulário clicando no botão que enviamos acima para prosseguir.",
    );
  }
}
