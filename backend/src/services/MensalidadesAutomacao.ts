import cron from "node-cron";
import MkauthSource from "../database/MkauthSource";
import AppDataSource from "../database/DataSource";
import { MensalidadeConfig } from "../entities/MensalidadeConfig";
import { MensalidadeBolix } from "../entities/MensalidadeBolix";
import Email from "../controller/Email";
import {
  bolixAtivos,
  canceladosManualmente,
  conferirPagamentosNaEfi,
  gerarBolix,
} from "./BolixEfi";
import { competenciaDoTitulo, dois, ErroDeUso } from "./mkauthTitulos";

/**
 * Engrenagem da tela Mensalidades: geração automática do bolix da Efí.
 *
 * O MK-Auth continua criando as mensalidades. Com a geração ligada, a cada
 * 10 minutos gera-se o bolix das mensalidades em aberto que ainda não têm,
 * dentro dos dias de antecedência (o boleto sai logo depois de o MK-Auth
 * criar a mensalidade). Nunca se cobra o mesmo mês duas vezes:
 * - título com bolix ativo não ganha outro;
 * - se o cliente já tem a mesma competência (AAAA-MM) paga, seja num título
 *   do MK-Auth ou num bolix nosso, o título em aberto daquele mês é pulado
 *   (é duplicado no MK-Auth e aparece no resumo para alguém conferir).
 */

export interface ConfigGeracao {
  gerarBoletos: boolean;
  /** Gera para mensalidades que vencem até N dias à frente. */
  diasAntecedencia: number;
  /** Também gera para mensalidades já vencidas (vencem hoje, com juros). */
  incluirVencidos: boolean;
  /** Manda o bolix por e-mail ao cliente quando gera. */
  enviarEmail: boolean;
}

export interface ResumoExecucao {
  inicio: string;
  fim: string;
  origem: string;
  usuario: string;
  analisados: number;
  gerados: number;
  jaTinham: number;
  /** Pulados: mês já pago, ou já cobrado em outro título do mesmo mês. */
  mesPago: {
    login: string;
    titulo: number;
    competencia: string;
    motivo?: "pago" | "cobrado" | "cancelado";
  }[];
  emails: number;
  erros: { login: string; titulo: number; erro: string }[];
}

const CHAVE = "geracao_boletos";
const CHAVE_ULTIMA = "geracao_boletos_ultima";
/** Hora da última conferência automática (mesmo sem nada para gerar). */
const CHAVE_VERIFICACAO = "geracao_boletos_verificacao";
const LIMITE_POR_EXECUCAO = 2000;

export const CONFIG_PADRAO: ConfigGeracao = {
  gerarBoletos: false,
  diasAntecedencia: 10,
  incluirVencidos: false,
  enviarEmail: false,
};

const repo = () => AppDataSource.getRepository(MensalidadeConfig);

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
};

async function ler<T>(chave: string): Promise<T | null> {
  const r = await repo().findOne({ where: { chave } });
  if (!r) return null;
  try {
    return JSON.parse(r.valor) as T;
  } catch {
    return null;
  }
}

async function gravar(chave: string, valor: unknown, usuario: string | null) {
  await repo().save({
    chave,
    valor: JSON.stringify(valor),
    atualizado_por: usuario,
  });
}

export async function lerConfig(): Promise<ConfigGeracao> {
  // "horario" era da versão que rodava uma vez por dia: fica de fora.
  const { horario: _antigo, ...salva } = ((await ler<any>(CHAVE)) || {}) as any;
  return { ...CONFIG_PADRAO, ...salva };
}

export async function ultimaExecucao() {
  return ler<ResumoExecucao>(CHAVE_ULTIMA);
}

/** Quando a conferência automática rodou pela última vez (ISO). */
export async function ultimaVerificacao() {
  return ler<string>(CHAVE_VERIFICACAO);
}

export async function salvarConfig(
  entrada: Partial<ConfigGeracao>,
  usuario: string,
): Promise<ConfigGeracao> {
  const atual = await lerConfig();
  const nova: ConfigGeracao = { ...atual };
  if (entrada.gerarBoletos !== undefined)
    nova.gerarBoletos = entrada.gerarBoletos === true;
  if (entrada.incluirVencidos !== undefined)
    nova.incluirVencidos = entrada.incluirVencidos === true;
  if (entrada.enviarEmail !== undefined)
    nova.enviarEmail = entrada.enviarEmail === true;
  if (entrada.diasAntecedencia !== undefined) {
    const n = Math.floor(Number(entrada.diasAntecedencia));
    if (!Number.isFinite(n) || n < 0 || n > 60)
      throw new ErroDeUso("Dias de antecedência: de 0 a 60.");
    nova.diasAntecedencia = n;
  }
  await gravar(CHAVE, nova, usuario);
  return nova;
}

let rodando = false;
/** Andamento da execução atual, para a engrenagem mostrar "7 de 9". */
let progresso = { total: 0, feitos: 0 };
// O sandbox da Efí leva ~20 s por cobrança; três de cada vez.
const SIMULTANEOS = 3;

export function situacaoGeracao() {
  return { rodando, ...progresso };
}

/** Gera os bolix que faltam. `origem` e `usuario` vão para o resumo. */
export async function rodarGeracao(
  origem: string,
  usuario: string,
): Promise<ResumoExecucao> {
  if (rodando) throw new ErroDeUso("A geração já está rodando.");
  rodando = true;
  progresso = { total: 0, feitos: 0 };
  const cfg = await lerConfig();
  const resumo: ResumoExecucao = {
    inicio: new Date().toISOString(),
    fim: "",
    origem,
    usuario,
    analisados: 0,
    gerados: 0,
    jaTinham: 0,
    mesPago: [],
    emails: 0,
    erros: [],
  };
  try {
    const titulos: any[] = await MkauthSource.query(
      `SELECT l.id, l.login, l.referencia, l.datavenc, l.valor, l.tipo,
              c.nome, c.email
         FROM sis_lanc l
         JOIN sis_cliente c ON c.login = l.login AND c.cli_ativado = 's'
        WHERE l.deltitulo = 0 AND l.tipo = 'mensalidade'
          AND l.status IN ('aberto', 'vencido')
          AND l.datavenc < CURDATE() + INTERVAL ? DAY
          ${cfg.incluirVencidos ? "" : "AND l.datavenc >= CURDATE()"}
        ORDER BY l.datavenc ASC, l.id ASC
        LIMIT ?`,
      [cfg.diasAntecedencia + 1, LIMITE_POR_EXECUCAO],
    );
    resumo.analisados = titulos.length;
    if (!titulos.length) return resumo;

    const logins = Array.from(new Set(titulos.map((t) => t.login)));

    // Meses já pagos por cliente: títulos pagos no MK-Auth e bolix pagos.
    const pagos: any[] = await MkauthSource.query(
      `SELECT login, referencia, datavenc FROM sis_lanc
        WHERE login IN (?) AND deltitulo = 0 AND tipo = 'mensalidade'
          AND status = 'pago' AND datavenc >= CURDATE() - INTERVAL 400 DAY`,
      [logins],
    );
    const mesesPagos = new Set(
      pagos.map((p) => `${p.login}|${competenciaDoTitulo(p)}`),
    );
    const bolixPagos = await AppDataSource.getRepository(MensalidadeBolix)
      .createQueryBuilder("b")
      .select(["b.login_cliente", "b.competencia"])
      .where("b.login_cliente IN (:...logins)", { logins })
      .andWhere("b.situacao = 'pago'")
      .andWhere("b.competencia IS NOT NULL")
      .getMany();
    for (const b of bolixPagos)
      mesesPagos.add(`${b.login_cliente}|${b.competencia}`);

    const ativos = await bolixAtivos(titulos.map((t) => t.id));
    // Boleto cancelado pelo botão na tela: não volta sozinho.
    const cancelados = await canceladosManualmente(titulos.map((t) => t.id));
    const [provedor] = await MkauthSource.query(
      `SELECT nome FROM sis_provedor LIMIT 1`,
    );
    const email = cfg.enviarEmail ? new Email() : null;

    // Bolix ativo que já venceu: com "incluir vencidas", é refeito no dia
    // (vence hoje, com multa e juros); sem isso o cliente ficaria com um
    // boleto vencido na mão.
    const hoje = hojeIso();
    const valeAinda = (t: any) => {
      const b = ativos.get(t.id);
      if (!b) return false;
      return !cfg.incluirVencidos || String(b.vencimento).slice(0, 10) >= hoje;
    };

    // Mês já cobrado num bolix ainda válido de outro título do cliente.
    const cobrados = new Set<string>();
    for (const t of titulos)
      if (valeAinda(t)) cobrados.add(`${t.login}|${competenciaDoTitulo(t)}`);

    const fila: { t: any; competencia: string }[] = [];
    for (const t of titulos) {
      if (valeAinda(t)) {
        resumo.jaTinham++;
        continue;
      }
      const competencia = competenciaDoTitulo(t);
      const chave = `${t.login}|${competencia}`;
      if (cancelados.has(t.id)) {
        resumo.mesPago.push({ login: t.login, titulo: t.id, competencia, motivo: "cancelado" });
        continue;
      }
      if (competencia && mesesPagos.has(chave)) {
        resumo.mesPago.push({ login: t.login, titulo: t.id, competencia, motivo: "pago" });
        continue;
      }
      if (competencia && cobrados.has(chave)) {
        resumo.mesPago.push({ login: t.login, titulo: t.id, competencia, motivo: "cobrado" });
        continue;
      }
      // Marca já aqui: outro título do mesmo mês nesta execução fica de fora.
      // (Um título com bolix vencido é ele mesmo: não conta como "cobrado".)
      if (competencia) cobrados.add(chave);
      fila.push({ t, competencia });
    }
    progresso.total = fila.length;

    const processar = async ({ t, competencia }: { t: any; competencia: string }) => {
      try {
        const b = await gerarBolix(t.id, "automatico");
        resumo.gerados++;
        const para = String(t.email || "").trim();
        if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) {
          const [a, m] = competencia.split("-");
          const venc = new Date(`${b.vencimento}T12:00:00`).toLocaleDateString("pt-BR");
          const valor = Number(b.valor).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          });
          const linhas = [
            `Olá, ${t.nome}.`,
            "",
            `Sua mensalidade${a ? ` de ${m}/${a}` : ""} vence em ${venc}, no valor de R$ ${valor}.`,
            "",
            b.link ? `Boleto: ${b.link}` : "",
            b.linha_digitavel ? `Linha digitável: ${b.linha_digitavel}` : "",
            b.pix_copia_cola ? `Pix copia e cola: ${b.pix_copia_cola}` : "",
            "",
            "Se já pagou, desconsidere esta mensagem.",
            provedor?.nome || "",
          ].filter((l, i, arr) => l !== "" || arr[i - 1] !== "");
          try {
            await email.sendEmail(
              para,
              `${provedor?.nome || "Wip Telecom"} - boleto da mensalidade`,
              linhas.join("\n"),
            );
            resumo.emails++;
          } catch (e: any) {
            resumo.erros.push({
              login: t.login,
              titulo: t.id,
              erro: `e-mail: ${String(e?.message || e).slice(0, 150)}`,
            });
          }
        }
      } catch (e: any) {
        if (resumo.erros.length < 200)
          resumo.erros.push({
            login: t.login,
            titulo: t.id,
            erro: String(e?.message || e).slice(0, 200),
          });
      } finally {
        progresso.feitos++;
      }
    };

    let proximo = 0;
    await Promise.all(
      Array.from({ length: Math.min(SIMULTANEOS, fila.length) }, async () => {
        while (proximo < fila.length) await processar(fila[proximo++]);
      }),
    );
    return resumo;
  } finally {
    resumo.fim = new Date().toISOString();
    rodando = false;
    const semNovidade =
      origem === "agendamento" && !resumo.gerados && !resumo.erros.length;
    try {
      await gravar(CHAVE_VERIFICACAO, resumo.fim, usuario);
      // A conferência de 10 em 10 minutos sem nada para fazer não apaga o
      // resumo da última vez que algo foi gerado.
      if (!semNovidade) await gravar(CHAVE_ULTIMA, resumo, usuario);
    } catch (e) {
      console.error("[Mensalidades] não gravou o resumo da geração:", e);
    }
    if (!semNovidade)
      console.log(
        `🧾 Bolix automático (${origem}): ${resumo.gerados} gerados, ${resumo.jaTinham} já tinham, ${resumo.mesPago.length} pulados, ${resumo.erros.length} erros.`,
      );
  }
}

async function conferirPagamentos(quando: string) {
  try {
    const r = await conferirPagamentosNaEfi();
    if (r.baixados)
      console.log(`💰 Bolix (${quando}): ${r.baixados} pagos baixados no MK-Auth.`);
  } catch (e) {
    console.error(`[Mensalidades] erro ao conferir pagamentos na Efí (${quando}):`, e);
  }
}

/**
 * A cada 5 minutos confere na Efí os bolix pagos (mesmo com a geração
 * desligada: é o que garante a baixa se o aviso da Efí não chegar). Com a
 * geração ligada, a cada 10 minutos gera o que faltar. Repetir não duplica:
 * título com bolix válido e mês já pago ficam de fora.
 */
export function agendarGeracaoDeBoletos() {
  setTimeout(() => conferirPagamentos("início"), 30_000);
  cron.schedule("*/5 * * * *", () => conferirPagamentos("agendamento"));
  cron.schedule("*/10 * * * *", async () => {
    try {
      if (rodando) return;
      const cfg = await lerConfig();
      if (!cfg.gerarBoletos) return;
      await rodarGeracao("agendamento", "automatico");
    } catch (e) {
      console.error("[Mensalidades] erro na geração automática de boletos:", e);
    }
  });
  console.log(
    "📅 Bolix das mensalidades: pagamentos na Efí a cada 5 minutos, geração a cada 10",
  );
  if (!process.env.EFI_BOLIX_NOTIFICACAO_URL)
    console.warn(
      "⚠️ EFI_BOLIX_NOTIFICACAO_URL vazio: os bolix saem sem aviso de pagamento da Efí; a baixa fica só na conferência a cada 5 minutos.",
    );
}
