/**
 * Planos que embutem Serviço de Valor Adicionado (SVA).
 *
 * Quem entra num plano desses assina o Termo de Adesão SVA junto do contrato
 * do plano — vale para troca de plano, instalação e qualquer outro fluxo que
 * grave o plano no cadastro.
 *
 * A Watch TV contratada avulsa não passa por aqui: ela tem o seu próprio
 * documento, o Contrato de SVA.
 */

/** Planos com SVA nomeados um a um, para não depender só do padrão do nome. */
export const PLANOS_COM_SVA = ["COMBO_800M_STREAMING"];

/**
 * O plano leva SVA?
 *
 * Além da lista, aceita o padrão de nome da casa: os combos que incluem
 * streaming trazem STREAMING no nome, e os que são só wifi estendido
 * (COMBO_400M_1WIFI_EST80M, COMBO_AVANCADO_600M_1WIFI_EST80M) não.
 */
export function planoTemSva(nome?: string | null): boolean {
  const plano = String(nome || "").trim().toUpperCase();
  if (!plano) return false;
  if (PLANOS_COM_SVA.some((p) => p.toUpperCase() === plano)) return true;
  return plano.includes("STREAM");
}
