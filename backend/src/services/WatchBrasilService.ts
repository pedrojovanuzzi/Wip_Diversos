import axios from "axios";

const BASE_URL =
  process.env.WATCH_BRASIL_URL || "https://apiweb.watch.tv.br/watch";
const TOKEN_URI =
  process.env.WATCH_BRASIL_TOKEN_URI ||
  "https://apiweb.watch.tv.br/oauth/token";
const AUTH_URI =
  process.env.WATCH_BRASIL_AUTH_URI ||
  "https://apiweb.watch.tv.br/watch/v1/oauth/authenticate";
const CLIENT_ID = process.env.WATCH_BRASIL_CLIENT_ID || "";
const CLIENT_SECRET = process.env.WATCH_BRASIL_CLIENT_SECRET || "";
const REDIRECT_URL = process.env.WATCH_BRASIL_REDIRECT_URL || "";
const PACOTE_DEFAULT = process.env.WATCH_BRASIL_PACOTE_DEFAULT || "";

interface CachedToken {
  token: string;
  fetchedAt: number;
  ttlMs: number;
}

let cachedToken: CachedToken | null = null;

interface PendingAuth {
  resolve: (code: string) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}
let pendingAuth: PendingAuth | null = null;
const CALLBACK_TIMEOUT_MS = 60000;

export function deliverAuthCode(code: string): boolean {
  if (!pendingAuth) return false;
  const p = pendingAuth;
  pendingAuth = null;
  clearTimeout(p.timer);
  p.resolve(code);
  return true;
}

function waitForAuthCode(): Promise<string> {
  if (pendingAuth) {
    return Promise.reject(
      new Error("Já existe uma autenticação Watch Brasil em andamento"),
    );
  }
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingAuth = null;
      reject(
        new Error(
          `Timeout aguardando callback /redirect com code (${CALLBACK_TIMEOUT_MS}ms)`,
        ),
      );
    }, CALLBACK_TIMEOUT_MS);
    pendingAuth = { resolve, reject, timer };
  });
}

function form(params: Record<string, any>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) sp.append(k, String(v));
  });
  return sp.toString();
}

export async function authenticate(force = false): Promise<string> {
  const TTL = 50 * 60 * 1000;
  if (
    !force &&
    cachedToken &&
    Date.now() - cachedToken.fetchedAt < cachedToken.ttlMs
  ) {
    return cachedToken.token;
  }
  if (!CLIENT_ID) throw new Error("WATCH_BRASIL_CLIENT_ID não configurado");
  if (!CLIENT_SECRET)
    throw new Error("WATCH_BRASIL_CLIENT_SECRET não configurado");

  if (!REDIRECT_URL)
    throw new Error("WATCH_BRASIL_REDIRECT_URL não configurado");

  const codePromise = waitForAuthCode();

  let authData: any;
  try {
    const authRes = await axios.post(
      AUTH_URI,
      form({
        client_id: CLIENT_ID,
        redirect_url: REDIRECT_URL,
        approval_prompt: "false",
        uid: CLIENT_SECRET,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 30000,
      },
    );
    authData = authRes.data;
  } catch (e) {
    if (pendingAuth) {
      clearTimeout(pendingAuth.timer);
      pendingAuth = null;
    }
    throw e;
  }

  const inlineCode =
    authData?.code ||
    authData?.authorization_code ||
    authData?.auth_code ||
    authData?.value;
  if (inlineCode && typeof inlineCode === "string") {
    if (pendingAuth) {
      clearTimeout(pendingAuth.timer);
      pendingAuth = null;
    }
    return exchangeCodeForToken(inlineCode, TTL);
  }

  const code = await codePromise;
  return exchangeCodeForToken(code, TTL);
}

export async function exchangeCodeForToken(
  code: string,
  fallbackTtlMs = 50 * 60 * 1000,
): Promise<string> {
  if (!CLIENT_ID) throw new Error("WATCH_BRASIL_CLIENT_ID não configurado");
  if (!CLIENT_SECRET)
    throw new Error("WATCH_BRASIL_CLIENT_SECRET não configurado");
  if (!code) throw new Error("code obrigatório para troca de token");

  const tokenRes = await axios.post(
    TOKEN_URI,
    form({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "password",
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 30000,
    },
  );

  const tokenData = tokenRes.data;
  const result =
    Array.isArray(tokenData?.Result) && tokenData.Result.length > 0
      ? tokenData.Result[0]
      : tokenData?.Result || tokenData;
  const token =
    result?.access_token ||
    result?.token ||
    result?.Authorization ||
    result?.value ||
    tokenData?.access_token ||
    tokenData?.token;
  if (!token || typeof token !== "string") {
    throw new Error(
      "Resposta de /oauth/token sem access_token reconhecido: " +
        JSON.stringify(tokenData).slice(0, 300),
    );
  }

  const expiresIn = Number(result?.expires_in ?? tokenData?.expires_in);
  const ttlMs =
    Number.isFinite(expiresIn) && expiresIn > 0
      ? expiresIn * 1000
      : fallbackTtlMs;

  cachedToken = { token, fetchedAt: Date.now(), ttlMs };
  return token;
}

function authHeader(token: string): string {
  return token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
}

async function postWithAuth<T = any>(
  path: string,
  body: Record<string, any>,
  retried = false,
): Promise<T> {
  const token = await authenticate();
  const url = `${BASE_URL}${path}`;
  const payload = form(body);
  console.log("[WatchBrasil][POST]", url, "body:", body);
  try {
    const res = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authHeader(token),
      },
      timeout: 30000,
    });
    console.log("[WatchBrasil][POST]", url, "status:", res.status, "data:", res.data);
    return res.data as T;
  } catch (err: any) {
    console.error(
      "[WatchBrasil][POST]",
      url,
      "FAIL status:",
      err?.response?.status,
      "data:",
      err?.response?.data,
    );
    if (!retried && err?.response?.status === 401) {
      cachedToken = null;
      return postWithAuth<T>(path, body, true);
    }
    throw err;
  }
}

async function getWithAuth<T = any>(
  path: string,
  params: Record<string, any> = {},
  retried = false,
): Promise<T> {
  const token = await authenticate();
  try {
    const res = await axios.get(`${BASE_URL}${path}`, {
      params,
      headers: { Authorization: authHeader(token) },
      timeout: 30000,
    });
    return res.data as T;
  } catch (err: any) {
    if (!retried && err?.response?.status === 401) {
      cachedToken = null;
      return getWithAuth<T>(path, params, true);
    }
    throw err;
  }
}

export async function getPacote(idPacote: number | string) {
  return getWithAuth("/v1/pacotes/get", { pPacote: idPacote });
}

export interface InsertAssinanteInput {
  email: string;
  assinanteIDIntegracao: string;
  pacote?: string;
  phone?: string;
}

export async function insertAssinante(input: InsertAssinanteInput) {
  return postWithAuth("/v2/assinantes/insert", {
    pEmail: input.email,
    pAssinanteIDIntegracao: input.assinanteIDIntegracao,
    pPacote: input.pacote || PACOTE_DEFAULT,
    pPhone: input.phone || "",
  });
}

export async function deleteTicket(ticket: string) {
  return postWithAuth("/v1/tickets/delete", { pTicket: ticket });
}

export async function editPhone(input: {
  email: string;
  phone: string;
  pacote?: string;
}) {
  return postWithAuth("/v2/assinantes/editPhone", {
    pPacote: input.pacote || PACOTE_DEFAULT,
    pEmail: input.email,
    pPhone: input.phone,
  });
}

export async function updateTicketStatus(ticket: string, ativo: boolean) {
  return postWithAuth("/v1/tickets/updatestatus", {
    pStatus: ativo ? "true" : "false",
    pTicket: ticket,
  });
}
