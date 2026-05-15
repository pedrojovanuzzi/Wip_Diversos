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

  const res = await axios.post(
    `${BASE_URL}/v1/oauth/authenticate`,
    form({
      client_id: CLIENT_ID,
      redirect_url: REDIRECT_URL,
      approval_prompt: "false",
      uid: "1",
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 30000,
    },
  );

  const data = res.data;
  const token =
    data?.access_token || data?.token || data?.Authorization || data?.value;
  if (!token || typeof token !== "string") {
    throw new Error(
      "Resposta de autenticação Watch Brasil sem token reconhecido: " +
        JSON.stringify(data).slice(0, 300),
    );
  }
  cachedToken = { token, fetchedAt: Date.now(), ttlMs: TTL };
  return token;
}

async function postWithAuth<T = any>(
  path: string,
  body: Record<string, any>,
  retried = false,
): Promise<T> {
  const token = await authenticate();
  try {
    const res = await axios.post(`${BASE_URL}${path}`, form(body), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: token,
      },
      timeout: 30000,
    });
    return res.data as T;
  } catch (err: any) {
    if (!retried && err?.response?.status === 401) {
      cachedToken = null;
      return postWithAuth<T>(path, body, true);
    }
    throw err;
  }
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
