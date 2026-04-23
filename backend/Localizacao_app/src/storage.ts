import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_TECH = "@localizacao/tecnico";
const KEY_AVISO_BATERIA = "@localizacao/aviso-bateria";
const KEY_FILA_POSICOES = "@localizacao/fila-posicoes";
const KEY_HEARTBEAT = "@localizacao/heartbeat";
const FILA_MAX = 200;
const HEARTBEAT_MAX = 80;

export interface TecnicoData {
  nome: string;
  deviceId: string;
  registradoEm: string;
}

export interface PosicaoFila {
  device_id: string;
  person_name: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  battery?: number | null;
  ts: number;
}

export async function salvarTecnico(data: TecnicoData): Promise<void> {
  await AsyncStorage.setItem(KEY_TECH, JSON.stringify(data));
}

export async function carregarTecnico(): Promise<TecnicoData | null> {
  const raw = await AsyncStorage.getItem(KEY_TECH);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TecnicoData;
  } catch {
    return null;
  }
}

export async function limparTecnico(): Promise<void> {
  await AsyncStorage.removeItem(KEY_TECH);
}

export async function avisoBateriaJaMostrado(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY_AVISO_BATERIA)) === "1";
}

export async function marcarAvisoBateriaMostrado(): Promise<void> {
  await AsyncStorage.setItem(KEY_AVISO_BATERIA, "1");
}

export async function lerFila(): Promise<PosicaoFila[]> {
  const raw = await AsyncStorage.getItem(KEY_FILA_POSICOES);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function enfileirarPosicao(p: PosicaoFila): Promise<void> {
  const atual = await lerFila();
  atual.push(p);
  // FILA_MAX evita que a fila cresça sem limite quando o backend fica indisponível
  // por horas. Descarta os mais antigos (FIFO).
  const podada = atual.slice(-FILA_MAX);
  await AsyncStorage.setItem(KEY_FILA_POSICOES, JSON.stringify(podada));
}

export async function salvarFila(lista: PosicaoFila[]): Promise<void> {
  await AsyncStorage.setItem(KEY_FILA_POSICOES, JSON.stringify(lista));
}

export interface HeartbeatEntry {
  ts: number;
  ev: "bg-fire" | "bg-ok" | "bg-enqueue" | "bg-noloc" | "bg-err" | "fg-ok";
  info?: string;
}

export async function registrarHeartbeat(
  ev: HeartbeatEntry["ev"],
  info?: string,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY_HEARTBEAT);
    const arr: HeartbeatEntry[] = raw ? JSON.parse(raw) : [];
    arr.push({ ts: Date.now(), ev, info });
    const podado = arr.slice(-HEARTBEAT_MAX);
    await AsyncStorage.setItem(KEY_HEARTBEAT, JSON.stringify(podado));
  } catch {
    // Nunca propaga: heartbeat é diagnóstico, não pode derrubar o task.
  }
}

export async function lerHeartbeats(): Promise<HeartbeatEntry[]> {
  const raw = await AsyncStorage.getItem(KEY_HEARTBEAT);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function limparHeartbeats(): Promise<void> {
  await AsyncStorage.removeItem(KEY_HEARTBEAT);
}
