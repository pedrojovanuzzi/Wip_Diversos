/**
 * Valor a cobrar de uma fatura do MKAuth na data de hoje. Usado pelo totem e
 * pelo bot do WhatsApp — antes cada um calculava do seu jeito e o cliente via
 * valores diferentes para a mesma fatura.
 *
 * - O desconto do cadastro do cliente NÃO é aplicado.
 * - Até o vencimento (inclusive): valor original.
 * - Em atraso: multa de 2% + juros de 0,033% ao dia, contados só depois de
 *   4 dias de tolerância.
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
