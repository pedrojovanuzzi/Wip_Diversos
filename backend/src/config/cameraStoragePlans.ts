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

// Cada degrau de plano libera uma câmera a mais: 5 GB → 1, 10 GB → 2, ... 80 GB → 16.
// (maxCameras = gb / 5.)
//
// Preço: até 4 câmeras vale a tabela histórica (20/30/35/40). Daí em diante cada
// câmera extra soma entre R$ 10 e R$ 20, com o degrau afinando conforme o plano
// cresce (+20 até 8 câmeras, +15 até 12, +10 até 16). Os valores são únicos por
// plano — servicosAdicionaisNomes identifica o plano pelo valor do contrato.
// ATENÇÃO: o portal Wip_Cams tem um espelho desta lista
// (backend/src/config/cameraStoragePlans.ts lá). As duas precisam mudar juntas.
export const STORAGE_PLANS: StoragePlan[] = [
  { gb: 5, priceBRL: 20, maxCameras: 1 }, // plano base (valor atual do serviço CAMERA)
  { gb: 10, priceBRL: 30, maxCameras: 2 },
  { gb: 15, priceBRL: 35, maxCameras: 3 },
  { gb: 20, priceBRL: 40, maxCameras: 4 },
  { gb: 25, priceBRL: 60, maxCameras: 5 },
  { gb: 30, priceBRL: 80, maxCameras: 6 },
  { gb: 35, priceBRL: 100, maxCameras: 7 },
  { gb: 40, priceBRL: 120, maxCameras: 8 },
  { gb: 45, priceBRL: 135, maxCameras: 9 },
  { gb: 50, priceBRL: 150, maxCameras: 10 },
  { gb: 55, priceBRL: 165, maxCameras: 11 },
  { gb: 60, priceBRL: 180, maxCameras: 12 },
  { gb: 65, priceBRL: 190, maxCameras: 13 },
  { gb: 70, priceBRL: 200, maxCameras: 14 },
  { gb: 75, priceBRL: 210, maxCameras: 15 },
  { gb: 80, priceBRL: 220, maxCameras: 16 },
];

/** Plano padrão quando nenhum é escolhido. */
export const DEFAULT_STORAGE_GB = 5;

/**
 * Máximo de câmeras permitido para uma cota.
 *
 * Cotas fora da tabela (plano antigo ou ajuste manual no banco) derivam do
 * próprio GB — uma câmera a cada 5 GB. Sem isso um valor desconhecido cairia
 * no plano base e travaria o cliente em 1 câmera.
 */
export function maxCamerasFor(gb: number): number {
  const plano = planFor(gb);
  if (plano) return plano.maxCameras;
  const derivado = Math.floor(Number(gb || 0) / 5);
  return derivado > 0 ? derivado : STORAGE_PLANS[0].maxCameras;
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
