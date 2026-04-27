import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";

export interface User {
  id: number;
  login: string;
  token: string;
  permission: number;
}

export const AUTH_COOKIE = "user";

/**
 * Lê o token do cookie da request atual.
 * O cookie é setado pelo app antigo (React) como JSON.stringify(token), então
 * pode vir como `"abc.def.ghi"` (com aspas) — desserializamos com cuidado.
 */
export async function getTokenFromCookie(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(AUTH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return raw;
  }
}

/**
 * Valida o token no backend e devolve o usuário. Memoizado por request via React `cache`,
 * para que múltiplos Server Components na mesma navegação não disparem N validações.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const token = await getTokenFromCookie();
  if (!token) return null;

  const apiUrl = process.env.REACT_APP_URL;
  if (!apiUrl) {
    console.warn("[auth] REACT_APP_URL não definida — não é possível validar token");
    return null;
  }

  try {
    const res = await fetch(`${apiUrl}/auth/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json();
    const backendUser = data.user ?? data;
    return {
      ...backendUser,
      token: data.token ?? token,
    } as User;
  } catch (err) {
    console.error("[auth] erro validando token:", err);
    return null;
  }
});

/**
 * Helper para Server Components: garante user com permissão mínima ou retorna null
 * (a página pode então redirecionar). O middleware já bloqueia, mas isso serve como
 * defesa em profundidade e dá acesso ao objeto User tipado.
 */
export async function requireUser(minPermission = 1): Promise<User | null> {
  const user = await getUser();
  if (!user) return null;
  if ((user.permission ?? 0) < minPermission) return null;
  return user;
}
