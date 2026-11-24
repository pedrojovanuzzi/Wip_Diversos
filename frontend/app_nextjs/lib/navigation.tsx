"use client";

/**
 * Compatibilidade com o react-router-dom para as telas copiadas do app antigo
 * (app/_telas). Só cobre o que essas telas usam:
 *
 *   useNavigate()      navigate("/x"), navigate("/x", { replace, state }), navigate(-1)
 *   useSearchParams()  [params, setParams] (a tupla do react-router)
 *   useLocation()      { pathname, search, state }
 *   <Navigate to replace />
 *
 * O `state` não existe no Next. Ele vai para o sessionStorage, preso ao caminho
 * de destino, e é lido uma vez pelo useLocation da tela que abre. Recarregar a
 * página perde o state, como no react-router com um link colado.
 *
 * Tela nova escrita para o Next deve usar next/navigation direto.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from "next/navigation";

const CHAVE_STATE = "nav_state:";

type NavOpts = { replace?: boolean; state?: unknown };

export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to: string | number, opts: NavOpts = {}) => {
      if (typeof to === "number") {
        if (to < 0) router.back();
        else router.forward();
        return;
      }
      const caminho = to.split("?")[0];
      try {
        if (opts.state !== undefined && opts.state !== null) {
          sessionStorage.setItem(CHAVE_STATE + caminho, JSON.stringify(opts.state));
        } else {
          sessionStorage.removeItem(CHAVE_STATE + caminho);
        }
      } catch {
        /* sem sessionStorage: a tela abre sem state */
      }
      if (opts.replace) router.replace(to);
      else router.push(to);
    },
    [router],
  );
}

export function useLocation() {
  const pathname = usePathname() ?? "/";
  const params = useNextSearchParams();
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    try {
      const salvo = sessionStorage.getItem(CHAVE_STATE + pathname);
      if (salvo !== null) {
        sessionStorage.removeItem(CHAVE_STATE + pathname);
        setState(JSON.parse(salvo));
      }
    } catch {
      /* sem sessionStorage */
    }
  }, [pathname]);

  const search = params?.toString() ? `?${params.toString()}` : "";
  return { pathname, search, state };
}

type SetParams = (
  next:
    | URLSearchParams
    | Record<string, string>
    | ((atual: URLSearchParams) => URLSearchParams | Record<string, string>),
  opts?: { replace?: boolean },
) => void;

export function useSearchParams(): [URLSearchParams, SetParams] {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const nextParams = useNextSearchParams();
  const qs = nextParams?.toString() ?? "";
  const params = useMemo(() => new URLSearchParams(qs), [qs]);

  const setParams = useCallback<SetParams>(
    (next, opts) => {
      const valor = typeof next === "function" ? next(new URLSearchParams(qs)) : next;
      const novos = valor instanceof URLSearchParams ? valor : new URLSearchParams(valor);
      const busca = novos.toString();
      const url = busca ? `${pathname}?${busca}` : pathname;
      // o react-router empilha no histórico por padrão; aqui também
      if (opts?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [router, pathname, qs],
  );

  return [params, setParams];
}

/** Igual ao do react-router: valores já decodificados (ex.: %20 vira espaço). */
export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  const params = useNextParams() ?? {};
  return useMemo(() => {
    const saida: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(params)) {
      const bruto = Array.isArray(v) ? v.join("/") : v;
      try {
        saida[k] = bruto === undefined ? undefined : decodeURIComponent(bruto);
      } catch {
        saida[k] = bruto;
      }
    }
    return saida as T;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);
}

/** next/link com o `state` do <Link> do react-router (mesmo esquema do navigate). */
export function Link({
  state,
  onClick,
  ...props
}: React.ComponentProps<typeof NextLink> & { state?: unknown }) {
  return (
    <NextLink
      {...props}
      onClick={(e) => {
        const caminho = String(props.href).split("?")[0];
        try {
          if (state !== undefined && state !== null)
            sessionStorage.setItem(CHAVE_STATE + caminho, JSON.stringify(state));
          else sessionStorage.removeItem(CHAVE_STATE + caminho);
        } catch {
          /* sem sessionStorage */
        }
        onClick?.(e);
      }}
    />
  );
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [router, to, replace]);
  return null;
}
