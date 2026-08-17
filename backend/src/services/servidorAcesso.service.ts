import crypto from "crypto";
import AppDataSource from "../database/DataSource";
import {
  FuncaoServidor,
  ServidorAcesso,
  TipoServidor,
} from "../entities/ServidorAcesso";

/**
 * Senha de acesso a equipamento não pode ficar legível no banco. A chave sai do
 * .env; sem ela, derivamos da senha do banco para não travar o ambiente local.
 */
const CHAVE = crypto
  .createHash("sha256")
  .update(
    process.env.SERVIDORES_CRYPTO_KEY ||
      process.env.DATABASE_PASSWORD ||
      "wip-servidores",
  )
  .digest();

const PREFIXO = "enc:v1:";

export function cifrarSenha(senha: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", CHAVE, iv);
  const dados = Buffer.concat([cipher.update(senha, "utf8"), cipher.final()]);
  return (
    PREFIXO +
    [iv, cipher.getAuthTag(), dados].map((b) => b.toString("base64")).join(".")
  );
}

export function decifrarSenha(valor: string): string {
  if (!valor?.startsWith(PREFIXO)) return valor ?? "";
  try {
    const [iv, tag, dados] = valor
      .slice(PREFIXO.length)
      .split(".")
      .map((p) => Buffer.from(p, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", CHAVE, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(dados), decipher.final()]).toString(
      "utf8",
    );
  } catch (e) {
    console.error("[ServidorAcesso] Falha ao decifrar a senha do servidor:", e);
    return "";
  }
}

export type ServidorConexao = {
  nome: string;
  tipo: TipoServidor;
  funcao: FuncaoServidor;
  host: string;
  porta: number;
  login: string;
  senha: string;
  /** Comando de listagem de clientes (Huawei), quando configurado. */
  comandoClientes?: string | null;
};

const repo = () => AppDataSource.getRepository(ServidorAcesso);

/** Servidores cadastrados e ativos de um tipo, já com a senha em claro. */
export async function listarServidores(
  tipo: TipoServidor,
  funcao?: FuncaoServidor,
): Promise<ServidorConexao[]> {
  const registros = await repo().find({
    where: { tipo, ativo: true, ...(funcao ? { funcao } : {}) },
    order: { ordem: "ASC", id: "ASC" },
  });

  return registros.map((s) => ({
    nome: s.nome,
    tipo: s.tipo,
    funcao: s.funcao,
    host: s.host,
    porta: s.porta,
    login: s.login,
    senha: decifrarSenha(s.senha),
    comandoClientes: s.comando_clientes,
  }));
}

/** Concentradores PPPoE. Sem cadastro, cai no .env como antes. */
export async function listarMikrotiks(): Promise<ServidorConexao[]> {
  const cadastrados = await listarServidores("mikrotik");
  if (cadastrados.length > 0) return cadastrados;

  const porta = Number(process.env.PORT_MIKROTIK_SSH || 2004);
  return [
    { host: process.env.MIKROTIK_PPPOE1, nome: "PPPOE1" },
    { host: process.env.MIKROTIK_PPPOE2, nome: "PPPOE2" },
    { host: process.env.MIKROTIK_PPPOE3, nome: "PPPOE3" },
    { host: process.env.MIKROTIK_PPPOE4, nome: "PPPOE4" },
  ]
    .filter((s) => !!s.host)
    .map((s) => ({
      nome: s.nome,
      tipo: "mikrotik" as const,
      funcao: "pppoe" as const,
      host: String(s.host),
      porta,
      login: process.env.MIKROTIK_LOGIN || "",
      senha: process.env.MIKROTIK_PASSWORD || "",
    }));
}

/** BRAS Huawei: concentram as sessões PPPoE. */
export async function listarHuaweis(): Promise<ServidorConexao[]> {
  return listarServidores("huawei", "pppoe");
}

/**
 * Credenciais de um Mikrotik pelo IP. Vale para os pontos do Client Analytics
 * que já conhecem o host e só precisam saber com que usuário entrar.
 */
export async function credenciaisMikrotik(
  host: string,
): Promise<{ porta: number; login: string; senha: string }> {
  const cadastrado = (await listarMikrotiks()).find((s) => s.host === host);
  if (cadastrado) {
    return {
      porta: cadastrado.porta,
      login: cadastrado.login,
      senha: cadastrado.senha,
    };
  }
  return {
    porta: Number(process.env.PORT_MIKROTIK_SSH || 2004),
    login: process.env.MIKROTIK_LOGIN || "",
    senha: process.env.MIKROTIK_PASSWORD || "",
  };
}

/** OLT usada nas consultas de sinal. Sem cadastro, cai no .env como antes. */
export async function obterOlt(): Promise<ServidorConexao | null> {
  const [primeira] = await listarServidores("huawei", "olt");
  if (primeira) return primeira;

  if (!process.env.OLT_IP) return null;
  return {
    nome: "OLT",
    tipo: "huawei",
    funcao: "olt",
    host: String(process.env.OLT_IP),
    porta: Number(process.env.OLT_PORTA || 22),
    login: String(process.env.OLT_LOGIN || ""),
    senha: String(process.env.OLT_PASSWORD || ""),
  };
}
