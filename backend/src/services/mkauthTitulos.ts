import { Request } from "express";
import crypto from "crypto";
import { EntityManager } from "typeorm";

/**
 * O que a tela Mensalidades e o bolix da Efí gravam no MK-Auth ao mexer num
 * título. Copiado comparando o banco antes e depois da mesma ação feita no
 * próprio MK-Auth (ver controller/Mensalidades.ts).
 */

export class ErroDeUso extends Error {}

export const dois = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD HH:MM:SS" no horário do servidor, como o MK-Auth grava. */
export function agoraMk(d = new Date()) {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())} ${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`;
}

/** Recibo no mesmo formato do MK-Auth: 8 grupos de 7 hexas. */
export const novoRecibo = () =>
  Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString("hex").slice(0, 7),
  ).join(".");

// O MK-Auth grava o usuário em colunas curtas (coletor e usergerou têm 20
// caracteres): vai só a parte do login antes do "@".
export const usuarioDe = (req: Request) =>
  String((req as any).user?.login || "wipdiversos")
    .split("@")[0]
    .slice(0, 20);

/** Quem fez a ação: o usuário logado, ou a Efí quando é o aviso de pagamento. */
export type Autor = { usuario: string; ip: string };

export const autorDe = (x: Request | Autor): Autor =>
  "usuario" in x && typeof (x as Autor).usuario === "string"
    ? (x as Autor)
    : {
        usuario: usuarioDe(x as Request),
        ip: String((x as Request).ip || "").replace(/^::ffff:/, ""),
      };

export async function registrarAtividade(
  m: EntityManager,
  quem: Request | Autor,
  registro: string,
) {
  const a = autorDe(quem);
  await m.query(
    `INSERT INTO sis_ativ (id, registro, data, login, ip, tipo, operacao)
     VALUES (?, ?, ?, ?, ?, 'admin', ?)`,
    [
      crypto.randomUUID(),
      registro,
      agoraMk(),
      a.usuario,
      a.ip,
      crypto.randomBytes(4).toString("hex").toUpperCase(),
    ],
  );
}

export async function lancarCaixa(
  m: EntityManager,
  quem: Request | Autor,
  historico: string,
  entrada: number,
  saida: number,
) {
  await m.query(
    `INSERT INTO sis_caixa (uuid_caixa, usuario, data, historico, complemento,
                            entrada, saida, tipomov, planodecontas)
     VALUES (?, ?, ?, ?, '', ?, ?, 'aut', 'Outros')`,
    [
      crypto.randomUUID(),
      autorDe(quem).usuario,
      agoraMk(),
      historico,
      entrada.toFixed(2),
      saida.toFixed(2),
    ],
  );
}

export async function recalcularAbertos(m: EntityManager, login: string) {
  await m.query(
    `UPDATE sis_cliente SET tit_abertos =
       (SELECT COUNT(*) FROM sis_lanc
         WHERE login = ? AND deltitulo = 0 AND status IN ('aberto', 'vencido'))
     WHERE login = ?`,
    [login, login],
  );
}

/** Multa e mora do título hoje, pelos percentuais gravados nele. */
export function multaMoraDoTitulo(t: any) {
  const valor = Number(t.valor || 0);
  const venc = new Date(t.datavenc);
  venc.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.max(
    0,
    Math.round((hoje.getTime() - venc.getTime()) / 86_400_000),
  );
  if (!dias) return { multa: 0, mora: 0, dias };
  const multa = (valor * Number(t.percmulta || 0)) / 100;
  const mora = ((valor * Number(t.percmora || 0)) / 100 / 30) * dias;
  return {
    multa: Math.round(multa * 100) / 100,
    mora: Math.round(mora * 100) / 100,
    dias,
  };
}

/**
 * Baixa de um título (o "Receber" do MK-Auth): sis_lanc pago, entrada no
 * sis_caixa, sis_ativ e tit_abertos. `t` é a linha do sis_lanc já lida
 * dentro da mesma transação.
 */
export async function baixarTitulo(
  m: EntityManager,
  t: any,
  dados: {
    autor: Request | Autor;
    datapag: string;
    valor: number;
    formapag: string;
    coletor?: string;
    valormulta?: number;
    valormora?: number;
    valordesc?: number;
    fcartaobandeira?: string | null;
    fcartaonumero?: string | null;
    fchequebanco?: string | null;
    fchequenumero?: string | null;
    fchequeagcc?: string | null;
  },
) {
  const autor = autorDe(dados.autor);
  await m.query(
    `UPDATE sis_lanc SET status = 'pago', datapag = ?, valorpag = ?,
            formapag = ?, coletor = ?, recibo = ?,
            num_recibos = COALESCE(num_recibos, 0) + 1,
            valormulta = ?, valormora = ?, valordesc = ?,
            fcartaobandeira = ?, fcartaonumero = ?,
            fchequebanco = ?, fchequenumero = ?, fchequeagcc = ?
      WHERE id = ?`,
    [
      dados.datapag,
      dados.valor.toFixed(2),
      dados.formapag,
      (dados.coletor || autor.usuario).slice(0, 20),
      novoRecibo(),
      (dados.valormulta || 0).toFixed(2),
      (dados.valormora || 0).toFixed(2),
      (dados.valordesc || 0).toFixed(2),
      dados.fcartaobandeira ?? null,
      dados.fcartaonumero ?? null,
      dados.fchequebanco ?? null,
      dados.fchequenumero ?? null,
      dados.fchequeagcc ?? null,
      t.id,
    ],
  );
  await lancarCaixa(
    m,
    autor,
    `Recebimento do titulo ${t.id} / ${t.login}`,
    dados.valor,
    0,
  );
  await registrarAtividade(
    m,
    autor,
    `baixou o titulo de numero ${String(t.id).padStart(8, "0")}`,
  );
  await recalcularAbertos(m, t.login);
}

const MESES_ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/**
 * Mês que o título cobra, como "AAAA-MM". Vem da referência do MK-Auth
 * ("11/2026" nos títulos dele, "NOV/2026" nos criados pela tela); sem ela,
 * do mês do vencimento.
 */
export function competenciaDoTitulo(t: {
  referencia?: string | null;
  datavenc?: unknown;
}): string {
  const ref = String(t.referencia || "").trim().toUpperCase();
  let m = ref.match(/^(\d{1,2})\/(\d{4})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12)
    return `${m[2]}-${dois(Number(m[1]))}`;
  m = ref.match(/^([A-Z]{3})\/(\d{4})$/);
  if (m && MESES_ABREV.includes(m[1]))
    return `${m[2]}-${dois(MESES_ABREV.indexOf(m[1]) + 1)}`;
  const d = new Date(t.datavenc as any);
  return Number.isNaN(d.getTime())
    ? ""
    : `${d.getFullYear()}-${dois(d.getMonth() + 1)}`;
}
