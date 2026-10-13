import MkauthSource from "../database/MkauthSource";
import {
  TAGS_SERVICO,
  sqlTagServico,
} from "../services/servicosAdicionaisNomes";

/**
 * Valor a cobrar de uma fatura do MKAuth. Regra única para todos os canais
 * que geram cobrança de mensalidade: Pix (site e atendente), bot do WhatsApp,
 * totem e Pix Automático.
 *
 * - Base: valor da mensalidade (`sis_lanc.valor`, o valor bruto do plano)
 *   menos o desconto do cadastro do cliente, mais os serviços adicionais do
 *   contrato (Watch TV e câmeras, em `sis_sercontratos`). É a mesma conta que
 *   o MKAuth faz ao montar o boleto.
 * - Até o vencimento (inclusive): a base.
 * - Em atraso: multa de 2% + juros de 0,033% ao dia sobre a base, contados só
 *   depois de 4 dias de tolerância.
 */
export const MULTA_ATRASO = 0.02;
export const JUROS_DIA = 0.00033;
export const DIAS_TOLERANCIA_JUROS = 4;

function semHorario(data: Date | string): Date {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function valorAtualizadoFatura(
  valor: string | number,
  dataVenc: Date | string,
  hoje: Date = new Date(),
): number {
  const original = Number(valor);
  const vencimento = semHorario(dataVenc);
  const dia = semHorario(hoje);

  if (vencimento.getTime() >= dia.getTime()) {
    return Number(original.toFixed(2));
  }

  const umDia = 24 * 60 * 60 * 1000;
  const diasAtraso = Math.floor((dia.getTime() - vencimento.getTime()) / umDia);

  const multa = original * MULTA_ATRASO;
  const juros =
    diasAtraso > DIAS_TOLERANCIA_JUROS
      ? original * (diasAtraso - DIAS_TOLERANCIA_JUROS) * JUROS_DIA
      : 0;

  return Number((original + multa + juros).toFixed(2));
}

/** Desconto do cadastro e soma dos serviços adicionais de um login. */
async function ajustesDoCadastro(
  login: string,
): Promise<{ desconto: number; servicos: number }> {
  const [cliente] = (await MkauthSource.query(
    `SELECT desconto FROM sis_cliente WHERE login = ? LIMIT 1`,
    [login],
  )) as { desconto: any }[];

  const tags = TAGS_SERVICO.map(() => "?").join(", ");
  const [servicos] = (await MkauthSource.query(
    `SELECT COALESCE(SUM(valor), 0) AS total FROM sis_sercontratos
     WHERE UPPER(TRIM(login)) = UPPER(TRIM(?))
       AND ${sqlTagServico("nome")} IN (${tags})`,
    [login, ...TAGS_SERVICO],
  )) as { total: any }[];

  return {
    desconto: Number(cliente?.desconto || 0),
    servicos: Number(servicos?.total || 0),
  };
}

/**
 * Mensalidade do cliente sem multa nem juros:
 * valor da mensalidade - desconto do cadastro + serviços (Watch TV/câmeras).
 */
export async function valorMensalidadeCliente(
  valor: string | number,
  login: string,
): Promise<number> {
  const { desconto, servicos } = await ajustesDoCadastro(login);
  const total = Math.max(Number(valor) - desconto + servicos, 0);
  return Number(total.toFixed(2));
}

/** Mensalidade do cliente com multa e juros, se a fatura estiver em atraso. */
export async function valorCobrancaFatura(
  valor: string | number,
  login: string,
  dataVenc: Date | string,
  hoje: Date = new Date(),
): Promise<number> {
  const base = await valorMensalidadeCliente(valor, login);
  return valorAtualizadoFatura(base, dataVenc, hoje);
}
