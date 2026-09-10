/**
 * Contratação do streaming (WatchTV Brasil) no cadastro do cliente.
 *
 * Duas portas levam ao mesmo lugar: a tela de Serviços de Contrato, onde o
 * atendente adiciona à mão, e o webhook do ZapSign, quando o cliente assina o
 * Contrato de SVA. Para não divergirem, o registro na Watch Brasil e a
 * gravação em `sis_ser_contratos` moram aqui.
 */

import MkauthSource from "../database/MkauthSource";
import AppDataSource from "../database/DataSource";
import { SisSerContratos } from "../entities/SisSerContratos";
import { ClientesEntities } from "../entities/ClientesEntities";
import { StreamingAssinante } from "../entities/StreamingAssinante";
import { insertAssinante } from "./WatchBrasilService";
import { VALOR_STREAMER } from "../config/servicosAdicionais";
import { planoTemSva } from "../config/planosComSva";
import {
  nomeContratoParaGravar,
  sqlTagServico,
} from "./servicosAdicionaisNomes";

/** CFOP usado nos serviços adicionais do contrato. */
const CFOP_DEFAULT = "5949";

/** Streaming pago e o de colaborador ocupam o mesmo lugar no cadastro. */
const TIPOS_STREAMING = ["STREAMER", "STREAMER_COLAB"];

/** O cliente já tem algum streaming no cadastro? */
export async function clienteJaTemStreaming(login: string): Promise<boolean> {
  const total = await MkauthSource.getRepository(SisSerContratos)
    .createQueryBuilder("s")
    .where("UPPER(TRIM(s.login)) = UPPER(TRIM(:l))", { l: login })
    .andWhere(`${sqlTagServico("s.nome")} IN (:...tipos)`, {
      tipos: TIPOS_STREAMING,
    })
    .getCount();
  return total > 0;
}

/**
 * Motivo para barrar a contratação da Watch TV, ou `null` quando pode seguir.
 *
 * Bot e site consultam isto antes de deixar o cliente contratar: o serviço é
 * único por cadastro, e deixar passar só geraria uma solicitação que o
 * atendimento teria de recusar depois — com o cliente já tendo assinado.
 */
export async function impedimentoWatchTv(
  login?: string | null,
): Promise<string | null> {
  const l = String(login || "").trim();
  if (!l) return null;
  if (!(await clienteJaTemStreaming(l))) return null;
  return (
    "Este cadastro já tem a Watch TV ativa. Se estiver com dificuldade para " +
    "acessar, fale com o nosso atendimento."
  );
}

/**
 * Motivo para não deixar o cliente entrar num plano com SVA, ou `null`.
 *
 * O combo já traz a Watch TV embutida no preço do acesso. Quem tem o streaming
 * contratado à parte pagaria duas vezes pela mesma coisa — e o serviço é único
 * por cadastro, então a linha de R$ 0,00 do plano nem entraria.
 */
export async function impedimentoPlanoComSva(
  login?: string | null,
  plano?: string | null,
): Promise<string | null> {
  if (!planoTemSva(plano)) return null;
  const l = String(login || "").trim();
  if (!l) return null;
  if (!(await clienteJaTemStreaming(l))) return null;
  return (
    `O plano ${String(plano).trim()} já inclui a Watch TV, e este cadastro ` +
    "já tem a Watch TV contratada à parte. Para migrar sem pagar duas vezes, " +
    "fale com o nosso atendimento: a assinatura avulsa é removida antes da " +
    "troca de plano."
  );
}

/**
 * Cria (ou atualiza) o assinante na Watch Brasil e guarda o ticket.
 *
 * Lança se a Watch Brasil recusar: sem assinante lá, o serviço no cadastro
 * seria cobrança sem entrega.
 */
export async function registrarAssinanteStreaming(params: {
  cliente: ClientesEntities;
  email: string;
  phone: string;
  /** Assinatura de teste: quando expira. */
  expiraTeste?: Date | null;
}) {
  const { cliente, email, phone, expiraTeste = null } = params;
  const assinanteIDIntegracao = String(cliente.id);

  const apiResp = await insertAssinante({
    email,
    assinanteIDIntegracao,
    phone,
  });
  console.log("[WatchBrasil][insertAssinante] resposta:", apiResp);

  if (apiResp?.HasError === true) {
    throw new Error(
      "Watch Brasil HasError: " +
        (apiResp?.ErrorMessage || JSON.stringify(apiResp).slice(0, 300)),
    );
  }

  const ticket =
    apiResp?.ticket ||
    apiResp?.pTicket ||
    apiResp?.data?.ticket ||
    apiResp?.Result?.ticket ||
    apiResp?.Result?.[0]?.ticket ||
    null;
  const chave =
    apiResp?.chave ||
    apiResp?.Result?.chave ||
    apiResp?.Result?.[0]?.chave ||
    null;

  const streamingRepo = AppDataSource.getRepository(StreamingAssinante);
  let assinante = await streamingRepo.findOne({
    where: { login: cliente.login },
  });
  if (!assinante) assinante = streamingRepo.create({ login: cliente.login });

  assinante.email = email;
  assinante.phone = phone;
  assinante.assinante_id_integracao = assinanteIDIntegracao;
  assinante.ticket = ticket || assinante.ticket;
  assinante.chave = chave || assinante.chave;
  assinante.ativo = true;
  assinante.teste_expira_em = expiraTeste;
  assinante.last_response = JSON.stringify(apiResp).slice(0, 2000);
  await streamingRepo.save(assinante);

  return { ticket, chave, assinante };
}

/** Grava a linha do serviço no contrato do cliente (a que sai no boleto). */
export async function gravarServicoNoContrato(params: {
  login: string;
  tipo: string;
  valor: number;
  usuario?: string;
  storageGb?: number;
}) {
  const { login, tipo, valor, usuario = "sistema", storageGb } = params;
  const repo = MkauthSource.getRepository(SisSerContratos);
  return repo.save(
    repo.create({
      cfop_serc: CFOP_DEFAULT,
      // O boleto imprime este campo literalmente em "Valor adicional:".
      nome: nomeContratoParaGravar(tipo, valor, storageGb),
      valor,
      incluir: "sim",
      data: new Date(),
      insuser: usuario,
      login,
    }),
  );
}

export type ResultadoContratacao = {
  /**
   * `sem_acesso`: o serviço está no cadastro (e será cobrado), mas a conta na
   * Watch Brasil não foi criada — o atendimento precisa ativar.
   */
  status:
    | "adicionado"
    | "sem_acesso"
    | "ja_tinha"
    | "erro"
    | "nao_aplica";
  motivo?: string;
  /** Nome comercial gravado no contrato, quando gravou. */
  servico?: string;
};

/**
 * Coloca o streaming no cadastro depois que o cliente assina o contrato.
 *
 * Não mexe em faturas: o proporcional dos dias de uso é lançado pelo
 * atendimento, e apagar títulos em aberto a partir de um webhook seria
 * arriscado demais.
 *
 * `valor` existe para o plano combo, que já traz o streaming embutido no preço
 * do acesso: lá a Watch TV entra por R$ 0,00, senão o cliente pagaria duas
 * vezes pela mesma coisa.
 */
export async function contratarStreamingAposAssinatura(params: {
  login: string;
  email?: string;
  phone?: string;
  usuario?: string;
  valor?: number;
}): Promise<ResultadoContratacao> {
  const login = String(params.login || "").trim();
  if (!login || login === "Desconhecido" || login === "Não informado") {
    return { status: "erro", motivo: "Login do cliente não identificado." };
  }

  const cliente = await MkauthSource.getRepository(ClientesEntities).findOne({
    where: { login },
  });
  if (!cliente) {
    return { status: "erro", motivo: `Cliente ${login} não encontrado.` };
  }

  // Webhook do ZapSign reentrega evento: sem isso o serviço entraria duas
  // vezes no contrato.
  if (await clienteJaTemStreaming(login)) {
    return { status: "ja_tinha" };
  }

  // O serviço entra no cadastro primeiro: o cliente assinou o contrato, e essa
  // é a parte que não pode se perder. A ativação na Watch Brasil depende de um
  // callback externo (`/api/watchbrasil/redirect`) que pode demorar ou falhar;
  // se ela ficasse na frente, uma falha temporária apagaria a contratação — e o
  // webhook do ZapSign não tenta de novo, porque a solicitação já está marcada
  // como assinada.
  const salvo = await gravarServicoNoContrato({
    login,
    tipo: "STREAMER",
    valor: params.valor ?? VALOR_STREAMER,
    usuario: params.usuario || "assinatura",
  });

  const email = String(params.email || cliente.email || "").trim();
  const phone = String(
    params.phone || cliente.celular || cliente.fone || "",
  ).replace(/\D/g, "");
  if (!email || !phone) {
    return {
      status: "sem_acesso",
      servico: salvo.nome,
      motivo:
        "Serviço adicionado ao cadastro, mas o cliente está sem e-mail ou " +
        "celular: ative o acesso pela tela de Serviços de Contrato.",
    };
  }

  try {
    await registrarAssinanteStreaming({ cliente, email, phone });
  } catch (e: any) {
    return {
      status: "sem_acesso",
      servico: salvo.nome,
      motivo:
        `Serviço adicionado ao cadastro, mas a Watch Brasil recusou a ` +
        `ativação: ${e?.message || e}. Refaça a ativação pela tela de ` +
        `Serviços de Contrato.`,
    };
  }

  return { status: "adicionado", servico: salvo.nome };
}

/**
 * Streaming que vem junto do plano (combo 800M).
 *
 * O acesso à Watch Brasil precisa existir do mesmo jeito — sem assinante lá o
 * cliente não assiste —, mas a mensalidade do streaming já está no preço do
 * plano. Por isso a linha entra no contrato por R$ 0,00: aparece no cadastro
 * como serviço contratado, sem somar nada ao boleto.
 */
export async function contratarStreamingDoPlano(params: {
  login: string;
  plano?: string | null;
  email?: string;
  phone?: string;
}): Promise<ResultadoContratacao> {
  if (!planoTemSva(params.plano)) return { status: "nao_aplica" };

  return contratarStreamingAposAssinatura({
    login: params.login,
    email: params.email,
    phone: params.phone,
    usuario: "plano",
    valor: 0,
  });
}
