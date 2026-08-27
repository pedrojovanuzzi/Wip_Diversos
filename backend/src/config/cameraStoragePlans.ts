/**
 * Planos de armazenamento das gravações de câmeras (cota por cliente).
 *
 * A cota em GB fica salva em `camera_clientes.storage_gb`. O plano define tanto
 * a cota quanto o VALOR cobrado no contrato (SisSerContratos).
 *
 * A fonte da verdade é a tabela `camera_planos` (banco wip_cams) — o único
 * banco que os dois sistemas alcançam. A lista abaixo é só o ponto de partida:
 * `carregarPlanosDoBanco()` troca o conteúdo de STORAGE_PLANS assim que o banco
 * responde e mantém o array atualizado. Com o banco fora ou a tabela vazia, o
 * serviço continua de pé com esta lista.
 */
export interface StoragePlan {
  /** Cota de armazenamento em gigabytes. */
  gb: number;
  /** Mensalidade do serviço CAMERA para esse plano (R$). */
  priceBRL: number;
  /** Máximo de câmeras que o cliente pode cadastrar nesse plano. */
  maxCameras: number;
  /** Plano ainda oferecido? Desativado continua valendo para quem já o tem. */
  ativo?: boolean;
}

// Cada degrau de plano libera uma câmera a mais: 5 GB → 1, 10 GB → 2, ... 80 GB → 16.
// (maxCameras = gb / 5.) Espelha o seed da migration CreateCameraPlanos.
const PLANOS_PADRAO: StoragePlan[] = [
  { gb: 5, priceBRL: 20, maxCameras: 1 }, // plano base
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

/**
 * Lista viva dos planos. É sempre o mesmo array (o conteúdo é trocado no
 * lugar), então quem importou continua enxergando o valor atual.
 */
export const STORAGE_PLANS: StoragePlan[] = PLANOS_PADRAO.map((p) => ({
  ...p,
  ativo: true,
}));

/** Plano padrão quando nenhum é escolhido. */
export const DEFAULT_STORAGE_GB = 5;

/** De quanto em quanto tempo os planos são relidos do banco. */
const INTERVALO_RECARGA_MS = 5 * 60_000;

let timerRecarga: NodeJS.Timeout | null = null;

/**
 * Relê `camera_planos` e atualiza STORAGE_PLANS no lugar. Devolve quantos
 * planos vieram do banco (0 = seguiu com a lista que já estava em memória).
 *
 * Import dinâmico para não criar dependência circular com o DataSource.
 */
export async function carregarPlanosDoBanco(): Promise<number> {
  try {
    const { default: CamsSource } = await import("../database/CamsSource");
    // Conexão ainda subindo: sai quieto e deixa a próxima recarga pegar — sem
    // isso o TypeORM estoura um "No metadata" que não diz nada.
    if (!CamsSource.isInitialized) return 0;
    const { CameraPlano } = await import("../entities/CameraPlano");

    const linhas = await CamsSource.getRepository(CameraPlano).find({
      order: { storage_gb: "ASC" },
    });
    // Tabela vazia (migration ainda não rodou): mantém o que está em memória em
    // vez de zerar a lista e travar todo mundo no plano base.
    if (linhas.length === 0) return 0;

    const novos: StoragePlan[] = linhas.map((l) => ({
      gb: Number(l.storage_gb),
      priceBRL: Number(l.preco_brl),
      maxCameras: Number(l.max_cameras),
      ativo: Boolean(l.ativo),
    }));
    STORAGE_PLANS.splice(0, STORAGE_PLANS.length, ...novos);
    return novos.length;
  } catch (e: any) {
    console.error(
      "[camera_planos] Falha ao ler os planos do banco; usando a lista em memória:",
      e?.message || e,
    );
    return 0;
  }
}

/**
 * Carrega os planos e agenda as releituras. Chamado no boot — assim uma
 * alteração de plano chega ao serviço sem reiniciar nada.
 */
export async function iniciarPlanosDeArmazenamento(): Promise<void> {
  const total = await carregarPlanosDoBanco();
  console.log(
    total > 0
      ? `[camera_planos] ${total} plano(s) carregado(s) do banco.`
      : "[camera_planos] Nenhum plano lido do banco; usando a lista embutida.",
  );
  if (!timerRecarga) {
    timerRecarga = setInterval(() => {
      carregarPlanosDoBanco().catch(() => undefined);
    }, INTERVALO_RECARGA_MS);
    timerRecarga.unref?.();
  }
}

/** Planos ainda oferecidos, para montar as opções de contratação. */
export function planosAtivos(): StoragePlan[] {
  return STORAGE_PLANS.filter((p) => p.ativo !== false);
}

/**
 * Máximo de câmeras permitido para uma cota.
 *
 * Cotas fora da tabela (ajuste manual no banco, ou um plano criado enquanto os
 * planos ainda não tinham sido lidos) derivam do próprio GB — uma câmera a cada
 * 5 GB. Sem isso um valor desconhecido cairia no plano base e travaria o
 * cliente em 1 câmera mesmo tendo contratado bem mais.
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
