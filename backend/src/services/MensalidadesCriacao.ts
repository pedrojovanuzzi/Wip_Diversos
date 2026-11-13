import MkauthSource from "../database/MkauthSource";
import AppDataSource from "../database/DataSource";
import { MensalidadeBolix } from "../entities/MensalidadeBolix";
import { MensalidadeCliente } from "../entities/MensalidadeCliente";
import { MensalidadeTituloCriado } from "../entities/MensalidadeTituloCriado";
import {
  Autor,
  competenciaDoTitulo,
  dois,
  inserirTituloMk,
  recalcularAbertos,
  registrarAtividade,
} from "./mkauthTitulos";

/**
 * Duas coisas da engrenagem da tela Mensalidades:
 *
 * 1. Interruptor "boleto automático" por cliente (mensalidade_cliente).
 *    Começa DESLIGADO para todos: só quem tem automatico = 1 entra na
 *    engrenagem (mensalidade, bolix e lembrete por e-mail). Liga-se na
 *    página do cliente ou marcando vários na lista.
 *
 * 2. Mensalidade de quem tem o boleto automático ativado, isento no MK-Auth
 *    ou não: o interruptor é o que decide. O cliente fica com N mensalidades
 *    a vencer em aberto, como o robô do MK-Auth (mk-bot, opção auto_titulos)
 *    faz, e o resto da engrenagem gera o bolix delas. Título que o mk-bot já
 *    criou conta como o mês cobrado. Contra duplicar (o mk-bot continua
 *    ligado):
 *    - não cria se o cliente já tem título vivo daquele mês (qualquer
 *      status, criado por qualquer um), pela referência ou pelo vencimento;
 *    - não cria se o mês já foi pago num bolix nosso;
 *    - o mês é reservado em mensalidade_titulo_criado (chave única
 *      login + competência) antes de gravar, para dois processos não criarem
 *      juntos. Se o título que criamos foi excluído, a reserva é retomada e o
 *      mês volta, como o mk-bot faz; para parar de cobrar, desative o boleto
 *      automático do cliente;
 *    - a checagem de título vivo é refeita dentro da transação, logo antes
 *      de gravar, para não correr junto com o mk-bot.
 */

const AUTOR: Autor = { usuario: "wipdiversos", ip: "" };
const clienteRepo = () => AppDataSource.getRepository(MensalidadeCliente);
const criadoRepo = () => AppDataSource.getRepository(MensalidadeTituloCriado);

const iso = (d: Date) =>
  `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

// ---------- interruptor por cliente ----------

/** Logins com o automático LIGADO (todos, ou só dos logins pedidos). */
export async function clientesComAutomatico(logins?: string[]) {
  const q = clienteRepo()
    .createQueryBuilder("c")
    .select("c.login", "login")
    .where("c.automatico = 1");
  if (logins) {
    if (!logins.length) return new Set<string>();
    q.andWhere("c.login IN (:...logins)", { logins });
  }
  const linhas: { login: string }[] = await q.getRawMany();
  return new Set(linhas.map((l) => String(l.login)));
}

export async function automaticoDoCliente(login: string) {
  const c = await clienteRepo().findOne({ where: { login } });
  return {
    automatico: c ? c.automatico === 1 : false,
    atualizadoPor: c?.atualizado_por || null,
    atualizadoEm: c?.atualizado_em || null,
  };
}

export async function definirAutomatico(
  login: string,
  automatico: boolean,
  usuario: string,
) {
  await clienteRepo().save({
    login,
    automatico: automatico ? 1 : 0,
    atualizado_por: usuario,
  });
  return automaticoDoCliente(login);
}

/** Liga ou desliga o automático de vários clientes de uma vez. */
export async function definirAutomaticoVarios(
  logins: string[],
  automatico: boolean,
  usuario: string,
) {
  const unicos = Array.from(new Set(logins.map(String).filter(Boolean)));
  for (let i = 0; i < unicos.length; i += 500) {
    const lote = unicos.slice(i, i + 500);
    await clienteRepo()
      .createQueryBuilder()
      .insert()
      .values(lote.map((login) => ({ login, automatico: automatico ? 1 : 0, atualizado_por: usuario })))
      .orUpdate(["automatico", "atualizado_por"], ["login"])
      .execute();
  }
  return unicos.length;
}

// ---------- mensalidades do boleto automático ----------

export interface ResultadoCriacao {
  criados: { login: string; titulo: number; competencia: string; vencimento: string; valor: number }[];
  erros: { login: string; titulo: number; erro: string }[];
}

/** Vencimento no dia `dia` do mês `hoje + k`, ajustado ao fim do mês. */
function vencimentoDoMes(dia: number, hoje: Date, k: number) {
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + k + 1, 0).getDate();
  return new Date(hoje.getFullYear(), hoje.getMonth() + k, Math.min(dia, ultimo));
}

/** Mês cobrado (AAAA-MM) por um vencimento, pelo mesref do cliente. */
function competenciaDe(venc: Date, mesref: string) {
  const ref = new Date(venc.getFullYear(), venc.getMonth() - (mesref === "ant" ? 1 : 0), 1);
  return `${ref.getFullYear()}-${dois(ref.getMonth() + 1)}`;
}

/** Até onde procurar meses à frente (o MK-Auth usa poucos títulos). */
const MESES_A_FRENTE = 24;

/**
 * Quantas mensalidades em aberto manter, a mesma opção do robô do MK-Auth
 * ("auto_titulos", 3 por padrão).
 */
async function titulosParaManter() {
  const [o] = await MkauthSource.query(
    `SELECT valor FROM sis_opcao WHERE nome = 'auto_titulos' LIMIT 1`,
  );
  const n = Math.floor(Number(o?.valor));
  return n >= 1 && n <= 12 ? n : 3;
}

/**
 * Como o robô do MK-Auth faz: cada cliente ativo com o boleto automático
 * ativado fica sempre com N mensalidades a vencer em
 * aberto (N = auto_titulos). Anda mês a mês a partir do próximo vencimento:
 * mês com título em aberto conta; mês pago (título ou bolix) não conta e é
 * pulado; mês vazio é criado. Para quando chega a N. Mensalidade em atraso
 * não conta (é dívida de antes), então não segura as próximas.
 *
 * Dois processos juntos param no mesmo ponto: o mês que o outro está
 * criando (reserva ocupada) conta como em aberto.
 */
export async function criarMensalidadesAutomaticas(
  usuario: string,
): Promise<ResultadoCriacao> {
  const resultado: ResultadoCriacao = { criados: [], erros: [] };
  const clientes: any[] = await MkauthSource.query(
    `SELECT c.login, c.venc, c.mesref, c.desconto, c.acrescimo, p.valor AS valor_plano
       FROM sis_cliente c JOIN sis_plano p ON p.nome = c.plano
      WHERE c.cli_ativado = 's'`,
  );
  if (!clientes.length) return resultado;
  const ligados = await clientesComAutomatico(clientes.map((c) => c.login));
  if (!ligados.size) return resultado;
  const manter = await titulosParaManter();

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  for (const c of clientes) {
    const login = String(c.login);
    if (!ligados.has(login)) continue;
    // Um cliente com problema (consulta que falhou etc.) não derruba os
    // outros nem a geração dos bolix: vira erro no resumo.
    try {
      const dia = Number(c.venc);
      if (!(dia >= 1 && dia <= 31)) continue;
      const valor =
        Math.round(
          (Number(c.valor_plano || 0) - Number(c.desconto || 0) + Number(c.acrescimo || 0)) * 100,
        ) / 100;
      if (valor <= 0) continue;

      let emAberto = 0;
      for (let k = 0; k <= MESES_A_FRENTE && emAberto < manter; k++) {
        const venc = vencimentoDoMes(dia, hoje, k);
        if (venc < hoje) continue;
        const competencia = competenciaDe(venc, c.mesref);
        const vencIso = iso(venc);

        // Já tem título vivo do mês (de quem quer que seja)?
        const situacao = await situacaoDoMes(MkauthSource, login, competencia, vencIso);
        if (situacao === "aberto") {
          emAberto++;
          continue;
        }
        if (situacao === "pago") continue;
        // Já pago num bolix nosso?
        const pago = await AppDataSource.getRepository(MensalidadeBolix).count({
          where: { login_cliente: login, competencia, situacao: "pago" },
        });
        if (pago) continue;

        const reserva = await reservarMes(login, competencia, vencIso, valor);
        if (!reserva) {
          // Outro processo está criando este mês agora.
          emAberto++;
          continue;
        }

        try {
          let tituloId = 0;
          await MkauthSource.transaction(async (m) => {
            if (await situacaoDoMes(m, login, competencia, vencIso)) return;
            const r = await inserirTituloMk(m, login, vencIso, "mensalidade", valor, "", "wipdiversos");
            tituloId = r.id;
            await registrarAtividade(
              m,
              AUTOR,
              `wip diversos criou a mensalidade ${r.referencia} do cliente ${login.toLowerCase()}`,
            );
            await recalcularAbertos(m, login);
          });
          if (!tituloId) {
            // O mk-bot (ou alguém) criou o mês entre a checagem e a transação.
            await criadoRepo().delete({ id: reserva.id });
            emAberto++;
            continue;
          }
          await criadoRepo().update({ id: reserva.id }, { titulo_id: tituloId });
          emAberto++;
          resultado.criados.push({ login, titulo: tituloId, competencia, vencimento: vencIso, valor });
          console.log(`[Mensalidades] ${usuario}: mensalidade ${competencia} de ${login} criada (título ${tituloId}).`);
        } catch (e: any) {
          // Falhou: libera o mês para tentar de novo na próxima conferência
          // e não cria os meses depois dele fora de ordem.
          await criadoRepo().delete({ id: reserva.id }).catch(() => undefined);
          resultado.erros.push({
            login,
            titulo: 0,
            erro: `criar mensalidade ${competencia}: ${String(e?.message || e).slice(0, 180)}`,
          });
          break;
        }
      }
    } catch (e: any) {
      resultado.erros.push({
        login,
        titulo: 0,
        erro: `mensalidade automática: ${String(e?.message || e).slice(0, 180)}`,
      });
    }
  }
  return resultado;
}

/**
 * Reserva o mês do cliente antes de criar. A chave única impede dois
 * processos de criarem juntos. Se já existe reserva:
 * - sem título (outro processo criando agora) → não mexe; presa há mais de
 *   10 minutos (queda no meio da criação) → retoma;
 * - com título vivo a vencer → já está cobrado, não mexe;
 * - com título excluído, ou já vencido → retoma a reserva (UPDATE
 *   condicional: só um processo consegue) e o mês é criado de novo.
 */
async function reservarMes(
  login: string,
  competencia: string,
  vencIso: string,
  valor: number,
): Promise<MensalidadeTituloCriado | null> {
  try {
    return await criadoRepo().save({
      login,
      competencia,
      vencimento: vencIso,
      valor: valor.toFixed(2),
      titulo_id: null,
    });
  } catch (e: any) {
    if (!(e?.code === "ER_DUP_ENTRY" || /Duplicate entry/i.test(String(e?.message))))
      throw e;
  }
  const atual = await criadoRepo().findOne({ where: { login, competencia } });
  if (!atual) return null;
  const retomar = async (onde: string, p: Record<string, unknown>) => {
    const r = await criadoRepo()
      .createQueryBuilder()
      .update()
      .set({
        titulo_id: null,
        vencimento: vencIso,
        valor: valor.toFixed(2),
        // criado_em marca quando o mês foi (re)reservado: é por ele que se
        // reconhece uma reserva presa.
        criado_em: () => "CURRENT_TIMESTAMP(6)",
      })
      .where(`id = :id AND ${onde}`, { id: atual.id, ...p })
      .execute();
    if (!r.affected) return null;
    return { ...atual, titulo_id: null, vencimento: vencIso, valor: valor.toFixed(2) };
  };
  if (!atual.titulo_id) {
    // Sem título: outro processo está criando agora, ou um reinício/queda
    // deixou a reserva para trás. Presa há mais de 10 minutos (a criação
    // leva segundos), é retomada; senão o mês ficaria bloqueado para sempre.
    return retomar(
      "titulo_id IS NULL AND criado_em < CURRENT_TIMESTAMP(6) - INTERVAL 10 MINUTE",
      {},
    );
  }
  // O título que criamos ainda cobra o mês se está vivo e a vencer. Excluído,
  // ou com o vencimento passado para antes de hoje (virou atraso), o mês
  // volta a ser criado.
  const [t] = await MkauthSource.query(
    `SELECT deltitulo = 1 OR datavenc < CURDATE() AS livre
       FROM sis_lanc WHERE id = ? LIMIT 1`,
    [atual.titulo_id],
  );
  if (t && Number(t.livre) !== 1) return null;
  return retomar("titulo_id = :tid", { tid: atual.titulo_id });
}

/**
 * Situação do mês pelos títulos vivos (referência ou vencimento): "aberto"
 * se algum está em aberto, "pago" se só há pagos, null se não há título.
 */
async function situacaoDoMes(
  q: { query: (sql: string, p?: any[]) => Promise<any> },
  login: string,
  competencia: string,
  vencIso: string,
) {
  const titulos: any[] = await q.query(
    `SELECT referencia, datavenc, status FROM sis_lanc
      WHERE login = ? AND deltitulo = 0 AND tipo = 'mensalidade'
        AND datavenc >= ? - INTERVAL 75 DAY AND datavenc <= ? + INTERVAL 75 DAY`,
    [login, vencIso, vencIso],
  );
  const mesVenc = vencIso.slice(0, 7);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const doMes = titulos.filter((t) => {
    const d = new Date(t.datavenc);
    const mes = Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${dois(d.getMonth() + 1)}`;
    if (mes === mesVenc) return true;
    // Pela referência, só título a vencer: mensalidade em atraso é dívida
    // de antes e não segura a do próximo mês (mesmo que a referência dela
    // diga o mês novo, como quando o vencimento foi alterado para trás).
    return competenciaDoTitulo(t) === competencia && d >= hoje;
  });
  if (!doMes.length) return null;
  return doMes.some((t) => t.status !== "pago") ? "aberto" : "pago";
}
