/**
 * Hora de Brasília, igual no servidor e no navegador.
 *
 * A primeira versão de uma página é montada no servidor, que pode estar em
 * outro fuso (UTC). Se a tela usar `new Date()` / `moment()` direto, a hora que
 * o servidor desenha não bate com a do navegador (erro de hydration) e o
 * horário sai errado. Use estas funções no lugar.
 */
const FUSO = "America/Sao_Paulo";

function partes(data: Date) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(data);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return { ano: v("year"), mes: v("month"), dia: v("day"), h: v("hour"), m: v("minute"), s: v("second") };
}

/** "AAAA-MM-DDTHH:mm:ss" (formato do input datetime-local com step=1). */
export function agoraLocal(data: Date = new Date()): string {
  const { ano, mes, dia, h, m, s } = partes(data);
  return `${ano}-${mes}-${dia}T${h}:${m}:${s}`;
}

/** "AAAA-MM-DD". */
export function hojeLocal(data: Date = new Date()): string {
  return agoraLocal(data).slice(0, 10);
}
