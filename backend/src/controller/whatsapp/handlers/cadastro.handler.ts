import axios from "axios";
import moment from "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import AppDataSource from "../../../database/DataSource";
import { ClientesEntities } from "../../../entities/ClientesEntities";
import MkauthDataSource from "../../../database/MkauthSource";
import { SolicitacaoServico } from "../../../entities/SolicitacaoServico";
import { validarCPF, validarRG, verificaType } from "../utils/validation";
import { limparEndereco } from "../utils/helpers";
import { writeMessageLog } from "../utils/logging";
import { sendServiceEmail } from "../services/email.service";
import { sessions, deleteSession } from "../services/session.service";
import { getPlanosDoSistema } from "../services/plano.service";
import {
  MensagensComuns,
  MensagemBotao,
  MensagemLista,
  MensagemTermos,
  MensagemFlow,
  Finalizar,
} from "../services/messaging.service";

export async function iniciarCadastro(
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

  const perguntas = [
    { campo: "nome", pergunta: "➡️ Digite seu *nome completo*:" },
    { campo: "rg", pergunta: "➡️ Digite seu *RG/IE*:" },
    { campo: "cpf", pergunta: "➡️ Digite seu *CPF/CNPJ*:" },
    {
      campo: "dataNascimento",
      pergunta: "➡️ Digite sua *data de nascimento*: dd/mm/yyyy",
    },
    {
      campo: "celular",
      pergunta: "➡️ Digite seu número de *celular* com *DDD*:",
    },
    {
      campo: "celularSecundario",
      pergunta: "➡️ Digite um segundo *celular*  para *contato* com *DDD*:",
    },
    { campo: "email", pergunta: "➡️ Digite seu *e-mail*:" },
    { campo: "rua", pergunta: "➡️ Digite sua *Rua*:" },
    {
      campo: "numero",
      pergunta: "➡️ Digite o *Número* de sua *Residência*:",
    },
    { campo: "bairro", pergunta: "➡️ Digite seu *Bairro*:" },
    { campo: "cidade", pergunta: "➡️ Digite sua *Cidade*:" },
    { campo: "estado", pergunta: "➡️ Digite seu *Estado* (2 Letras):" },
    { campo: "cep", pergunta: "➡️ Digite seu *CEP*:" },
  ];

  if (!session.dadosCadastro || session.ultimaPergunta === null) {
    console.log("Iniciando cadastro...");
    await MensagensComuns(
      celular,
      "🔤 Pronto, agora vamos coletar todos os seus *Dados* para elaborar o Cadastro e realizar os *Termos de Adesão*.",
    );
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

    if (ultimaPergunta === "rg") {
      const RgValido = validarRG(texto);
      if (!RgValido) {
        await MensagensComuns(
          celular,
          "❌ *RG* inválido. Por favor, insira um *RG* válido.",
        );
        return;
      }
    }

    if (ultimaPergunta === "nome") {
      texto = String(texto)
        .replace(/[^a-zA-ZÀ-ÿ\s]/g, "")
        .trim();
    } else if (
      ultimaPergunta === "celular" ||
      ultimaPergunta === "celularSecundario"
    ) {
      texto = String(texto).replace(/\D/g, "");
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
    await MensagensComuns(
      celular,
      "🛜 Vamos escolher o seu *Plano de Internet*",
    );
    const planosDoSistema = await getPlanosDoSistema();
    await MensagemLista(celular, "Escolha seu Plano:", {
      sections: [
        {
          title: "Planos Disponíveis",
          rows: planosDoSistema.slice(0, 10).map((p) => ({
            id: p.id,
            title: p.title,
          })),
        },
      ],
    });
    session.stage = "plan";
    console.log("Dados cadastrados:", session.dadosCadastro);

    session.dadosCompleto = { ...session.dadosCadastro };
    session.dadosCadastro = null;
    session.ultimaPergunta = null;
  }
}

export async function handleAwaitingFlowCadastro(
  celular: any,
  texto: any,
  session: any,
) {
  try {
    const dadosFlow = JSON.parse(texto);
    if (dadosFlow && dadosFlow.nome) {
      console.log("Dados recebidos do Flow Cadastro:", dadosFlow);

      let nomeLimpo = (dadosFlow.nome || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();

      const partesNome = nomeLimpo.split(" ");
      if (partesNome.length < 2 || partesNome[0].length < 2) {
        await MensagensComuns(
          celular,
          "⚠️ *Atenção!*\nPor favor, informe o seu *Nome Completo* (nome e sobrenome), sem números ou abreviações.",
        );
        const planosDoSistema = await getPlanosDoSistema();
        await MensagemFlow(celular, "Cadastro", "📋 Preencher novamente", planosDoSistema);
        return false;
      }

      dadosFlow.nome = nomeLimpo;
      const primeiroNome = partesNome[0];
      const ultimoNome = partesNome[partesNome.length - 1];
      dadosFlow.login = (primeiroNome + ultimoNome).toUpperCase();

      const cepLimpo = (dadosFlow.cep || "").replace(/\D/g, "");
      const celLimpo = (dadosFlow.celular || "").replace(/\D/g, "");

      if (cepLimpo.length !== 8) {
        await MensagensComuns(
          celular,
          "⚠️ *Atenção!*\nO *CEP* informado é inválido. Digite os 8 números corretamente.",
        );
        const planosDoSistema = await getPlanosDoSistema();
        await MensagemFlow(celular, "Cadastro", "📋 Preencher novamente", planosDoSistema);
        return false;
      }
      if (celLimpo.length < 10) {
        await MensagensComuns(
          celular,
          "⚠️ *Atenção!*\nO *Celular* informado é inválido. Digite o DDD + Número corretamente.",
        );
        const planosDoSistema = await getPlanosDoSistema();
        await MensagemFlow(celular, "Cadastro", "📋 Preencher novamente", planosDoSistema);
        return false;
      }

      const cpfValido = validarCPF(dadosFlow.cpf || "");
      const rgValido = validarRG(dadosFlow.rg || "");

      if (!cpfValido || !rgValido) {
        let msgErro = "⚠️ *Atenção!*\n\n";
        if (!cpfValido && !rgValido) {
          msgErro += "O *CPF* e o *RG/IE* informados são inválidos.\n";
        } else if (!cpfValido) {
          msgErro += "O *CPF* informado é inválido.\n";
        } else {
          msgErro += "O *RG/IE* informado é inválido.\n";
        }
        await MensagensComuns(
          celular,
          msgErro + "Por favor, verifique os dados e preencha o formulário novamente.",
        );
        const planosDoSistema = await getPlanosDoSistema();
        await MensagemFlow(celular, "Cadastro", "📋 Preencher novamente", planosDoSistema);
        return false;
      }

      session.dadosCompleto = {
        nome: dadosFlow.nome,
        rg: dadosFlow.rg,
        cpf: dadosFlow.cpf,
        dataNascimento: dadosFlow.dataNascimento,
        celular: dadosFlow.celular,
        celularSecundario: dadosFlow.celularSecundario || "",
        email: dadosFlow.email,
        cep: dadosFlow.cep,
        rua: dadosFlow.rua,
        numero: dadosFlow.numero,
        bairro: dadosFlow.bairro,
        cidade: dadosFlow.cidade,
        estado: dadosFlow.estado,
      };

      const planoFlow = dadosFlow.plano || "";
      session.planoEscolhido = planoFlow;

      await MensagensComuns(
        celular,
        "✅ Recebemos a sua solicitação!\nNossa equipe vai analisar o CPF informado e continuar os próximos passos da instalação. Obrigado pela confiança!",
      );

      const resumoEmailHtml =
        `<h3>Nova Solicitação de Instalação via WhatsApp Flow</h3>` +
        `<p><b>Nome:</b> ${dadosFlow.nome}</p>` +
        `<p><b>CPF:</b> ${dadosFlow.cpf}</p>` +
        `<p><b>RG/IE:</b> ${dadosFlow.rg}</p>` +
        `<p><b>Nascimento:</b> ${dadosFlow.dataNascimento}</p>` +
        `<p><b>Celular:</b> ${dadosFlow.celular}</p>` +
        `<p><b>Email:</b> ${dadosFlow.email}</p>` +
        `<p><b>Endereço:</b> ${dadosFlow.rua}, ${dadosFlow.numero} - ${dadosFlow.bairro}</p>` +
        `<p><b>Cidade:</b> ${dadosFlow.cidade}/${dadosFlow.estado}</p>` +
        `<p><b>CEP:</b> ${dadosFlow.cep}</p>` +
        `<p><b>Plano Escolhido:</b> ${planoFlow}</p>` +
        `<p><b>Vencimento:</b> Dia ${dadosFlow.vencimento}</p>`;

      sendServiceEmail(resumoEmailHtml);

      const resumoCadastro =
        `📋 *Nova Solicitação de Instalação*\n\n` +
        `👤 *Nome:* ${dadosFlow.nome}\n` +
        `📄 *CPF:* ${dadosFlow.cpf}\n` +
        `🪪 *RG/IE:* ${dadosFlow.rg}\n` +
        `🎂 *Nascimento:* ${dadosFlow.dataNascimento}\n` +
        `📱 *Celular:* ${dadosFlow.celular}\n` +
        `📧 *Email:* ${dadosFlow.email}\n` +
        `📍 *Endereço:* ${dadosFlow.rua}, ${dadosFlow.numero} - ${dadosFlow.bairro}\n` +
        `🏙️ *Cidade:* ${dadosFlow.cidade}/${dadosFlow.estado}\n` +
        `📮 *CEP:* ${dadosFlow.cep}\n` +
        `📶 *Plano:* ${planoFlow}\n` +
        `📅 *Vencimento:* Dia ${dadosFlow.vencimento}`;

      const repo = AppDataSource.getRepository(SolicitacaoServico);
      const novaSolicitacao = new SolicitacaoServico();
      novaSolicitacao.servico = "Instalação";
      novaSolicitacao.login_cliente = dadosFlow.login || "Desconhecido";
      novaSolicitacao.data_solicitacao = new Date();
      novaSolicitacao.assinado = false;
      novaSolicitacao.pago = false;
      novaSolicitacao.gratis = 0;
      novaSolicitacao.dados = {
        ...dadosFlow,
        plano: planoFlow,
        vencimento: dadosFlow.vencimento,
        telefone_conversa: celular,
      };
      await repo.save(novaSolicitacao);

      await Finalizar(resumoCadastro, celular, true);
      session.stage = "awaiting_manual_review";
      return true;
    }
  } catch (e) {
    // Não é JSON, o usuário mandou texto normal
  }

  await MensagensComuns(
    celular,
    "📋 Por favor, preencha o formulário do *Cadastro* clicando no botão acima.",
  );
  return false;
}

export async function handlePlanSelection(
  celular: any,
  texto: any,
  session: any,
) {
  const planosDoSistema = await getPlanosDoSistema();
  const planoEncontrado = planosDoSistema.find((p) => p.title === texto);

  if (planoEncontrado) {
    session.planoEscolhido = planoEncontrado.title;
  } else {
    await MensagensComuns(
      celular,
      "*Opção Invalida* 😞\n🙏🏻Por gentileza, Selecione uma Opção da Lista",
    );
    session.stage = "plan";
    return;
  }

  await MensagensComuns(
    celular,
    "🗓️ Vamos escolher a *Data* mensal de *Vencimento* da sua fatura!",
  );
  await MensagemLista(celular, "Escolha seu Vencimento", {
    sections: [
      {
        title: "Escolha seu Vencimento",
        rows: [
          { id: "option_1", title: "DIA 05" },
          { id: "option_2", title: "DIA 10" },
          { id: "option_3", title: "DIA 15" },
          { id: "option_4", title: "DIA 20" },
        ],
      },
    ],
  });

  session.stage = "venc_date";
}

export async function handleVencDate(
  celular: any,
  texto: any,
  session: any,
) {
  const vencMap: { [key: string]: string } = {
    "DIA 05": "Dia 05",
    "DIA 10": "Dia 10",
    "DIA 15": "Dia 15",
    "DIA 20": "Dia 20",
  };

  const vencimentoEscolhido = vencMap[texto];
  if (!vencimentoEscolhido) {
    await MensagensComuns(
      celular,
      "*Opção Invalida* 😞\n🙏🏻Por gentileza, Selecione uma Opção da Lista",
    );
    session.stage = "venc_date";
    return;
  }

  session.vencimentoEscolhido = vencimentoEscolhido;
  await MensagemTermos(
    celular,
    "🙂 Estamos quase terminando!",
    "🗂️ Peço que *leia atenciosamente* as *informações* e o *Contrato* hospedado disponíveis abaixo, não restando nenhuma *dúvida* na sua *contratação*!",
    "Ler Informações",
    "https://wipdiversos.wiptelecomunicacoes.com.br/doc/contratação",
  );
  await MensagemTermos(
    celular,
    "Finalizando....",
    `*Em breve, enviaremos o link para assinatura dos demais documentos, para formalização do contrato.*\nEnquanto isso, leia o contrato de SCM, padrão entre o provedor e todos os clientes, devidamente registrado em cartório.`,
    "Ler o contrato",
    "https://wipdiversos.wiptelecomunicacoes.com.br/doc/contrato",
  );
  await MensagemBotao(
    celular,
    "🆗 *Li* e estou *de acordo* com as *informações* dadas e todos os termos do *Contrato*.",
    "Sim, li e aceito",
    "Não",
  );
  session.stage = "final_register";
}

export async function handleFinalRegister(
  celular: any,
  texto: any,
  session: any,
) {
  if (texto.toLowerCase() === "sim, li e aceito") {
    await MensagensComuns(
      celular,
      "🫱🏻‍🫲🏼 *Parabéns* estamos quase lá...\nSua solicitação será enviada para análise da equipe, que poderá *consultar o CPF* ou *ignorar a consulta* para seguir com a instalação.",
    );
    let dadosCliente = session.dadosCompleto
      ? JSON.stringify(session.dadosCompleto, null, 2)
      : "Dados não encontrados";
    session.msgDadosFinais = `*🧑 Instalação Nova* \nPlano Escolhido: ${session.planoEscolhido}\nVencimento: ${session.vencimentoEscolhido}\nDados do Cliente: ${dadosCliente}`;

    writeMessageLog({
      messages: session.msgDadosFinais,
      timestamp: new Date().toISOString(),
    });

    sendServiceEmail(session.msgDadosFinais);
    const repo = AppDataSource.getRepository(SolicitacaoServico);
    const novaSolicitacao = new SolicitacaoServico();
    novaSolicitacao.servico = "Instalação";
    novaSolicitacao.login_cliente =
      session.dadosCompleto?.login || "Desconhecido";
    novaSolicitacao.data_solicitacao = new Date();
    novaSolicitacao.assinado = false;
    novaSolicitacao.pago = false;
    novaSolicitacao.gratis = 0;
    novaSolicitacao.dados = {
      ...session.dadosCompleto,
      plano: session.planoEscolhido,
      vencimento: session.vencimentoEscolhido,
      telefone_conversa: celular,
    };
    await repo.save(novaSolicitacao);

    await Finalizar(session.msgDadosFinais, celular, true);
    session.stage = "awaiting_manual_review";
  } else if (
    texto.toLowerCase() === "não" ||
    texto.toLowerCase() === "nao"
  ) {
    await MensagensComuns(
      celular,
      "🥹 *Infelizmente* não poderei mais dar \ncontinuidade ao seu atendimento, *respeitando* a sua vontade.\n🫡Estaremos sempre aqui a sua *disposição*!",
    );
    setTimeout(() => {
      if (sessions[celular] && sessions[celular].inactivityTimer) {
        clearTimeout(sessions[celular].inactivityTimer);
      }
      deleteSession(celular);
    }, 5000);
  } else {
    await MensagensComuns(
      celular,
      "Opção invalida 😞\n🙏🏻Por gentileza, Selecione um Botão",
    );
  }
}

async function getIbgeCode(estado: string, cidade: string): Promise<string | null> {
  try {
    const ufStr = (estado || "").trim().toLowerCase();
    const cityStr = (cidade || "").trim().toLowerCase();
    if (!ufStr || !cityStr) return null;

    const response = await axios.get(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufStr}/municipios`,
    );
    const municipios = response.data;
    const nmNormalized = cityStr
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/gi, "")
      .trim();
    const munFind = municipios.find((m: any) => {
      const mNmNorm = m.nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/gi, "")
        .trim();
      return mNmNorm === nmNormalized;
    });
    return munFind ? munFind.id.toString() : null;
  } catch (err) {
    console.error("Erro ao buscar IBGE da API externa:");
    return null;
  }
}

async function saveClienteToMkAuth(dados: any, plano: string, vencimento?: string) {
  const ClientesRepository = MkauthDataSource.getRepository(ClientesEntities);

  const ibgeCode = await getIbgeCode(dados.estado, dados.cidade);

  try {
    const loginBase = dados.login || (dados.nome || "").trim().replace(/\s/g, "").toUpperCase();
    const findLogin = await ClientesRepository.findOne({
      where: { login: loginBase },
    });

    if (findLogin) {
      console.log("Login já existe:", findLogin);
      dados.nome = dados.nome + " " + findLogin.id;
      if (dados.login) dados.login = dados.login + " " + findLogin.id;
    }

    const celularFormatado = (dados.celular || "").replace(/\D/g, "");
    const celular2Formatado = (dados.celularSecundario || "").replace(/\D/g, "");

    const addClient = await ClientesRepository.save({
      nome: (dados.nome || "").toUpperCase(),
      login: dados.login || (dados.nome || "").trim().replace(/\s/g, "").toUpperCase(),
      rg: (dados.rg || "").trim().replace(/\s/g, ""),
      cpf_cnpj: (dados.cpf || "").trim().replace(/\s/g, ""),
      uuid_cliente: `019b${uuidv4().slice(0, 32)}`,
      email: (dados.email || "").trim().replace(/\s/g, ""),
      cidade: limparEndereco(dados.cidade || ""),
      bairro: limparEndereco(dados.bairro || ""),
      estado: (dados.estado || "").toUpperCase().replace(/\s/g, "").slice(0, 2),
      nascimento: (dados.dataNascimento || "").replace(
        /(\d{2})\/(\d{2})\/(\d{4})/,
        "$3-$2-$1",
      ),
      numero: limparEndereco(dados.numero || ""),
      endereco: limparEndereco(dados.rua || ""),
      cep: `${(dados.cep || "").trim().replace(/\s/g, "").slice(0, 5)}-${(dados.cep || "").trim().replace(/\s/g, "").slice(5)}`,
      plano: plano,
      pool_name: "LAN_PPPOE",
      plano15: "Plano_15",
      plano_bloqc: "Plano_bloqueado",
      vendedor: "SCM",
      conta: "3",
      comodato: "sim",
      cidade_ibge: ibgeCode || "3503406",
      fone: "(14)3296-1608",
      venc: vencimento
        ? (vencimento || "").trim().replace(/\s/g, "").replace(/\D/g, "")
        : (dados.vencimento || "").trim().replace(/\s/g, "").replace(/\D/g, ""),
      celular:
        celularFormatado.length >= 4
          ? `(${celularFormatado.slice(0, 2)})${celularFormatado.slice(2)}`
          : celularFormatado,
      celular2:
        celular2Formatado.length >= 4
          ? `(${celular2Formatado.slice(0, 2)})${celular2Formatado.slice(2)}`
          : celular2Formatado,
      estado_res: (dados.estado || "").toUpperCase().replace(/\s/g, "").slice(0, 2),
      bairro_res: limparEndereco(dados.bairro || ""),
      tipo: "pppoe",
      cidade_res: limparEndereco(dados.cidade || ""),
      cep_res: `${(dados.cep || "").trim().replace(/\s/g, "").slice(0, 5)}-${(dados.cep || "").trim().replace(/\s/g, "").slice(5)}`,
      numero_res: limparEndereco(dados.numero || ""),
      endereco_res: limparEndereco(dados.rua || ""),
      tipo_cob: "titulo",
      mesref: "now",
      prilanc: "tot",
      pessoa:
        (dados.cpf || "").replace(/\D/g, "").length <= 11
          ? "fisica"
          : "juridica",
      dias_corte: 80,
      senha: moment().format("DDMMYYYY"),
      cadastro: moment().format("DD-MM-YYYY").split("-").join("/"),
      data_ip: moment().format("YYYY-MM-DD HH:mm:ss"),
      data_ins: moment().format("YYYY-MM-DD HH:mm:ss"),
    });

    await ClientesRepository.update(addClient.id, {
      termo: `${addClient.id}C/${moment().format("YYYY")}`,
    });

    console.log("Cliente salvo com sucesso no MKAuth:", addClient);
  } catch (dbError) {
    console.error("Erro ao salvar cliente no MKAuth:", dbError);
  }
}
