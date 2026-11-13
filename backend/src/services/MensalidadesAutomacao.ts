import cron from "node-cron";
import MkauthSource from "../database/MkauthSource";
import AppDataSource from "../database/DataSource";
import { MensalidadeConfig } from "../entities/MensalidadeConfig";
import { MensalidadeBolix } from "../entities/MensalidadeBolix";
import {
  bolixAtivos,
  canceladosManualmente,
  conferirPagamentosNaEfi,
  gerarBolix,
} from "./BolixEfi";
import { competenciaDoTitulo, ErroDeUso } from "./mkauthTitulos";
import {
  clientesComAutomatico,
  criarMensalidadesAutomaticas,
  ResultadoCriacao,
} from "./MensalidadesCriacao";

/**
 * Engrenagem da tela Mensalidades: geração automática do bolix da Efí.
 *
 * O MK-Auth continua criando as mensalidades. Com a geração ligada, a cada
 * minuto gera-se o bolix de todas as mensalidades a vencer, em aberto, que
 * ainda não têm (o boleto sai logo depois de a mensalidade ser criada, pelo
 * MK-Auth ou pelo Wip Diversos). Nunca se cobra o mesmo mês duas vezes:
 * - título com bolix ativo não ganha outro;
 * - se o cliente já tem a mesma competência (AAAA-MM) paga, seja num título
 *   do MK-Auth ou num bolix nosso, o título em aberto daquele mês é pulado
 *   (é duplicado no MK-Auth e aparece no resumo para alguém conferir).
 */

export interface ConfigGeracao {
  gerarBoletos: boolean;
  /**
   * Split do bolix: os serviços adicionais do título (atrelados "Valor
   * adicional: ...") vão inteiros para a conta Efí do parceiro; a mensalidade
   * fica na conta da Wip.
   */
  splitAdicionais: boolean;
  /** Identificador de conta Efí do parceiro que recebe os adicionais. */
  splitPayeeCode: string;
}

export const PAYEE_CODE_VALIDO = /^[A-Za-z0-9]{8,64}$/;

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
  erros: { login: string; titulo: number; erro: string }[];
  /** Mensalidades criadas nesta execução (clientes com o automático ligado). */
  titulosCriados?: ResultadoCriacao["criados"];
  /** Títulos de clientes com o automático desligado (ficaram de fora). */
  desligados?: number;
}

const CHAVE = "geracao_boletos";
const CHAVE_ULTIMA = "geracao_boletos_ultima";
/** Hora da última conferência automática (mesmo sem nada para gerar). */
const CHAVE_VERIFICACAO = "geracao_boletos_verificacao";
const LIMITE_POR_EXECUCAO = 2000;

export const CONFIG_PADRAO: ConfigGeracao = {
  gerarBoletos: false,
  splitAdicionais: false,
  splitPayeeCode: "",
};

const repo = () => AppDataSource.getRepository(MensalidadeConfig);

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
  // Só os campos atuais: "horario", "diasAntecedencia", "incluirVencidos",
  // "enviarEmail" e "criarIsentos" eram de versões antigas e ficam de fora.
  const salva = ((await ler<any>(CHAVE)) || {}) as any;
  return {
    gerarBoletos:
      salva.gerarBoletos === undefined ? CONFIG_PADRAO.gerarBoletos : salva.gerarBoletos === true,
    splitAdicionais: salva.splitAdicionais === true,
    splitPayeeCode: typeof salva.splitPayeeCode === "string" ? salva.splitPayeeCode : "",
  };
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
  if (entrada.splitPayeeCode !== undefined)
    nova.splitPayeeCode = String(entrada.splitPayeeCode || "").trim();
  if (entrada.splitAdicionais !== undefined)
    nova.splitAdicionais = entrada.splitAdicionais === true;
  if (nova.splitPayeeCode && !PAYEE_CODE_VALIDO.test(nova.splitPayeeCode))
    throw new ErroDeUso("payee_code inválido: use só letras e números (8 a 64).");
  if (nova.splitAdicionais && !nova.splitPayeeCode)
    throw new ErroDeUso("Informe o payee_code do parceiro para ligar o split.");
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
    erros: [],
  };
  try {
    // Primeiro as mensalidades que faltam dos clientes com o boleto
    // automático ativado, para o bolix delas sair já nesta execução.
    // Ver services/MensalidadesCriacao.ts.
    // Um erro aqui não impede os bolix dos outros clientes.
    try {
      const criacao = await criarMensalidadesAutomaticas(usuario);
      resumo.titulosCriados = criacao.criados;
      resumo.erros.push(...criacao.erros);
    } catch (e: any) {
      resumo.erros.push({
        login: "-",
        titulo: 0,
        erro: `criar mensalidades: ${String(e?.message || e).slice(0, 180)}`,
      });
    }

    // Janela: todas as mensalidades a vencer (sem prazo, como o MK-Auth).
    const janela = `FROM sis_lanc l
         JOIN sis_cliente c ON c.login = l.login AND c.cli_ativado = 's'
        WHERE l.deltitulo = 0 AND l.tipo = 'mensalidade'
          AND l.status IN ('aberto', 'vencido')
          AND l.datavenc >= CURDATE()`;
    // Só clientes com o boleto automático ligado na tela (padrão: desligado).
    // O filtro vai no SQL, antes do LIMIT: senão títulos de clientes
    // desligados ocupariam o limite e os ligados nunca seriam gerados.
    const ligados = Array.from(await clientesComAutomatico());
    const [{ n: naJanela }] = await MkauthSource.query(
      `SELECT COUNT(*) AS n ${janela}`,
      [],
    );
    const titulos: any[] = ligados.length
      ? await MkauthSource.query(
          `SELECT l.id, l.login, l.referencia, l.datavenc, l.valor, l.tipo,
                  c.nome, c.email
             ${janela} AND l.login IN (?)
            ORDER BY l.datavenc ASC, l.id ASC
            LIMIT ?`,
          [ligados, LIMITE_POR_EXECUCAO],
        )
      : [];
    const [{ n: dosLigados }] = ligados.length
      ? await MkauthSource.query(`SELECT COUNT(*) AS n ${janela} AND l.login IN (?)`, [
          ligados,
        ])
      : [{ n: 0 }];
    resumo.desligados = Math.max(0, Number(naJanela) - Number(dosLigados));
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
    // Só mensalidades a vencer: título com bolix ativo já está cobrado.
    // (O e-mail ao cliente sai pelos lembretes, não aqui.)
    const valeAinda = (t: any) => ativos.has(t.id);

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

    const processar = async ({ t }: { t: any }) => {
      try {
        await gerarBolix(t.id, "automatico");
        resumo.gerados++;
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
      origem === "agendamento" &&
      !resumo.gerados &&
      !resumo.erros.length &&
      !resumo.titulosCriados?.length;
    try {
      await gravar(CHAVE_VERIFICACAO, resumo.fim, usuario);
      // A conferência de minuto em minuto sem nada para fazer não apaga o
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
 * geração ligada, a cada minuto gera o que faltar. Repetir não duplica:
 * título com bolix válido e mês já pago ficam de fora.
 */
export function agendarGeracaoDeBoletos() {
  setTimeout(() => conferirPagamentos("início"), 30_000);
  cron.schedule("*/5 * * * *", () => conferirPagamentos("agendamento"));
  cron.schedule("* * * * *", async () => {
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
    "📅 Bolix das mensalidades: pagamentos na Efí a cada 5 minutos, geração a cada minuto",
  );
  if (!process.env.EFI_BOLIX_NOTIFICACAO_URL)
    console.warn(
      "⚠️ EFI_BOLIX_NOTIFICACAO_URL vazio: os bolix saem sem aviso de pagamento da Efí; a baixa fica só na conferência a cada 5 minutos.",
    );
}
