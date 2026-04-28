import { lerFila, salvarFila, enfileirarPosicao, PosicaoFila } from "./storage";

const DEV_API = "http://localhost:3000/api";
const PROD_API = process.env.EXPO_PUBLIC_API_URL ?? "";

export function getApiUrl(): string {
  // __DEV__ é true quando rodando via `expo start` (homologação)
  // e false em builds de produção.
  // @ts-ignore - __DEV__ é global do React Native
  return typeof __DEV__ !== "undefined" && __DEV__ ? DEV_API : PROD_API;
}

export interface PositionPayload {
  device_id: string;
  person_name: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  battery?: number | null;
}

export async function enviarPosicao(payload: PositionPayload): Promise<void> {
  const url = `${getApiUrl()}/phone-location/position`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Erro ${res.status}: ${text}`);
  }
}

export async function enviarOuEnfileirar(
  payload: PositionPayload,
): Promise<void> {
  try {
    await enviarPosicao(payload);
    await drenarFila();
  } catch (err) {
    await enfileirarPosicao({ ...payload, ts: Date.now() });
    throw err;
  }
}

export async function drenarFila(): Promise<void> {
  const fila = await lerFila();
  if (fila.length === 0) return;
  for (let i = 0; i < fila.length; i++) {
    const item = fila[i];
    try {
      await enviarPosicao({
        device_id: item.device_id,
        person_name: item.person_name,
        latitude: item.latitude,
        longitude: item.longitude,
        accuracy: item.accuracy,
        battery: item.battery,
      });
    } catch {
      // Rede caiu no meio do drain — persiste o que sobrou (inclusive o atual)
      // para tentar de novo no próximo ciclo.
      await salvarFila(fila.slice(i));
      return;
    }
  }
  await salvarFila([]);
}
