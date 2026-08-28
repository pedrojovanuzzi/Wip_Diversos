/**
 * Calculadora de Débitos — reproduz a planilha CALCULADORA_WIPTELECOM_CLIENTES.
 *
 * Apura quantos dias entram na próxima fatura de um cliente que ficou suspenso e
 * pagou para reativar o sinal. São duas etapas encadeadas:
 *
 *   1) crédito  = diasPagos − (dataFinal − dataInicio)
 *   2) a pagar  = (dataProximoBoleto − dataReativacao) − crédito
 *
 * Fica fora do componente de propósito: assim dá para conferir os números sem
 * renderizar tela nenhuma.
 */

/**
 * Divisor usado para converter dias em dinheiro.
 *
 * A planilha sempre tratou o mês como 30 dias, independente do mês real. Trocar
 * por "dias do mês do próximo boleto" é só alterar este valor (ou passar a
 * calculá-lo a partir da data) — o resto da conta não muda.
 */
export const DIAS_BASE_MENSALIDADE = 30;

export interface EntradaCalculadora {
  /** Data do 1º boleto — onde o cálculo começa (YYYY-MM-DD). */
  dataInicio: string;
  /**
   * 20 dias após o 2º boleto. Vem da tela de Eventos e é sempre UM DIA ANTES
   * da data do evento "alteração de plano_15".
   */
  dataFinal: string;
  /** Dias que o cliente pagou para liberar o sinal. */
  diasPagos: string | number;
  /** Data do pagamento que reativou o sinal. */
  dataReativacao: string;
  dataProximoBoleto: string;
  /**
   * Crédito aplicado na etapa 2. Normalmente é o resultado da etapa 1, mas o
   * operador pode sobrescrever — por isso entra como parâmetro.
   */
  creditoAplicado?: string | number | null;
  /** Opcional: mensalidade cheia, para converter os dias em reais. */
  mensalidade?: string | number | null;
}

export interface ResultadoEtapa1 {
  /** Todos os campos da etapa foram informados? */
  completa: boolean;
  /** DIAS USO — dataFinal − dataInicio. */
  diasUso: number | null;
  /** PAGOU DIAS. */
  diasPagos: number | null;
  /**
   * DESCONTAR DIAS. Positivo = crédito a favor do cliente.
   * Negativo = ele usou mais do que pagou (saldo devedor em dias).
   */
  credito: number | null;
  erro: string | null;
}

export interface ResultadoEtapa2 {
  completa: boolean;
  /** DIAS DE USO — dataProximoBoleto − dataReativacao. */
  diasUso: number | null;
  /** Crédito efetivamente descontado (o da etapa 1 ou o digitado à mão). */
  creditoAplicado: number;
  /** DIAS A PAGAR. Negativo significa que sobrou crédito. */
  diasAPagar: number | null;
  erro: string | null;
}

export interface ResultadoCalculadora {
  etapa1: ResultadoEtapa1;
  etapa2: ResultadoEtapa2;
  /** Dias que vão para a próxima fatura (nunca negativo). */
  diasACobrar: number | null;
  /** Sobra de crédito, quando o desconto supera o período seguinte. */
  creditoRestante: number;
  /** Proporcional em reais, quando a mensalidade é informada. */
  valor: number | null;
}

/**
 * Converte "YYYY-MM-DD" para um instante em UTC à meia-noite.
 *
 * `new Date("2026-06-11")` já seria UTC, mas `new Date(2026, 5, 11)` é local —
 * e misturar os dois faz a diferença variar com fuso e horário de verão. Aqui a
 * data é tratada como data pura, sem hora.
 */
function paraDataUtc(texto: string): Date | null {
  const casa = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto || "").trim());
  if (!casa) return null;
  const ano = Number(casa[1]);
  const mes = Number(casa[2]);
  const dia = Number(casa[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const data = new Date(Date.UTC(ano, mes - 1, dia));
  // Rejeita datas que "viraram" (31/02 vira 03/03, por exemplo).
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return null;
  }
  return data;
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Diferença em dias inteiros entre duas datas puras.
 *
 * É intervalo, não contagem inclusiva: 11/06 → 02/08 dá 52, não 53. Combina com
 * a convenção de usar sempre um dia antes do evento.
 */
export function diferencaEmDias(
  inicio: string,
  fim: string,
): number | null {
  const a = paraDataUtc(inicio);
  const b = paraDataUtc(fim);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / UM_DIA_MS);
}

/** Número informado pelo operador, aceitando vírgula e campo vazio. */
function paraNumero(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (texto === "") return null;
  const numero = Number(texto.replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

/** Etapa 1: quantos dias o cliente pagou a mais durante a suspensão. */
export function calcularEtapa1(entrada: {
  dataInicio: string;
  dataFinal: string;
  diasPagos: string | number;
}): ResultadoEtapa1 {
  const diasPagos = paraNumero(entrada.diasPagos);
  const temDatas = !!entrada.dataInicio && !!entrada.dataFinal;
  const completa = temDatas && diasPagos !== null;

  if (!completa) {
    return {
      completa: false,
      diasUso: null,
      diasPagos,
      credito: null,
      erro: null,
    };
  }

  const diasUso = diferencaEmDias(entrada.dataInicio, entrada.dataFinal);
  if (diasUso === null) {
    return {
      completa: false,
      diasUso: null,
      diasPagos,
      credito: null,
      erro: "Data inválida.",
    };
  }
  if (diasUso < 0) {
    return {
      completa: false,
      diasUso: null,
      diasPagos,
      credito: null,
      erro: "A data final é anterior à data de início.",
    };
  }
  if (diasPagos! < 0) {
    return {
      completa: false,
      diasUso,
      diasPagos,
      credito: null,
      erro: "Os dias pagos não podem ser negativos.",
    };
  }

  return {
    completa: true,
    diasUso,
    diasPagos,
    credito: diasPagos! - diasUso,
    erro: null,
  };
}

/** Etapa 2: quantos dias entram na próxima fatura. */
export function calcularEtapa2(entrada: {
  dataReativacao: string;
  dataProximoBoleto: string;
  creditoAplicado: number;
}): ResultadoEtapa2 {
  const completa = !!entrada.dataReativacao && !!entrada.dataProximoBoleto;
  const credito = entrada.creditoAplicado;

  if (!completa) {
    return {
      completa: false,
      diasUso: null,
      creditoAplicado: credito,
      diasAPagar: null,
      erro: null,
    };
  }

  const diasUso = diferencaEmDias(
    entrada.dataReativacao,
    entrada.dataProximoBoleto,
  );
  if (diasUso === null) {
    return {
      completa: false,
      diasUso: null,
      creditoAplicado: credito,
      diasAPagar: null,
      erro: "Data inválida.",
    };
  }
  if (diasUso < 0) {
    return {
      completa: false,
      diasUso: null,
      creditoAplicado: credito,
      diasAPagar: null,
      erro: "O próximo boleto é anterior à data de reativação.",
    };
  }

  // Um crédito negativo (usou mais do que pagou) entra somando: subtrair um
  // número negativo já acrescenta os dias devidos.
  return {
    completa: true,
    diasUso,
    creditoAplicado: credito,
    diasAPagar: diasUso - credito,
    erro: null,
  };
}

/** Converte dias em reais, proporcional à mensalidade. */
export function valorProporcional(
  dias: number,
  mensalidade: string | number | null | undefined,
): number | null {
  const valorMensal = paraNumero(mensalidade);
  if (valorMensal === null || valorMensal <= 0) return null;
  const bruto = dias * (valorMensal / DIAS_BASE_MENSALIDADE);
  return Number(bruto.toFixed(2));
}

/** Roda as duas etapas encadeadas e monta o resumo. */
export function calcular(entrada: EntradaCalculadora): ResultadoCalculadora {
  const etapa1 = calcularEtapa1(entrada);

  // O crédito digitado à mão manda; sem ele, vale o da etapa 1.
  const creditoManual = paraNumero(entrada.creditoAplicado);
  const creditoAplicado = creditoManual ?? etapa1.credito ?? 0;

  const etapa2 = calcularEtapa2({
    dataReativacao: entrada.dataReativacao,
    dataProximoBoleto: entrada.dataProximoBoleto,
    creditoAplicado,
  });

  const diasAPagar = etapa2.diasAPagar;
  const diasACobrar = diasAPagar === null ? null : Math.max(0, diasAPagar);
  const creditoRestante =
    diasAPagar !== null && diasAPagar < 0 ? Math.abs(diasAPagar) : 0;

  return {
    etapa1,
    etapa2,
    diasACobrar,
    creditoRestante,
    valor:
      diasACobrar === null
        ? null
        : valorProporcional(diasACobrar, entrada.mensalidade),
  };
}
