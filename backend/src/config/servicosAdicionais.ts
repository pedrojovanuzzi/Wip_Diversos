/**
 * Nomes comerciais e valores dos serviços adicionais (streaming e câmeras).
 *
 * Fonte única usada pelo cadastro de contratos (SerContratos), pela emissão de
 * NFSE e espelhada no front. O nome do streaming embute o valor cobrado, então
 * ele é derivado de VALOR_STREAMER — mudar o preço muda o nome junto.
 */

/** Mensalidade do streaming pago (R$). */
export const VALOR_STREAMER = 49.9;

/** Streaming liberado para colaborador: sem custo na mensalidade. */
export const VALOR_STREAMER_COLAB = 0;

/** Formata em real no padrão brasileiro, sem o prefixo "R$". */
export function formatBRL(valor: number): string {
  return Number(valor || 0)
    .toFixed(2)
    .replace(".", ",");
}

/** Nome comercial do streaming, com o valor da mensalidade. */
export function nomeStreaming(valor: number = VALOR_STREAMER): string {
  return `WatchTV Brasil R$ ${formatBRL(valor)}`;
}

/** Nome comercial do streaming de colaborador (sem cobrança). */
export function nomeStreamingColab(): string {
  return "WatchTV Brasil Colaborador (grátis)";
}

/**
 * Nome comercial do serviço de câmeras: quantidade de canais gravando na nuvem
 * e a cota de armazenamento compartilhada entre eles.
 */
export function nomeCamera(canais: number, storageGb: number): string {
  return `${Number(canais || 0)} Canais de Gravação em Nuvem ${Number(
    storageGb || 0,
  )} Gb de Armazenamento compartilhado`;
}
