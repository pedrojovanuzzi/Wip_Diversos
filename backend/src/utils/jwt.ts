import { Request } from "express";
import dotenv from "dotenv";
import jwt, { JwtPayload } from "jsonwebtoken";

dotenv.config();

/**
 * Segredo dos tokens, conferido uma vez só, ao carregar o módulo.
 * `String(process.env.JWT_SECRET)` sem a variável vira o texto "undefined", e
 * qualquer um assinaria um token válido com ele. O server.ts importa este
 * arquivo antes de tudo, então sem o segredo o processo cai na subida, antes
 * de abrir banco, Redis ou agendamento.
 */
const SEGREDO = process.env.JWT_SECRET;
if (!SEGREDO) {
  throw new Error("JWT_SECRET não está definido no .env. O servidor não sobe sem ele.");
}

export function jwtSecret(): string {
  return SEGREDO as string;
}

/**
 * Token do cabeçalho `Authorization`. Aceita `Bearer <token>` com qualquer
 * caixa e espaços a mais, e também o token sozinho (o app da TV WIP manda
 * assim).
 */
export function tokenDoCabecalho(req: Request): string | undefined {
  const cabecalho = req.headers["authorization"];
  if (!cabecalho) return undefined;
  return cabecalho.replace(/^\s*Bearer(?:\s+|$)/i, "").trim() || undefined;
}

/**
 * Id do usuário do painel dono do token, ou null se o token faltar, for
 * inválido ou não for do painel.
 *
 * O app da TV WIP assina os tokens dos clientes com o mesmo segredo, mas sem
 * `id` (leva `login` e `escopo`). Sem esta checagem, `findOne({ where: { id:
 * undefined } })` do TypeORM descarta a condição e devolve o primeiro usuário
 * da tabela: um cliente da TV entraria no painel como administrador.
 */
export function idDoUsuarioDoToken(token: string | undefined): number | null {
  if (!token) return null;
  try {
    const dados = jwt.verify(token, jwtSecret());
    if (typeof dados !== "object" || (dados as JwtPayload).escopo) return null;
    const id = Number((dados as JwtPayload).id);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** Id do usuário do painel pelo token do cabeçalho, ou null. */
export function idDoUsuarioDaRequisicao(req: Request): number | null {
  return idDoUsuarioDoToken(tokenDoCabecalho(req));
}
