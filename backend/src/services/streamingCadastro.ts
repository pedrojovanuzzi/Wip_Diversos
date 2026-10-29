/**
 * Contratação do streaming (WatchTV Brasil) no cadastro do cliente.
 *
 * Duas portas levam ao mesmo lugar: a tela de Serviços de Contrato, onde o
 * atendente adiciona à mão, e o webhook do ZapSign, quando o cliente assina o
 * Contrato de SVA. Para não divergirem, o registro na Watch Brasil e a
 * gravação em `sis_ser_contratos` moram aqui.
 *
 * A conta na Watch Brasil quem cria é o próprio cliente, por um link
 * (`streaming_convites`): a Watch recusa e-mail que já está em outra conta, e
 * só o cliente sabe qual e-mail pode usar.
 */

import crypto from "crypto";
import { IsNull, MoreThan } from "typeorm";
import MkauthSource from "../database/MkauthSource";
import AppDataSource from "../database/DataSource";
import { SisSerContratos } from "../entities/SisSerContratos";
import { ClientesEntities } from "../entities/ClientesEntities";
import { StreamingAssinante } from "../entities/StreamingAssinante";
import { StreamingConvite } from "../entities/StreamingConvite";
import { ClienteWatchTv } from "../entities/ClienteWatchTv";
import { SolicitacaoServico } from "../entities/SolicitacaoServico";
import { deleteTicket, insertAssinante } from "./WatchBrasilService";
import { VALOR_STREAMER } from "../config/servicosAdicionais";
import { PLANOS_COM_SVA, planoTemSva } from "../config/planosComSva";
import {
  diasDeTesteUsados,
  encerrarTeste,
  registrarInicioTeste,
} from "./streamingTesteHistorico";
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
 * O que o MK-Auth diz sobre a Watch TV do cliente: linha no contrato ou plano
 * combo. Só alimenta `clientes_watchtv`; quem responde se o cliente tem a
 * Watch TV é a tabela (`situacaoWatchTv`).
 */
async function evidenciaNoMkauth(
  login: string,
): Promise<"contrato" | "plano" | null> {
  if (await clienteJaTemStreaming(login)) return "contrato";
  const cliente = await MkauthSource.getRepository(ClientesEntities).findOne({
    where: { login },
    select: { plano: true },
  });
  return planoTemSva(cliente?.plano) ? "plano" : null;
}

/**
 * Valor de `clientes_watchtv` para um login, dada a evidência do MK-Auth.
 *
 * - Linha da Watch TV no contrato: tem (o cliente está pagando, ou é
 *   colaborador). Vale mais que qualquer marcação.
 * - Marcação manual: fica como o atendente deixou. É para isso que ela existe:
 *   plano ou serviço com nome que o sistema não reconhece.
 * - Senão, o plano decide: combo com streaming tem, os outros não.
 */
function valorWatchTv(
  evidencia: "contrato" | "plano" | null,
  atual: ClienteWatchTv | null,
): { watchtv: number; origem: string | null } {
  if (evidencia === "contrato") return { watchtv: 1, origem: "contrato" };
  if (atual?.origem === "manual") {
    return { watchtv: atual.watchtv ? 1 : 0, origem: "manual" };
  }
  if (evidencia === "plano") return { watchtv: 1, origem: "plano" };
  return { watchtv: 0, origem: null };
}

/**
 * Atualiza `clientes_watchtv` de um login a partir do MK-Auth. Chamado em todo
 * lugar que põe ou tira a Watch TV do cadastro; nunca derruba quem chamou.
 */
export async function sincronizarWatchTv(login?: string | null): Promise<void> {
  const l = String(login || "").trim();
  if (!l) return;
  try {
    const repo = AppDataSource.getRepository(ClienteWatchTv);
    const atual = await repo.findOne({ where: { login: l } });
    const v = valorWatchTv(await evidenciaNoMkauth(l), atual);
    await repo.upsert({ login: l, ...v }, ["login"]);
  } catch (e: any) {
    console.error(`[WatchTv] Falha ao sincronizar ${l}:`, e?.message || e);
  }
}

/**
 * Se o cliente tem a Watch TV. É a pergunta que o sistema todo faz, e a
 * resposta é sempre `clientes_watchtv`: o MK-Auth só alimenta a tabela.
 * Login que ainda não está nela é calculado e gravado na hora.
 */
export async function situacaoWatchTv(
  login?: string | null,
): Promise<{ tem: boolean; origem: string | null }> {
  const l = String(login || "").trim();
  if (!l) return { tem: false, origem: null };
  const repo = AppDataSource.getRepository(ClienteWatchTv);
  let linha = await repo.findOne({ where: { login: l } });
  if (!linha) {
    await sincronizarWatchTv(l);
    linha = await repo.findOne({ where: { login: l } });
  }
  return { tem: !!linha?.watchtv, origem: linha?.origem ?? null };
}

export async function temWatchTv(login?: string | null): Promise<boolean> {
  return (await situacaoWatchTv(login)).tem;
}

/**
 * Marcação feita pelo atendente na tela de Serviços de Contrato. A
 * sincronização diária não desfaz; só a linha do serviço no contrato passa
 * por cima (quem paga a Watch TV tem a Watch TV).
 */
export async function marcarWatchTvManual(
  login: string,
  tem: boolean,
): Promise<{ tem: boolean; origem: string }> {
  const l = String(login || "").trim();
  if (!tem && (await clienteJaTemStreaming(l))) {
    throw new ErroConvite(
      "A Watch TV está no contrato deste cliente. Remova o serviço antes de marcar que ele não tem.",
      409,
    );
  }
  await AppDataSource.getRepository(ClienteWatchTv).upsert(
    { login: l, watchtv: tem ? 1 : 0, origem: "manual" },
    ["login"],
  );
  return { tem, origem: "manual" };
}

/**
 * Recalcula `clientes_watchtv` inteira pelo MK-Auth. Pega o que não passa
 * pelo sistema (plano trocado direto no MK-Auth) e faz a carga inicial.
 * Marcações manuais ficam como estão, pela mesma regra de `valorWatchTv`.
 */
export async function sincronizarTodosWatchTv(): Promise<number> {
  const evidencias = new Map<string, "contrato" | "plano">();

  const planos = await MkauthSource.getRepository(ClientesEntities)
    .createQueryBuilder("c")
    .select(["c.login AS login", "c.plano AS plano"])
    .where("UPPER(c.plano) LIKE :p", { p: "%STREAM%" })
    .orWhere("UPPER(TRIM(c.plano)) IN (:...lista)", {
      lista: PLANOS_COM_SVA.map((p) => p.toUpperCase()),
    })
    .getRawMany();
  for (const r of planos) {
    const l = String(r.login || "").trim();
    if (l && planoTemSva(r.plano)) evidencias.set(l, "plano");
  }

  const contratos = await MkauthSource.getRepository(SisSerContratos)
    .createQueryBuilder("s")
    .select("DISTINCT TRIM(s.login)", "login")
    .where(`${sqlTagServico("s.nome")} IN (:...tipos)`, {
      tipos: TIPOS_STREAMING,
    })
    .getRawMany();
  for (const r of contratos) {
    const l = String(r.login || "").trim();
    if (l) evidencias.set(l, "contrato");
  }

  const repo = AppDataSource.getRepository(ClienteWatchTv);
  const atuais = new Map(
    (await repo.find()).map((a) => [a.login, a] as const),
  );

  // Só o que muda: logins com evidência e os que já estão na tabela.
  const logins = new Set([...evidencias.keys(), ...atuais.keys()]);
  const mudancas: Partial<ClienteWatchTv>[] = [];
  let comWatch = 0;
  for (const login of logins) {
    const atual = atuais.get(login) ?? null;
    const v = valorWatchTv(evidencias.get(login) ?? null, atual);
    if (v.watchtv) comWatch += 1;
    if (!atual || atual.watchtv !== v.watchtv || atual.origem !== v.origem) {
      mudancas.push({ login, ...v });
    }
  }

  for (let i = 0; i < mudancas.length; i += 500) {
    await repo.upsert(mudancas.slice(i, i + 500), ["login"]);
  }
  return comWatch;
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
  if (!(await temWatchTv(l))) return null;
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

  // O teste grátis fica registrado à parte: esta linha é apagada quando o
  // prazo acaba, e os dias usados precisam sobreviver para entrar no
  // proporcional da contratação paga.
  if (expiraTeste) {
    await registrarInicioTeste(cliente.login, expiraTeste);
  }

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
  const salvo = await repo.save(
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
  if (TIPOS_STREAMING.includes(tipo)) await sincronizarWatchTv(login);
  return salvo;
}

export type ResultadoContratacao = {
  /**
   * `aguardando_conta`: o serviço está no cadastro (e será cobrado), e o
   * cliente ainda precisa criar a conta pelo `link` — o atendimento envia.
   * `adicionado` e `sem_acesso` são de solicitações antigas, de antes do link.
   */
  status:
    | "aguardando_conta"
    | "adicionado"
    | "sem_acesso"
    | "ja_tinha"
    | "erro"
    | "nao_aplica";
  motivo?: string;
  /** Nome comercial gravado no contrato, quando gravou. */
  servico?: string;
  /** E-mail que recebeu o acesso — é para ele que a Watch TV escreve. */
  email?: string;
  /** Link para o cliente criar a conta da Watch TV. */
  link?: string;
};

/** Quantos dias o link de criação de conta vale. */
const VALIDADE_CONVITE_DIAS = 7;

const FRONT_URL = (process.env.URL || "http://localhost:3001").replace(
  /\/$/,
  "",
);

export function linkDoConvite(token: string): string {
  return `${FRONT_URL}/WatchTv/Conta/${token}`;
}

/** Link ainda não usado e dentro do prazo, do mais novo para o mais velho. */
async function conviteAberto(login: string) {
  return AppDataSource.getRepository(StreamingConvite).findOne({
    where: { login, usado_em: IsNull(), expira_em: MoreThan(new Date()) },
    order: { id: "DESC" },
  });
}

/** Link aberto do login, para as telas mostrarem que ainda falta enviar. */
export async function linkAbertoDoLogin(
  login: string,
): Promise<{ link: string; expira_em: Date } | null> {
  const c = await conviteAberto(login);
  return c ? { link: linkDoConvite(c.token), expira_em: c.expira_em } : null;
}

/**
 * Link para o cliente criar a conta da Watch TV.
 *
 * Reaproveita o link aberto do mesmo login: se o atendente clicar de novo, o
 * cliente que já recebeu o primeiro não fica com um link morto.
 */
export async function gerarConviteStreaming(params: {
  login: string;
  usuario?: string | null;
  solicitacaoId?: number | null;
}) {
  const login = String(params.login || "").trim();
  const repo = AppDataSource.getRepository(StreamingConvite);

  let convite = await conviteAberto(login);
  if (!convite) {
    convite = repo.create({
      token: crypto.randomBytes(24).toString("hex"),
      login,
      criado_por: params.usuario || null,
      solicitacao_id: params.solicitacaoId ?? null,
      expira_em: new Date(
        Date.now() + VALIDADE_CONVITE_DIAS * 24 * 60 * 60 * 1000,
      ),
    });
    await repo.save(convite);
  } else if (params.solicitacaoId && !convite.solicitacao_id) {
    convite.solicitacao_id = params.solicitacaoId;
    await repo.save(convite);
  }

  return { link: linkDoConvite(convite.token), expira_em: convite.expira_em };
}

/** Erro que pode ser mostrado ao cliente na página do link. */
export class ErroConvite extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Link válido, ou o motivo de não valer. */
async function conviteValido(token: string) {
  const convite = await AppDataSource.getRepository(StreamingConvite).findOne({
    where: { token: String(token || "") },
  });
  if (!convite) throw new ErroConvite("Link inválido.", 404);
  if (convite.usado_em) {
    throw new ErroConvite(
      "Este link já foi usado. Se precisar refazer a conta, peça um novo link ao atendimento.",
      410,
    );
  }
  if (convite.expira_em.getTime() < Date.now()) {
    throw new ErroConvite(
      "Este link expirou. Peça um novo link ao atendimento.",
      410,
    );
  }
  return convite;
}

/** O que a página do link mostra antes do cliente preencher. */
export async function dadosDoConvite(token: string) {
  const convite = await conviteValido(token);
  const cliente = await MkauthSource.getRepository(ClientesEntities).findOne({
    where: { login: convite.login },
    select: { nome: true },
  });
  const assinante = await AppDataSource.getRepository(
    StreamingAssinante,
  ).findOne({ where: { login: convite.login } });
  return {
    // Só o primeiro nome: a página é pública.
    nome: String(cliente?.nome || "").trim().split(/\s+/)[0] || null,
    substituiConta: Boolean(assinante?.ticket),
  };
}

/** Texto da recusa da Watch Brasil, para o log e para o cliente. */
function motivoDaWatch(e: any): string {
  const data = e?.response?.data;
  return String(
    data?.ErrorMessage ||
      data?.message ||
      data?.Message ||
      (data ? JSON.stringify(data).slice(0, 300) : "") ||
      e?.message ||
      e,
  );
}

/**
 * Cliente criando (ou refazendo) a conta pelo link.
 *
 * Se o cadastro já tinha conta, o ticket antigo sai da Watch Brasil antes:
 * o assinante novo usa o mesmo ID de integração (o id do cliente), e a conta
 * velha continuaria liberada com o e-mail anterior.
 */
export async function criarContaPeloConvite(params: {
  token: string;
  email: string;
  phone: string;
}) {
  const convite = await conviteValido(params.token);
  const email = String(params.email || "").trim().toLowerCase();
  const phone = String(params.phone || "").replace(/\D/g, "");
  if (!emailValido(email)) throw new ErroConvite("Informe um e-mail válido.");
  if (!celularValido(phone)) {
    throw new ErroConvite("Informe o celular com DDD.");
  }

  const cliente = await MkauthSource.getRepository(ClientesEntities).findOne({
    where: { login: convite.login },
  });
  if (!cliente) throw new ErroConvite("Cadastro não encontrado.", 404);
  const { tem, origem } = await situacaoWatchTv(convite.login);
  if (!tem) {
    throw new ErroConvite(
      "A Watch TV não está mais no seu cadastro. Fale com o nosso atendimento.",
      409,
    );
  }

  const streamingRepo = AppDataSource.getRepository(StreamingAssinante);
  const anterior = await streamingRepo.findOne({
    where: { login: convite.login },
  });
  if (anterior?.ticket) {
    try {
      await deleteTicket(anterior.ticket);
    } catch (e: any) {
      // Ticket que já não existe lá não pode travar a conta nova.
      console.error(
        "[WatchTvConta] Falha ao remover a conta anterior:",
        motivoDaWatch(e),
      );
    }
    anterior.ticket = null as any;
    await streamingRepo.save(anterior);
  }

  // Teste em andamento continua com o mesmo prazo.
  const expiraTeste =
    anterior?.teste_expira_em && anterior.teste_expira_em.getTime() > Date.now()
      ? anterior.teste_expira_em
      : null;

  try {
    await registrarAssinanteStreaming({ cliente, email, phone, expiraTeste });
  } catch (e: any) {
    console.error(
      `[WatchTvConta] Watch Brasil recusou ${convite.login} (${email}):`,
      motivoDaWatch(e),
    );
    throw new ErroConvite(
      "A Watch TV não aceitou este e-mail. Ele pode já estar em uso em outra " +
        "conta: tente outro e-mail ou fale com o nosso atendimento.",
      422,
    );
  }

  // Combo sem a linha no contrato: entra agora, por R$ 0,00, para o cadastro
  // mostrar o serviço como nos combos que já passaram pela assinatura.
  if (origem === "plano") {
    await gravarServicoNoContrato({
      login: convite.login,
      tipo: "STREAMER",
      valor: 0,
      usuario: "plano",
    });
  }

  convite.usado_em = new Date();
  convite.email_usado = email;
  await AppDataSource.getRepository(StreamingConvite).save(convite);

  // A solicitação mostrava o link pendente; agora mostra a conta criada.
  if (convite.solicitacao_id) {
    const solRepo = AppDataSource.getRepository(SolicitacaoServico);
    const sol = await solRepo.findOne({ where: { id: convite.solicitacao_id } });
    if (sol?.dados?.servico_cadastro) {
      sol.dados = {
        ...sol.dados,
        servico_cadastro: {
          ...sol.dados.servico_cadastro,
          status: "adicionado",
          email,
          motivo: undefined,
          link: undefined,
          conta_criada_em: new Date().toISOString(),
        },
      };
      await solRepo.save(sol);
    }
  }

  return { email };
}

/**
 * Coloca o streaming no cadastro depois que o cliente assina o contrato e
 * gera o link para ele criar a conta.
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
  usuario?: string;
  valor?: number;
  solicitacaoId?: number | null;
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

  // O serviço entra no cadastro já na assinatura; a conta na Watch Brasil só
  // depois, quando o cliente usar o link.
  const salvo = await gravarServicoNoContrato({
    login,
    tipo: "STREAMER",
    valor: params.valor ?? VALOR_STREAMER,
    usuario: params.usuario || "assinatura",
  });

  // O cliente passou a pagar: o teste em andamento acaba aqui, e os dias que
  // ele usou ficam guardados para entrar no proporcional.
  await encerrarTeste(login, "convertido");

  const { link } = await gerarConviteStreaming({
    login,
    usuario: params.usuario || "assinatura",
    solicitacaoId: params.solicitacaoId,
  });

  return {
    status: "aguardando_conta",
    servico: salvo.nome,
    link,
    motivo:
      "Serviço adicionado ao cadastro. Envie o link ao cliente para ele " +
      "criar a conta da Watch TV.",
  };
}

/** Validação simples de e-mail, só para não mandar lixo à Watch Brasil. */
export function emailValido(email?: string | null): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || "").trim());
}

/** Celular com DDD, sem o 55 e sem máscara. */
export function celularValido(celular?: string | null): boolean {
  const n = String(celular || "").replace(/\D/g, "");
  return n.length === 10 || n.length === 11;
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
  solicitacaoId?: number | null;
}): Promise<ResultadoContratacao> {
  if (!planoTemSva(params.plano)) return { status: "nao_aplica" };

  return contratarStreamingAposAssinatura({
    login: params.login,
    usuario: "plano",
    valor: 0,
    solicitacaoId: params.solicitacaoId,
  });
}
