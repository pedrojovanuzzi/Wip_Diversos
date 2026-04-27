import "server-only";
import { getTokenFromCookie } from "./auth";

const API_URL = process.env.REACT_APP_URL;

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  token?: string;
  /** Se true, NÃO injeta o Bearer automaticamente */
  noAuth?: boolean;
}

/**
 * fetch server-side autenticado com o JWT do cookie. Usar em Server Components
 * e Server Actions. Lança em caso de erro HTTP.
 */
export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  if (!API_URL) throw new Error("REACT_APP_URL não configurada");

  const { body, token: tokenOverride, noAuth, headers, ...rest } = opts;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";

  if (!noAuth) {
    const token = tokenOverride ?? (await getTokenFromCookie());
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: rest.cache ?? "no-store",
  });

  if (!res.ok) {
    let detail: unknown = undefined;
    try {
      detail = await res.json();
    } catch {
      try {
        detail = await res.text();
      } catch {}
    }
    const err = new Error(
      `apiFetch ${path} -> HTTP ${res.status}` +
        (detail ? `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""),
    ) as Error & { status: number; detail: unknown };
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  // Algumas rotas devolvem 204 ou texto plano
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}
