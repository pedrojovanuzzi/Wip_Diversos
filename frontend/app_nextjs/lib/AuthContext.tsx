"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { User } from "@/lib/auth";

/**
 * Usuário logado para Client Components que não recebem `user` por prop
 * (subcomponentes copiados do app antigo, que usavam `useAuth()`).
 *
 * Quem preenche é o `app/layout.tsx`, com o `getUser()` do servidor. A proteção
 * da rota continua no `page.tsx` (`requireUser(N)`); isto aqui só entrega o
 * token e o nível para a tela usar.
 */
const AuthContext = createContext<{ user: User | null }>({ user: null });

export function AuthProvider({
  user,
  children,
}: {
  user: User | null;
  children: ReactNode;
}) {
  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
