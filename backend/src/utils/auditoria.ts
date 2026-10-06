import { Request, Response, NextFunction } from "express";
import DataSource from "../database/DataSource";
import { AuditLog, AcaoAuditoria } from "../entities/AuditLog";

/**
 * Auditoria de acessos e ações.
 *
 * O `auditoriaMiddleware` (ligado uma vez no app.ts) grava sozinho toda
 * requisição POST/PUT/PATCH/DELETE feita por usuário autenticado: não precisa
 * mexer em rota nenhuma para ter o básico. Nos controllers dá para:
 *
 *   descreverAcao(req, `Removeu o servidor ${s.nome}`); // texto legível
 *   ignorarAuditoria(req);                              // POST que só consulta
 *
 * E nas rotas, para tirar um POST de leitura inteiro do log:
 *
 *   router.post("/buscar", AuthGuard, semAuditoria, ...)
 *
 * Fora de requisição autenticada (login, webhook, cron), use `registrarLog`.
 */

declare global {
  namespace Express {
    interface Request {
      auditoria?: { descricao?: string; ignorar?: boolean };
    }
  }
}

const ACAO_POR_METODO: Record<string, AcaoAuditoria> = {
  POST: "CRIAR",
  PUT: "EDITAR",
  PATCH: "EDITAR",
  DELETE: "REMOVER",
};

/** Qualquer chave com um destes trechos tem o valor trocado por ***. */
const CHAVES_SENSIVEIS =
  /senha|password|passwd|token|secret|segredo|certificado|pfx|private|apikey|api_key|authorization/i;

const MAX_TEXTO = 300;
const MAX_DADOS = 8000;

function sanitizar(valor: unknown, profundidade = 0): unknown {
  if (valor === null || valor === undefined) return valor;
  if (profundidade > 5) return "[...]";
  if (typeof valor === "string") {
    return valor.length > MAX_TEXTO
      ? `${valor.slice(0, MAX_TEXTO)}… (${valor.length} caracteres)`
      : valor;
  }
  if (Buffer.isBuffer(valor)) return `[arquivo ${valor.length} bytes]`;
  if (Array.isArray(valor)) {
    const itens = valor.slice(0, 50).map((v) => sanitizar(v, profundidade + 1));
    if (valor.length > 50) itens.push(`… +${valor.length - 50} itens`);
    return itens;
  }
  if (typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
      saida[chave] = CHAVES_SENSIVEIS.test(chave)
        ? "***"
        : sanitizar(v, profundidade + 1);
    }
    return saida;
  }
  return valor;
}

function serializarDados(dados: unknown): string | null {
  if (dados === undefined || dados === null) return null;
  if (typeof dados === "object" && Object.keys(dados).length === 0) {
    return null;
  }
  try {
    const json = JSON.stringify(sanitizar(dados));
    return json.length > MAX_DADOS ? `${json.slice(0, MAX_DADOS)}…` : json;
  } catch {
    return null;
  }
}

/**
 * IP real de quem fez a requisição. Não lê o X-Forwarded-For na mão: o
 * primeiro valor dele é escrito pelo cliente e forjável. Com o `trust proxy`
 * do app.ts, `req.ip` já vem resolvido a partir do que o nginx anexou.
 * CF-Connecting-IP só vale com ATRAS_DA_CLOUDFLARE=true; sem Cloudflare na
 * frente, qualquer um manda esse cabeçalho.
 */
function ipDe(req: Request): string | null {
  const cf =
    process.env.ATRAS_DA_CLOUDFLARE === "true"
      ? req.headers["cf-connecting-ip"]
      : undefined;
  const ip =
    (Array.isArray(cf) ? cf[0] : cf)?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    null;
  return ip ? ip.replace(/^::ffff:/, "").slice(0, 64) : null;
}

/** /api/servidores-acesso/12 → servidores-acesso */
function moduloDe(rota: string): string | null {
  const partes = rota.split("?")[0].split("/").filter(Boolean);
  const inicio = partes[0]?.toLowerCase() === "api" ? 1 : 0;
  return partes[inicio]?.slice(0, 64) ?? null;
}

export interface RegistroLog {
  acao: AcaoAuditoria;
  req?: Request;
  userId?: number | null;
  userLogin?: string | null;
  modulo?: string | null;
  descricao?: string | null;
  dados?: unknown;
  statusCode?: number | null;
}

/**
 * Grava uma linha de auditoria. Nunca lança: uma falha aqui não pode derrubar
 * a ação do usuário, então só vai para o console.
 */
export async function registrarLog(registro: RegistroLog): Promise<void> {
  try {
    const { req } = registro;
    const rota = req?.originalUrl?.split("?")[0] ?? null;

    const log = new AuditLog();
    log.acao = registro.acao;
    log.user_id = registro.userId ?? req?.user?.id ?? null;
    log.user_login = (registro.userLogin ?? req?.user?.login ?? null)?.slice(
      0,
      100,
    );
    log.modulo = registro.modulo ?? (rota ? moduloDe(rota) : null);
    log.metodo = req?.method ?? null;
    log.rota = rota?.slice(0, 255) ?? null;
    log.status_code = registro.statusCode ?? null;
    log.descricao = registro.descricao?.slice(0, 500) ?? null;
    log.dados = serializarDados(registro.dados);
    log.ip = req ? ipDe(req) : null;
    log.user_agent = req?.headers["user-agent"]?.slice(0, 255) ?? null;

    await DataSource.getRepository(AuditLog).save(log);
  } catch (error) {
    console.error("[auditoria] falha ao gravar log:", error);
  }
}

/** Texto legível que vai junto da linha gerada automaticamente. */
export function descreverAcao(req: Request, descricao: string) {
  req.auditoria = { ...req.auditoria, descricao };
}

/** Não gravar esta requisição (ex.: POST que só faz consulta). */
export function ignorarAuditoria(req: Request) {
  req.auditoria = { ...req.auditoria, ignorar: true };
}

/** Versão middleware de `ignorarAuditoria`, para usar direto na rota. */
export function semAuditoria(req: Request, _res: Response, next: NextFunction) {
  ignorarAuditoria(req);
  next();
}

/**
 * Registra no fim da resposta toda escrita feita por usuário autenticado.
 * Roda no `finish` porque só aí o AuthGuard da rota já preencheu `req.user`
 * e o status final é conhecido.
 */
export function auditoriaMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const acao = ACAO_POR_METODO[req.method];
  if (!acao) {
    next();
    return;
  }

  res.on("finish", () => {
    if (!req.user?.id || req.auditoria?.ignorar) return;
    void registrarLog({
      acao,
      req,
      descricao: req.auditoria?.descricao,
      dados: req.body,
      statusCode: res.statusCode,
    });
  });

  next();
}
