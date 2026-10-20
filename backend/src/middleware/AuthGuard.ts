import { Request, Response, NextFunction } from "express";
import { User } from "../entities/User";
import DataSource from "../database/DataSource";
import {
  idDoUsuarioDaRequisicao,
  idDoUsuarioDoToken,
  tokenDoCabecalho,
} from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: User | null;
    }
  }
}

// Sem o hash da senha: req.user não precisa dele, e um res.json(req.user)
// esquecido em algum controller o mandaria para o navegador.
const CAMPOS_DO_USUARIO: (keyof User)[] = ["id", "login", "permission"];

async function autenticar(
  token: string | undefined,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!token) {
    res.status(401).json({ errors: ["Acesso Negado!"] });
    return;
  }

  const id = idDoUsuarioDoToken(token);
  if (!id) {
    res.status(401).json({ errors: ["Token Inválido"] });
    return;
  }

  try {
    req.user = await DataSource.getRepository(User).findOne({
      where: { id },
      select: CAMPOS_DO_USUARIO,
    });
  } catch (error) {
    console.error("[AuthGuard] Falha ao buscar o usuário:", error);
    res.status(500).json({ errors: ["Erro ao validar o acesso."] });
    return;
  }

  if (!req.user) {
    res.status(401).json({ errors: ["Usuário não encontrado"] });
    return;
  }

  next();
}

/** Exige token do painel no cabeçalho `Authorization: Bearer`. */
function AuthGuard(req: Request, res: Response, next: NextFunction) {
  return autenticar(tokenDoCabecalho(req), req, res, next);
}

/**
 * Igual ao AuthGuard, mas também aceita `?token=` na URL. Só para o que o
 * navegador abre sem poder mandar cabeçalho (`<img src>`, link de download).
 * Token na URL fica no log do nginx e no histórico: não use fora disso.
 */
export function AuthGuardComTokenNaUrl(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = tokenDoCabecalho(req) || (req.query.token as string);
  return autenticar(token, req, res, next);
}

/**
 * Para rotas públicas que mostram mais dados a quem está logado: preenche
 * `req.user` se vier um token válido e segue em frente de qualquer jeito.
 */
export async function AuthOpcional(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const id = idDoUsuarioDaRequisicao(req);

  if (id) {
    try {
      req.user = await DataSource.getRepository(User).findOne({
        where: { id },
        select: CAMPOS_DO_USUARIO,
      });
    } catch {
      req.user = null;
    }
  }
  next();
}

export default AuthGuard;
