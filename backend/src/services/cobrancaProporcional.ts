/**
 * Cobrança proporcional de serviços que entram na mensalidade.
 *
 * Serviços como a Watch TV não são cobrados à parte: o valor cheio passa a
 * compor a mensalidade do cliente, e no primeiro mês entra só a fração dos
 * dias que ele vai usar até o próximo vencimento.
 *
 * Fonte única do cálculo — bot e site chamam daqui para não divergirem.
 */

/**
 * Divisor de dias para converter mensalidade em valor diário.
 *
 * Mesma regra da Calculadora de Débitos: o mês vale 30 dias, qualquer que
 * seja o mês real.
 */
export const DIAS_BASE_MENSALIDADE = 30;

export type CobrancaProporcional = {
  /** Dias de uso entre a contratação e o próximo vencimento. */
  dias: number;
  /** Valor proporcional a esses dias, já arredondado. */
  valor: number;
  /** Mensalidade cheia, cobrada a partir da fatura seguinte. */
  valorMensal: number;
  /** Vencimento em que o proporcional entra. */
  vencimento: Date;
  /** Dia do vencimento usado no cálculo. */
  diaVencimento: number;
};

/** Zera a hora para as contas ficarem em dias inteiros. */
function soData(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

/** Último dia do mês — vencimento 31 em fevereiro cai no dia 28/29. */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}

/**
 * Próximo vencimento depois de `hoje`.
 *
 * Quando a contratação cai no próprio dia do vencimento, a fatura daquele dia
 * já está fechada: o proporcional vai para o vencimento do mês seguinte.
 */
export function proximoVencimento(diaVencimento: number, hoje = new Date()): Date {
  const base = soData(hoje);
  const dia = Math.min(Math.max(Number(diaVencimento) || 1, 1), 31);

  const noMes = (ano: number, mes: number) =>
    new Date(ano, mes, Math.min(dia, ultimoDiaDoMes(ano, mes)));

  const desteMes = noMes(base.getFullYear(), base.getMonth());
  if (desteMes.getTime() > base.getTime()) return desteMes;
  return noMes(base.getFullYear(), base.getMonth() + 1);
}

/** Diferença em dias inteiros (intervalo, não contagem inclusiva). */
function diasEntre(inicio: Date, fim: Date): number {
  const MS_DIA = 24 * 60 * 60 * 1000;
  return Math.round((soData(fim).getTime() - soData(inicio).getTime()) / MS_DIA);
}

/**
 * Quanto entra na próxima fatura por um serviço contratado hoje.
 *
 * O proporcional nunca passa da mensalidade cheia: vencimentos distantes mais
 * de 30 dias (fevereiro para dia 31, por exemplo) não geram cobrança maior do
 * que um mês de serviço.
 */
export function cobrancaProporcional(
  valorMensal: number,
  diaVencimento: number,
  hoje = new Date(),
): CobrancaProporcional {
  const vencimento = proximoVencimento(diaVencimento, hoje);
  const dias = Math.max(0, diasEntre(hoje, vencimento));
  const mensal = Number(valorMensal) || 0;
  const bruto = dias * (mensal / DIAS_BASE_MENSALIDADE);
  const valor = Math.round(Math.min(bruto, mensal) * 100) / 100;

  return {
    dias,
    valor,
    valorMensal: mensal,
    vencimento,
    diaVencimento: vencimento.getDate(),
  };
}

/** "49,90" — real no padrão brasileiro, sem prefixo. */
export function reais(valor: number): string {
  return (Number(valor) || 0).toFixed(2).replace(".", ",");
}

/** "09/09/2026" */
export function dataBR(data: Date): string {
  return [
    String(data.getDate()).padStart(2, "0"),
    String(data.getMonth() + 1).padStart(2, "0"),
    data.getFullYear(),
  ].join("/");
}

/**
 * Frase única usada no bot e no site, para o cliente ler a mesma coisa nos
 * dois canais.
 */
export function textoCobrancaProporcional(c: CobrancaProporcional): string {
  return (
    `R$ ${reais(c.valor)} na fatura de ${dataBR(c.vencimento)} ` +
    `(${c.dias} ${c.dias === 1 ? "dia" : "dias"} de uso), ` +
    `e R$ ${reais(c.valorMensal)} por mês nas seguintes.`
  );
}
