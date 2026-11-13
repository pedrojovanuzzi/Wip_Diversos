import cron from "node-cron";
import MkauthSource from "../database/MkauthSource";
import AppDataSource from "../database/DataSource";
import { MensalidadeConfig } from "../entities/MensalidadeConfig";
import { MensalidadeBolix } from "../entities/MensalidadeBolix";
import { MensalidadeEmailEnvio } from "../entities/MensalidadeEmailEnvio";
import Email from "../controller/Email";
import { anexosDosBolix, bolixAtivo, canceladosManualmente, gerarBolix } from "./BolixEfi";
import { competenciaDoTitulo, dois, ErroDeUso } from "./mkauthTitulos";
import { clientesComAutomatico } from "./MensalidadesCriacao";

/**
 * Lembretes de boleto por e-mail (engrenagem da tela Mensalidades).
 *
 * Faz o que o projeto TypesScript_Express_MensagensWhatsapp_Backend fazia
 * (e-mail 10 dias antes, 5 dias antes e no dia do vencimento), mas com o
 * boleto gerado aqui: o bolix da Efí (gera se faltar) com o PDF anexado,
 * a linha digitável e o Pix copia e cola. O PDF do MK-Auth (SFTP) não é usado.
 *
 * Cada etapa roda uma vez por dia a partir do horário dela (o relógio confere
 * a cada 5 minutos; se o servidor estava fora no horário, roda quando voltar,
 * no mesmo dia). A tabela mensalidade_email_envio guarda o que já foi
 * mandado: a mesma etapa do mesmo título nunca vai duas vezes.
 */

export interface Etapa {
  /** Dias antes do vencimento (0 = no dia). */
  dias: number;
  /** "HH:MM" */
  hora: string;
}

export interface ConfigLembretes {
  ativo: boolean;
  etapas: Etapa[];
  /** Só títulos do tipo mensalidade (senão, todos os títulos em aberto). */
  soMensalidades: boolean;
  anexarPdf: boolean;
  assunto: string;
  mensagem: string;
  /** Pausa entre um e-mail e outro (o projeto antigo usava 50 s). */
  intervaloSegundos: number;
}

export interface ResumoEtapa {
  dias: number;
  vencimento: string;
  analisados: number;
  enviados: number;
  jaEnviados: number;
  semEmail: string[];
  pulados: { login: string; titulo: number; motivo: string }[];
  erros: { login: string; titulo: number; erro: string }[];
}

export interface ResumoLembretes {
  inicio: string;
  fim: string;
  origem: string;
  usuario: string;
  etapas: ResumoEtapa[];
}

const CHAVE = "lembretes_email";
const CHAVE_ULTIMA = "lembretes_email_ultima";
/** { "10": "2026-11-12", ... }: dia em que cada etapa já rodou. */
const CHAVE_RODADAS = "lembretes_email_rodadas";
const MAX_TENTATIVAS = 3;
const LIMITE_POR_ETAPA = 3000;

export const VARIAVEIS_LEMBRETE: [string, string][] = [
  ["%nome%", "nome do cliente"],
  ["%login%", "login"],
  ["%vencimento%", "vencimento do título (DD/MM/AAAA)"],
  ["%prazo%", '"vence hoje" ou "vence em N dias"'],
  ["%valor%", "valor do boleto"],
  ["%titulo%", "número do título"],
  ["%boleto%", "link do boleto na Efí"],
  ["%linhadig%", "linha digitável"],
  ["%pix%", "Pix copia e cola"],
  ["%endereco%", "endereço e número do cliente"],
  ["%provedor%", "nome do provedor"],
];

// Texto do projeto antigo (EmailController.msg), sem login/senha da central:
// o PDF agora vai sempre anexado.
const MENSAGEM_PADRAO = [
  "%login%",
  "",
  "Olá, %nome%. Sua mensalidade %prazo% (%vencimento%), no valor de %valor%.",
  "O boleto segue em PDF anexo.",
  "",
  "Linha digitável:",
  "%linhadig%",
  "",
  "Pix copia e cola:",
  "%pix%",
  "",
  "Ver o boleto: %boleto%",
  "",
  "DATA DE VENCIMENTO: %vencimento%",
  "ENDEREÇO: %endereco%",
  "",
  "BOT DE AUTO-ATENDIMENTO WIP TELECOM, disponível 24 horas, para efetuar pagamentos, super rápido e dinâmico:",
  "https://wa.me/message/MWHGELKC45WDN1",
  "",
  "Mensagem automática, não responda este e-mail. Para dúvidas, entre em contato pelo número (14) 98233-2963.",
  "Att.: %provedor%",
  "Agradecemos sua preferência!",
  "",
  "ATENÇÃO: CASO JÁ TENHA PAGO/AGENDADO, DESCONSIDERE ESTE E-MAIL!",
].join("\n");

export const LEMBRETES_PADRAO: ConfigLembretes = {
  ativo: false,
  etapas: [
    { dias: 10, hora: "16:00" },
    { dias: 5, hora: "10:00" },
    { dias: 0, hora: "08:00" },
  ],
  soMensalidades: true,
  anexarPdf: true,
  assunto: "%provedor% - boleto da mensalidade %vencimento%",
  mensagem: MENSAGEM_PADRAO,
  intervaloSegundos: 50,
};

const cfgRepo = () => AppDataSource.getRepository(MensalidadeConfig);
const envioRepo = () => AppDataSource.getRepository(MensalidadeEmailEnvio);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function isoDe(d: Date) {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}
const br = (iso: string) => iso.split("-").reverse().join("/");
const reais = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function ler<T>(chave: string): Promise<T | null> {
  const r = await cfgRepo().findOne({ where: { chave } });
  if (!r) return null;
  try {
    return JSON.parse(r.valor) as T;
  } catch {
    return null;
  }
}

async function gravar(chave: string, valor: unknown, usuario: string | null) {
  await cfgRepo().save({ chave, valor: JSON.stringify(valor), atualizado_por: usuario });
}

export async function lerLembretes(): Promise<ConfigLembretes> {
  return { ...LEMBRETES_PADRAO, ...((await ler<Partial<ConfigLembretes>>(CHAVE)) || {}) };
}

export async function ultimaExecucaoLembretes() {
  return ler<ResumoLembretes>(CHAVE_ULTIMA);
}

export async function salvarLembretes(
  entrada: Partial<ConfigLembretes>,
  usuario: string,
): Promise<ConfigLembretes> {
  const nova = { ...(await lerLembretes()) };
  if (entrada.ativo !== undefined) nova.ativo = entrada.ativo === true;
  if (entrada.soMensalidades !== undefined)
    nova.soMensalidades = entrada.soMensalidades === true;
  if (entrada.anexarPdf !== undefined) nova.anexarPdf = entrada.anexarPdf === true;
  if (entrada.assunto !== undefined) {
    const a = String(entrada.assunto).trim().slice(0, 200);
    if (!a) throw new ErroDeUso("Preencha o assunto.");
    nova.assunto = a;
  }
  if (entrada.mensagem !== undefined) {
    const m = String(entrada.mensagem).trim().slice(0, 10000);
    if (!m) throw new ErroDeUso("Preencha a mensagem.");
    nova.mensagem = m;
  }
  if (entrada.intervaloSegundos !== undefined) {
    const n = Math.floor(Number(entrada.intervaloSegundos));
    if (!Number.isFinite(n) || n < 0 || n > 600)
      throw new ErroDeUso("Intervalo entre e-mails: de 0 a 600 segundos.");
    nova.intervaloSegundos = n;
  }
  if (entrada.etapas !== undefined) {
    if (!Array.isArray(entrada.etapas) || entrada.etapas.length > 10)
      throw new ErroDeUso("Até 10 etapas de envio.");
    const etapas: Etapa[] = [];
    for (const e of entrada.etapas) {
      const dias = Math.floor(Number((e as any)?.dias));
      const hora = String((e as any)?.hora || "");
      if (!Number.isFinite(dias) || dias < 0 || dias > 60)
        throw new ErroDeUso("Dias antes do vencimento: de 0 a 60.");
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora))
        throw new ErroDeUso(`Horário inválido: "${hora}" (use HH:MM).`);
      if (etapas.some((x) => x.dias === dias))
        throw new ErroDeUso(`Etapa de ${dias} dia(s) repetida.`);
      etapas.push({ dias, hora });
    }
    nova.etapas = etapas.sort((a, b) => b.dias - a.dias);
  }
  await gravar(CHAVE, nova, usuario);
  return nova;
}

// ---------- montagem da mensagem ----------

const escapar = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Texto e HTML da mensagem com as variáveis trocadas. */
export function montar(modelo: string, vars: Record<string, string>) {
  const valor = (k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k.toLowerCase())
      ? vars[k.toLowerCase()]
      : undefined;
  const texto = modelo.replace(/%(\w+)%/g, (m, k) => valor(k) ?? m);
  // HTML: escapa tudo, troca as variáveis já escapadas, quebra linha em <br>
  // e só transforma em link o que começa com https:// (o Pix copia e cola não
  // começa, então fica intacto).
  const html = escapar(modelo)
    .replace(/%(\w+)%/g, (m, k) => {
      const v = valor(k);
      if (v === undefined) return m;
      if (k.toLowerCase() === "pix" || k.toLowerCase() === "linhadig")
        return `<strong style="word-break:break-all">${escapar(v)}</strong>`;
      return escapar(v);
    })
    // Em qualquer posição ("Boleto:https://..." também); o link termina no
    // espaço ou num caractere escapado (<, >, ").
    .replace(
      /https:\/\/[^\s<]+?(?=&lt;|&gt;|&quot;|[\s<]|$)/g,
      (url) => `<a href="${url}">${url}</a>`,
    )
    .replace(/\n/g, "<br>\n");
  return {
    texto,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${html}</div>`,
  };
}

/** Monta e manda o lembrete de um título. Devolve se o PDF foi anexado. */
async function mandar(
  email: Email,
  para: string,
  cfg: ConfigLembretes,
  t: any,
  b: MensalidadeBolix,
  dias: number,
  provedor: string,
) {
  const venc = String(t.datavenc instanceof Date ? isoDe(t.datavenc) : t.datavenc).slice(0, 10);
  const vars: Record<string, string> = {
    nome: String(t.nome || ""),
    login: String(t.login || ""),
    vencimento: br(venc),
    prazo:
      dias <= 0 ? "vence hoje" : dias === 1 ? "vence amanhã" : `vence em ${dias} dias`,
    valor: reais(Number(b.valor)),
    titulo: String(t.id).padStart(5, "0"),
    boleto: b.link || "",
    linhadig: b.linha_digitavel || "",
    pix: b.pix_copia_cola || "",
    endereco: [t.endereco, t.numero ? `Nº ${t.numero}` : ""]
      .filter(Boolean)
      .join(" ")
      .toUpperCase(),
    provedor,
  };
  const assunto = montar(cfg.assunto, vars).texto;
  const { texto, html } = montar(cfg.mensagem, vars);
  const anexos = cfg.anexarPdf ? await anexosDosBolix([b]) : [];
  await email.sendEmail(para, assunto, texto, anexos.length ? anexos : undefined, html);
  return anexos.length > 0;
}

/**
 * Botão "Enviar teste": o lembrete de um título, com a configuração salva,
 * para o e-mail informado (não para o cliente). Usa o bolix ativo do título:
 * o teste nunca cria cobrança na Efí (senão driblaria o boleto cancelado na
 * tela, o mês já pago e o automático desligado). Não conta como etapa enviada.
 */
export async function enviarLembreteTeste(para: string, tituloId: number, usuario: string) {
  if (!EMAIL_OK.test(para)) throw new ErroDeUso("Informe um e-mail válido para o teste.");
  if (!Number.isFinite(tituloId) || tituloId <= 0)
    throw new ErroDeUso("Informe o número de um título em aberto.");
  const [t] = await MkauthSource.query(
    `SELECT l.id, l.login, l.tipo, l.datavenc, l.status, c.nome, c.endereco, c.numero
       FROM sis_lanc l JOIN sis_cliente c ON c.login = l.login
      WHERE l.id = ? AND l.deltitulo = 0 LIMIT 1`,
    [tituloId],
  );
  if (!t) throw new ErroDeUso("Título não encontrado.");
  if (t.status === "pago") throw new ErroDeUso("Esse título já está pago.");
  const cfg = await lerLembretes();
  const [p] = await MkauthSource.query(`SELECT nome FROM sis_provedor LIMIT 1`);
  const b = await bolixAtivo(tituloId);
  if (!b)
    throw new ErroDeUso(
      "Esse título não tem boleto ativo. Gere o boleto na tela do cliente e teste de novo.",
    );
  const venc = new Date(t.datavenc);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  venc.setHours(0, 0, 0, 0);
  const dias = Math.round((venc.getTime() - hoje.getTime()) / 86_400_000);
  const comPdf = await mandar(new Email(), para, cfg, t, b, dias, String(p?.nome || "Wip Telecom"));
  return { para, comPdf };
}

// ---------- execução ----------

let rodando = false;
export function lembretesRodando() {
  return rodando;
}

/** Roda uma etapa: títulos que vencem daqui a `dias` dias. */
async function rodarEtapa(
  cfg: ConfigLembretes,
  dias: number,
  usuario: string,
  provedor: string,
): Promise<ResumoEtapa> {
  const alvo = new Date();
  alvo.setDate(alvo.getDate() + dias);
  const vencimento = isoDe(alvo);
  const resumo: ResumoEtapa = {
    dias,
    vencimento,
    analisados: 0,
    enviados: 0,
    jaEnviados: 0,
    semEmail: [],
    pulados: [],
    erros: [],
  };

  const titulos: any[] = await MkauthSource.query(
    `SELECT l.id, l.login, l.tipo, l.referencia, l.datavenc, l.valor,
            c.nome, c.email, c.endereco, c.numero
       FROM sis_lanc l
       JOIN sis_cliente c ON c.login = l.login AND c.cli_ativado = 's'
      WHERE l.deltitulo = 0 AND l.status IN ('aberto', 'vencido')
        AND DATE(l.datavenc) = ?
        ${cfg.soMensalidades ? "AND l.tipo = 'mensalidade'" : ""}
      ORDER BY l.login, l.id
      LIMIT ?`,
    [vencimento, LIMITE_POR_ETAPA],
  );
  resumo.analisados = titulos.length;
  if (!titulos.length) return resumo;

  const ids = titulos.map((t) => Number(t.id));
  const jaFeitos = await envioRepo()
    .createQueryBuilder("e")
    .where("e.titulo_id IN (:...ids)", { ids })
    .andWhere("e.dias_antes = :dias", { dias })
    .andWhere("e.vencimento = :vencimento", { vencimento })
    .getMany();
  const feitoPor = new Map(jaFeitos.map((e) => [Number(e.titulo_id), e]));
  const cancelados = await canceladosManualmente(ids);

  // Mesmo cuidado da geração automática: mês já pago (no MK-Auth ou num
  // bolix nosso) não ganha boleto de novo.
  const logins = Array.from(new Set(titulos.map((t) => t.login)));
  const pagos: any[] = await MkauthSource.query(
    `SELECT login, referencia, datavenc FROM sis_lanc
      WHERE login IN (?) AND deltitulo = 0 AND tipo = 'mensalidade'
        AND status = 'pago' AND datavenc >= CURDATE() - INTERVAL 400 DAY`,
    [logins],
  );
  const mesesPagos = new Set(pagos.map((p) => `${p.login}|${competenciaDoTitulo(p)}`));
  const ligados = await clientesComAutomatico(logins);
  const bolixPagos = await AppDataSource.getRepository(MensalidadeBolix)
    .createQueryBuilder("b")
    .select(["b.login_cliente", "b.competencia"])
    .where("b.login_cliente IN (:...logins)", { logins })
    .andWhere("b.situacao = 'pago'")
    .andWhere("b.competencia IS NOT NULL")
    .getMany();
  for (const b of bolixPagos) mesesPagos.add(`${b.login_cliente}|${b.competencia}`);
  // Mês já cobrado num bolix ativo de outro título (mesma regra da geração):
  // não cria uma segunda cobrança na Efí para o mesmo mês.
  const ativosDoMes = new Map<string, number>();
  const bolixAtivosDosClientes = await AppDataSource.getRepository(MensalidadeBolix)
    .createQueryBuilder("b")
    .select(["b.login_cliente", "b.competencia", "b.titulo_id"])
    .where("b.login_cliente IN (:...logins)", { logins })
    .andWhere("b.situacao = 'ativo'")
    .andWhere("b.competencia IS NOT NULL")
    .getMany();
  for (const b of bolixAtivosDosClientes)
    ativosDoMes.set(`${b.login_cliente}|${b.competencia}`, Number(b.titulo_id));

  const email = new Email();
  let primeiro = true;
  for (const t of titulos) {
    const id = Number(t.id);
    const anterior = feitoPor.get(id);
    if (anterior && (anterior.situacao === "enviado" || anterior.tentativas >= MAX_TENTATIVAS)) {
      resumo.jaEnviados++;
      continue;
    }
    if (!ligados.has(String(t.login))) {
      resumo.pulados.push({ login: t.login, titulo: id, motivo: "automático desligado no cliente" });
      continue;
    }
    const para = String(t.email || "").trim();
    if (!EMAIL_OK.test(para)) {
      resumo.semEmail.push(t.login);
      continue;
    }
    if (cancelados.has(id)) {
      resumo.pulados.push({ login: t.login, titulo: id, motivo: "boleto cancelado na tela" });
      continue;
    }
    const competencia = t.tipo === "mensalidade" ? competenciaDoTitulo(t) : "";
    if (competencia && mesesPagos.has(`${t.login}|${competencia}`)) {
      resumo.pulados.push({ login: t.login, titulo: id, motivo: `mês ${competencia} já pago` });
      continue;
    }
    const outro = competencia ? ativosDoMes.get(`${t.login}|${competencia}`) : undefined;
    if (outro !== undefined && outro !== id) {
      resumo.pulados.push({
        login: t.login,
        titulo: id,
        motivo: `mês ${competencia} já tem boleto no título ${outro}`,
      });
      continue;
    }
    // Este título fica com o mês nesta execução (outro do mesmo mês é pulado).
    if (competencia) ativosDoMes.set(`${t.login}|${competencia}`, id);

    if (!primeiro && cfg.intervaloSegundos > 0) await sleep(cfg.intervaloSegundos * 1000);
    primeiro = false;

    let chargeId: string | null = null;
    let comPdf = false;
    try {
      const b = await gerarBolix(id, usuario);
      chargeId = String(b.charge_id);
      comPdf = await mandar(email, para, cfg, t, b, dias, provedor);
      resumo.enviados++;
      await registrar(t, dias, vencimento, para, "enviado", chargeId, comPdf, null, anterior);
    } catch (e: any) {
      const erro = String(e?.message || e).slice(0, 300);
      resumo.erros.push({ login: t.login, titulo: id, erro });
      await registrar(t, dias, vencimento, para, "erro", chargeId, comPdf, erro, anterior).catch(
        (x) => console.error("[Lembretes] não gravou o erro:", x),
      );
    }
  }
  return resumo;
}

async function registrar(
  t: any,
  dias: number,
  vencimento: string,
  email: string,
  situacao: string,
  chargeId: string | null,
  comPdf: boolean,
  erro: string | null,
  anterior?: MensalidadeEmailEnvio,
) {
  const dados = {
    titulo_id: Number(t.id),
    login_cliente: String(t.login),
    dias_antes: dias,
    vencimento,
    email,
    situacao,
    charge_id: chargeId,
    com_pdf: comPdf ? 1 : 0,
    erro,
  };
  if (anterior)
    await envioRepo().update(
      { id: anterior.id },
      { ...dados, tentativas: anterior.tentativas + 1 },
    );
  else await envioRepo().save({ ...dados, tentativas: 1 });
}

/**
 * Roda as etapas. `etapas` vazio = todas. Grava o resumo para a engrenagem.
 */
export async function rodarLembretes(
  origem: "agendamento" | "manual",
  usuario: string,
  etapas?: number[],
): Promise<ResumoLembretes> {
  if (rodando) throw new ErroDeUso("O envio de e-mails já está rodando.");
  rodando = true;
  const resumo: ResumoLembretes = {
    inicio: new Date().toISOString(),
    fim: "",
    origem,
    usuario,
    etapas: [],
  };
  try {
    const cfg = await lerLembretes();
    const [p] = await MkauthSource.query(`SELECT nome FROM sis_provedor LIMIT 1`);
    const provedor = String(p?.nome || "Wip Telecom");
    const lista = cfg.etapas.filter((e) => !etapas?.length || etapas.includes(e.dias));
    for (const e of lista) {
      try {
        resumo.etapas.push(await rodarEtapa(cfg, e.dias, usuario, provedor));
      } catch (err: any) {
        console.error(`[Lembretes] erro na etapa de ${e.dias} dia(s):`, err);
        resumo.etapas.push({
          dias: e.dias,
          vencimento: "",
          analisados: 0,
          enviados: 0,
          jaEnviados: 0,
          semEmail: [],
          pulados: [],
          erros: [{ login: "-", titulo: 0, erro: String(err?.message || err).slice(0, 300) }],
        });
      }
    }
    return resumo;
  } finally {
    rodando = false;
    resumo.fim = new Date().toISOString();
    if (resumo.etapas.some((e) => e.analisados || e.erros.length) || origem === "manual") {
      await gravar(CHAVE_ULTIMA, resumo, usuario).catch((e) =>
        console.error("[Lembretes] não gravou o resumo:", e),
      );
      const enviados = resumo.etapas.reduce((s, e) => s + e.enviados, 0);
      const erros = resumo.etapas.reduce((s, e) => s + e.erros.length, 0);
      console.log(`📧 Lembretes de boleto (${origem}): ${enviados} enviados, ${erros} erros.`);
    }
  }
}

/** Espera entre uma tentativa com erro e a próxima (SMTP ou Efí fora). */
const ESPERA_NOVA_TENTATIVA_MIN = 30;

/**
 * Etapas a rodar agora: as que chegaram no horário e ainda não terminaram
 * hoje, e as que terminaram hoje com envios em erro que ainda podem ser
 * tentados de novo (menos de MAX_TENTATIVAS, último erro há 30 min ou mais).
 * Repetir uma etapa não duplica: título já enviado é pulado.
 */
async function etapasDevidas(cfg: ConfigLembretes) {
  const agora = new Date();
  const hoje = isoDe(agora);
  const hhmm = `${dois(agora.getHours())}:${dois(agora.getMinutes())}`;
  const rodadas = (await ler<Record<string, string>>(CHAVE_RODADAS)) || {};
  const devidas = [];
  for (const e of cfg.etapas) {
    if (e.hora > hhmm) continue;
    if (rodadas[String(e.dias)] !== hoje) {
      devidas.push(e);
      continue;
    }
    const alvo = new Date();
    alvo.setDate(alvo.getDate() + e.dias);
    const comErro = await envioRepo()
      .createQueryBuilder("x")
      .where("x.dias_antes = :dias", { dias: e.dias })
      .andWhere("x.vencimento = :venc", { venc: isoDe(alvo) })
      .andWhere("x.situacao = 'erro'")
      .andWhere("x.tentativas < :max", { max: MAX_TENTATIVAS })
      .andWhere(`x.atualizado_em < NOW() - INTERVAL ${ESPERA_NOVA_TENTATIVA_MIN} MINUTE`)
      .getCount();
    if (comErro) devidas.push(e);
  }
  return { hoje, rodadas, devidas };
}

/** A cada 5 minutos: roda as etapas que chegaram no horário. */
export function agendarLembretes() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      if (rodando) return;
      const cfg = await lerLembretes();
      if (!cfg.ativo || !cfg.etapas.length) return;
      const { hoje, rodadas, devidas } = await etapasDevidas(cfg);
      if (!devidas.length) return;
      // Um envio longo (50 s por e-mail) não começa de novo: `rodando`
      // segura. A etapa só é marcada como feita no fim, então uma queda no
      // meio faz a próxima conferência continuar de onde parou.
      await rodarLembretes("agendamento", "automatico", devidas.map((e) => e.dias));
      for (const e of devidas) rodadas[String(e.dias)] = hoje;
      await gravar(CHAVE_RODADAS, rodadas, "automatico");
    } catch (e) {
      console.error("[Lembretes] erro no agendamento:", e);
    }
  });
  console.log("📅 Lembretes de boleto por e-mail: conferência a cada 5 minutos");
}

/** Últimos envios, para a engrenagem. */
export async function ultimosEnvios(limite = 30) {
  return envioRepo().find({ order: { atualizado_em: "DESC" }, take: limite });
}
