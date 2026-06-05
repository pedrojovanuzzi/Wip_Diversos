// Auth independente do portal do cliente-câmera (separada do AuthContext interno).
const KEY = "camToken";

export interface CamSession {
  id: number;
  login: string;
  email?: string;
  token: string;
}

export function saveCamSession(session: CamSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function getCamSession(): CamSession | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CamSession;
  } catch {
    return null;
  }
}

export function getCamToken(): string | null {
  return getCamSession()?.token ?? null;
}

export function clearCamSession() {
  localStorage.removeItem(KEY);
}
