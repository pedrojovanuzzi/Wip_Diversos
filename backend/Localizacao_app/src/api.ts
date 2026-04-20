const DEV_API = "http://localhost:3000/api";
const PROD_API = "https://wipdiversos.wiptelecomunicacoes.com.br/api";

export function getApiUrl(): string {
  // __DEV__ é true quando rodando via `expo start` (homologação)
  // e false em builds de produção.
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
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
