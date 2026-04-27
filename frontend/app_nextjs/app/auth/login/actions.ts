"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE } from "@/lib/auth";

export interface LoginState {
  error?: string;
}

const COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60; // 8h, equivalente ao 1/3 day do app antigo

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!login || !password) {
    return { error: "Informe login e senha." };
  }

  const apiUrl = process.env.REACT_APP_URL;
  if (!apiUrl) return { error: "REACT_APP_URL não configurada no servidor." };

  let token: string | undefined;
  try {
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { error: body || `Falha no login (HTTP ${res.status}).` };
    }

    // O backend antigo devolve o token cru em res.data — pode vir como string ou objeto
    const ct = res.headers.get("content-type") ?? "";
    const payload = ct.includes("application/json") ? await res.json() : await res.text();
    token = typeof payload === "string" ? payload : payload?.token ?? payload;
  } catch (err) {
    console.error("[login] erro:", err);
    return { error: "Erro de conexão com o backend." };
  }

  if (!token || typeof token !== "string") {
    return { error: "Resposta inválida do backend." };
  }

  // Salva o cookie no MESMO formato do app antigo (JSON.stringify do token),
  // para que ambos os apps (React e Next) compartilhem a sessão durante a transição.
  const store = await cookies();
  store.set({
    name: AUTH_COOKIE,
    value: JSON.stringify(token),
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    httpOnly: false, // mantemos legível pelo js-cookie do app antigo
    sameSite: "lax",
  });

  redirect("/");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  redirect("/auth/login");
}
