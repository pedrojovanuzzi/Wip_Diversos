/**
 * Planos de armazenamento das gravações de câmeras (cota por cliente).
 *
 * A cota em GB fica salva em `camera_clientes.storage_gb`. O plano escolhido ao
 * adicionar o serviço CAMERA define tanto a cota quanto o VALOR cobrado no
 * contrato (SisSerContratos). Fonte única usada pelo backend e refletida no front.
 */
export interface StoragePlan {
  /** Cota de armazenamento em gigabytes. */
  gb: number;
  /** Mensalidade do serviço CAMERA para esse plano (R$). */
  priceBRL: number;
  /** Máximo de câmeras que o cliente pode cadastrar nesse plano. */
  maxCameras: number;
}

// Cada degrau de plano libera uma câmera a mais: 5 GB → 1, 10 GB → 2, 15 GB → 3,
// 20 GB → 4. (maxCameras = gb / 5.)
export const STORAGE_PLANS: StoragePlan[] = [
  { gb: 5, priceBRL: 20, maxCameras: 1 }, // plano base (valor atual do serviço CAMERA)
  { gb: 10, priceBRL: 30, maxCameras: 2 },
  { gb: 15, priceBRL: 35, maxCameras: 3 },
  { gb: 20, priceBRL: 40, maxCameras: 4 },
];

/** Plano padrão quando nenhum é escolhido. */
export const DEFAULT_STORAGE_GB = 5;

/** Máximo de câmeras permitido para uma cota (cai no plano base se o GB for inválido). */
export function maxCamerasFor(gb: number): number {
  return planFor(gb)?.maxCameras ?? STORAGE_PLANS[0].maxCameras;
}

/** Retorna o plano de uma cota, ou undefined se o GB não for um plano válido. */
export function planFor(gb: number): StoragePlan | undefined {
  return STORAGE_PLANS.find((p) => p.gb === gb);
}

/** GB é um plano oferecido? */
export function isValidStorageGb(gb: number): boolean {
  return STORAGE_PLANS.some((p) => p.gb === gb);
}

/**
 * Normaliza um valor de entrada para um GB de plano válido; cai no padrão se
 * for inválido/ausente.
 */
export function normalizeStorageGb(input: unknown): number {
  const n = Number(input);
  return Number.isFinite(n) && isValidStorageGb(n) ? n : DEFAULT_STORAGE_GB;
}
