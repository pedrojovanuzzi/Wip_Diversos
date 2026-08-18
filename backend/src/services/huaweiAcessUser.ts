import { comSessaoOlt } from "./oltSsh";
import { ServidorConexao } from "./servidorAcesso.service";

export type ClienteAtivo = {
  servidor: string;
  pppoe: string;
  callerId: string;
  ip: string;
  upTime: string;
  /** Índice da sessão no BRAS, usado para buscar o tempo de conexão. */
  userId?: string;
};

/** "19:23:09" vira "19h23m9s", no mesmo estilo do uptime do Mikrotik. */
export function formatarTempoOnline(bruto: string): string {
  const partes = bruto.trim().split(":").map(Number);
  if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return "";
  let [horas, minutos, segundos] = partes;
  const dias = Math.floor(horas / 24);
  horas = horas % 24;

  return (
    [
      dias ? `${dias}d` : "",
      horas ? `${horas}h` : "",
      minutos ? `${minutos}m` : "",
      segundos && !dias ? `${segundos}s` : "",
    ].join("") || "0s"
  );
}

/** Huawei escreve MAC como 0011-2233-4455; a tela usa o formato do Mikrotik. */
function formatarMac(bruto: string): string {
  const hex = bruto.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  if (hex.length !== 12) return bruto.toUpperCase();
  return (hex.match(/.{2}/g) as string[]).join(":");
}

const RE_IP = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const RE_MAC = /\b(?:[0-9A-Fa-f]{4}-){2}[0-9A-Fa-f]{4}\b|\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/;
// "01:23:45" ou "0d 01h 23m"; o BRAS varia conforme a versão.
const RE_TEMPO = /\b\d+d\s*\d+h\s*\d+m\b|\b\d{1,4}:\d{2}:\d{2}\b/;

/**
 * Lê a saída de `display access-user` e devolve as sessões PPPoE.
 *
 * O comando imprime uma tabela com largura variável entre versões, então em vez
 * de fixar colunas procuramos os campos reconhecíveis em cada linha: usuário,
 * IP, MAC e, quando existir, o tempo de conexão.
 */
export function parseAccessUser(saida: string, servidor: string): ClienteAtivo[] {
  const clientes: ClienteAtivo[] = [];

  for (const linhaBruta of saida.split("\n")) {
    const linha = linhaBruta.replace(/\r/g, "").trim();
    if (!linha || /^[-=+\s]+$/.test(linha)) continue;
    // Cabeçalhos, totais, paginação e o banner de login não são sessões — o
    // banner do SSH tem IP ("last login ... from 1.2.3.4") e enganava o parser.
    if (/^(UserID|Total|Info|Error|---)/i.test(linha)) continue;
    if (/login time|VTY users|through SSH/i.test(linha)) continue;

    const ip = linha.match(RE_IP)?.[0];
    if (!ip) continue;

    // Toda sessão começa pelo UserID numérico; sem isso é texto solto.
    const primeiro = linha.split(/\s+/)[0];
    if (!/^\d+$/.test(primeiro)) continue;

    const mac = linha.match(RE_MAC)?.[0] ?? "";
    // Tira o MAC antes de procurar o tempo: "00:11:22:33:44:66" contém algo
    // muito parecido com "00:11:22".
    const semMac = mac ? linha.replace(mac, " ") : linha;
    const tempo = semMac.match(RE_TEMPO)?.[0] ?? "";

    // O usuário é o primeiro campo que não é número puro, IP nem MAC.
    const campos = linha.split(/\s+/);
    const usuario = campos.find(
      (c) =>
        !/^\d+$/.test(c) &&
        c !== ip &&
        c !== mac &&
        !RE_IP.test(c) &&
        !RE_MAC.test(c),
    );
    if (!usuario) continue;

    clientes.push({
      servidor,
      // O BRAS costuma trazer usuario@dominio; a tela mostra só o login.
      pppoe: usuario.split("@")[0].toUpperCase(),
      callerId: mac ? formatarMac(mac) : "",
      ip,
      upTime: tempo,
      userId: /^\d+$/.test(campos[0]) ? campos[0] : undefined,
    });
  }

  return clientes;
}

/**
 * Tempo de conexão de uma sessão, sob demanda. Um comando por cliente, por
 * isso não entra na listagem geral.
 */
export async function uptimeClienteHuawei(
  servidor: ServidorConexao,
  userId: string,
): Promise<string> {
  return comSessaoOlt(servidor, async (conn) => {
    const detalhe = await conn.exec(`display access-user user-id ${userId}`, {
      execTimeout: 20000,
      silencio: 800,
    });
    // O rótulo é "Online time (h:min:sec)  : 19:23:09" — o parêntese tem
    // dois-pontos, então a captura precisa vir do fim da linha.
    const online = detalhe.match(
      /Online time[^\n]*?:\s*(\d+:\d{2}:\d{2})/i,
    )?.[1];
    return online ? formatarTempoOnline(online) : "";
  });
}

/** Sessões PPPoE ativas em um equipamento Huawei. */
export async function listarClientesHuawei(
  servidor: ServidorConexao,
): Promise<ClienteAtivo[]> {
  return comSessaoOlt(servidor, async (conn) => {
    // Desliga a paginação para a saída vir inteira de uma vez.
    await conn
      .exec("screen-length 0 temporary", { execTimeout: 10000 })
      .catch(() => undefined);
    // O comando varia por instalacao (dominio, filtros); o cadastro manda.
    const comando = servidor.comandoClientes?.trim() || "display access-user";
    const saida = await conn.exec(comando, {
      execTimeout: 60000,
      silencio: 2500,
    });
    // O tempo de conexão não vem no resumo: é um comando por cliente, então
    // fica sob demanda (botão na listagem) para não pesar o carregamento.
    return parseAccessUser(saida, servidor.nome);
  });
}
