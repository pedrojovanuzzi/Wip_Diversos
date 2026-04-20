const DEFAULT_API =
  process.env.EXPO_PUBLIC_API_URL ??
  "https://wipdiversos.wiptelecomunicacoes.com.br/api";

export function getApiUrl(): string {
  return DEFAULT_API;
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
