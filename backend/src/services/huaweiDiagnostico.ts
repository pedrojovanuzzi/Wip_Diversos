import { SessaoOlt } from "./oltSsh";
import { ServidorConexao } from "./servidorAcesso.service";

export type ClienteHuawei = { userId: string; ip: string };

export type TestesRede = { ping: string; fr: string; velocidade: string };

/**
 * MTU típica de PPPoE: 1492. Descontando 28 bytes de cabeçalho ICMP/IP, o
 * maior payload que passa sem fragmentar é 1464.
 */
const PAYLOAD_SEM_FRAGMENTAR = 1464;

/** Localiza a sessão do cliente pelo login PPPoE. */
export async function localizarClienteHuawei(
  servidor: ServidorConexao,
  pppoe: string,
): Promise<ClienteHuawei | null> {
  const conn = await SessaoOlt.abrir(servidor);
  try {
    const saida = await conn.exec(`display access-user username ${pppoe}`, {
      execTimeout: 30000,
      silencio: 1500,
    });
    return extrairSessao(saida);
  } finally {
    await conn.end();
  }
}

export function extrairSessao(saida: string): ClienteHuawei | null {
  for (const linha of saida.split("\n")) {
    const campos = linha.trim().split(/\s+/);
    const ip = linha.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0];
    if (!ip || !/^\d+$/.test(campos[0])) continue;
    return { userId: campos[0], ip };
  }
  return null;
}

/** "Reply from ...: bytes=56 Sequence=1 ttl=62 time=4 ms" */
export function parsePing(saida: string): string {
  const resposta = saida.match(
    /bytes=(\d+)\s+Sequence=\d+\s+ttl=(\d+)\s+time=(\d+)\s*ms/i,
  );
  if (resposta) {
    return `SIZE ${resposta[1]} / TTL ${resposta[2]} / TIME ${resposta[3]}ms`;
  }
  const perda = saida.match(/([\d.]+)%\s*packet loss/i)?.[1];
  return perda === "100.00" || perda === "100"
    ? "Sem resposta ao ping"
    : "Resposta não reconhecida";
}

/** Sem perda no ping com DF ligado = passa o pacote inteiro sem fragmentar. */
export function parseFragmentacao(saida: string): string {
  const recebidos = Number(
    saida.match(/(\d+)\s+packet\(s\)\s+received/i)?.[1] ?? "0",
  );
  return recebidos > 0
    ? "Sem Fragmentação"
    : `Fragmentação: não passou com ${PAYLOAD_SEM_FRAGMENTAR} bytes e DF (MTU abaixo de 1492)`;
}

/** O detalhe da sessão traz a velocidade instantânea em kbyte/min. */
export function parseVelocidade(detalhe: string): {
  txBps: number;
  rxBps: number;
} {
  const kbytePorMinEmBps = (valor?: string) =>
    valor ? Math.round((Number(valor) * 1024 * 8) / 60) : 0;

  return {
    // Saída do provedor para o cliente = download do cliente.
    txBps: kbytePorMinEmBps(
      detalhe.match(/Ipv4 Realtime speed outbound[^\n]*?:\s*([\d.]+)/i)?.[1],
    ),
    rxBps: kbytePorMinEmBps(
      detalhe.match(/Ipv4 Realtime speed inbound[^\n]*?:\s*([\d.]+)/i)?.[1],
    ),
  };
}

function formatarBps(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)}Mbps`;
  if (bps >= 1000) return `${(bps / 1000).toFixed(1)}kbps`;
  return `${bps}bps`;
}

/** Ping, fragmentação e velocidade do cliente, em uma única sessão SSH. */
export async function testesRedeHuawei(
  servidor: ServidorConexao,
  cliente: ClienteHuawei,
): Promise<{ testes: TestesRede; conectado: boolean }> {
  const conn = await SessaoOlt.abrir(servidor);
  try {
    await conn
      .exec("screen-length 0 temporary", { execTimeout: 10000 })
      .catch(() => undefined);

    const ping = await conn.exec(`ping -c 2 ${cliente.ip}`, {
      execTimeout: 40000,
      silencio: 4000,
    });

    const fragmento = await conn.exec(
      `ping -s ${PAYLOAD_SEM_FRAGMENTAR} -f -c 2 ${cliente.ip}`,
      { execTimeout: 60000, silencio: 6000 },
    );

    const detalhe = await conn.exec(
      `display access-user user-id ${cliente.userId}`,
      { execTimeout: 20000, silencio: 1000 },
    );

    const { txBps, rxBps } = parseVelocidade(detalhe);

    return {
      testes: {
        ping: parsePing(ping),
        fr: parseFragmentacao(fragmento),
        velocidade: `⬇️ ${formatarBps(txBps)} / ⬆️ ${formatarBps(rxBps)}`,
      },
      // Se o detalhe respondeu, a sessão está de pé no BRAS.
      conectado: /User name/i.test(detalhe),
    };
  } finally {
    await conn.end();
  }
}

/** Consumo instantâneo, em bits por segundo, para o gráfico em tempo real. */
export async function consumoTempoRealHuawei(
  servidor: ServidorConexao,
  userId: string,
): Promise<{ txBps: number; rxBps: number }> {
  const conn = await SessaoOlt.abrir(servidor);
  try {
    const detalhe = await conn.exec(`display access-user user-id ${userId}`, {
      execTimeout: 20000,
      silencio: 800,
    });
    return parseVelocidade(detalhe);
  } finally {
    await conn.end();
  }
}
