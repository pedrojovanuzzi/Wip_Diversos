import { Request, Response, NextFunction, RequestHandler } from "express";
import AuthGuard from "./AuthGuard";

/**
 * Nível mínimo de permissão para uma rota. Exige que `req.user` já tenha sido
 * preenchido pelo AuthGuard — use `protegido(n)` para não esquecer a ordem.
 *
 * Os níveis seguem o que o frontend já exige em cada tela (App.tsx):
 * 1 = consulta básica, 2 = operação, 5 = administrador.
 */
export function exigirPermissao(minimo: number): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if ((req.user?.permission ?? 0) < minimo) {
      res.status(403).json({ errors: ["Permissão insuficiente."] });
      return;
    }
    next();
  };
}

/** AuthGuard + nível mínimo, na ordem certa: `router.post("/x", protegido(2), ...)`. */
export function protegido(minimo: number): RequestHandler[] {
  return [AuthGuard, exigirPermissao(minimo)];
}

export const somenteAdmin = exigirPermissao(5);
