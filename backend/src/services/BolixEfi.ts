import axios from "axios";
import path from "path";
import EfiPay from "sdk-node-apis-efi";
import MkauthSource from "../database/MkauthSource";
import AppDataSource from "../database/DataSource";
import { MensalidadeBolix } from "../entities/MensalidadeBolix";
import {
  agoraMk,
  Autor,
  baixarTitulo,
  competenciaDoTitulo,
  dois,
  ErroDeUso,
  multaMoraDoTitulo,
} from "./mkauthTitulos";

/**
 * Bolix (boleto + QR Pix) da Efí para os títulos do MK-Auth na tela
 * Mensalidades. A cobrança é criada pela API de Cobranças da Efí com as mesmas
 * credenciais do Pix (homologação quando SERVIDOR_HOMOLOGACAO=true).
 *
 * Pagamento: a Efí chama EFI_BOLIX_NOTIFICACAO_URL (rota pública
 * /api/mensalidades/efi/notificacao) só com um token; o token é conferido
 * na própria Efí antes de dar baixa, então um aviso falso não baixa nada.
 * Sem essa URL (ambiente local), o botão "Verificar pagamento" consulta a Efí.
 */

const isSandbox = process.env.SERVIDOR_HOMOLOGACAO === "true";

function efi() {
  return new EfiPay({
    sandbox: isSandbox,
    client_id: isSandbox
      ? process.env.CLIENT_ID_HOMOLOGACAO!
      : process.env.CLIENT_ID!,
    client_secret: isSandbox
      ? process.env.CLIENT_SECRET_HOMOLOGACAO!
      : process.env.CLIENT_SECRET!,
    certificate: isSandbox
      ? path.resolve("src", "files", process.env.CERTIFICATE_SANDBOX!)
      : path.resolve("dist", "files", process.env.CERTIFICATE_PROD!),
    validateMtls: false,
  } as any);
}

const repo = () => AppDataSource.getRepository(MensalidadeBolix);
const AUTOR_EFI: Autor = { usuario: "efi", ip: "efi" };
const PAGO = ["paid", "settled"];
const digitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const centavos = (n: number) => Math.round(n * 100);

function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

function isoDe(v: unknown) {
  const d = new Date(v as any);
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

/** Mensagem legível de um erro da Efí. */
function erroEfi(e: any): string {
  const d = e?.error_description;
  if (typeof d === "string") return d;
  if (d?.message)
    return d.property ? `${d.message} (${d.property})` : String(d.message);
  return e?.message || e?.error || "Erro na Efí.";
}

export async function bolixAtivo(tituloId: number) {
  return repo().findOne({
    where: { titulo_id: tituloId, situacao: "ativo" },
    order: { id: "DESC" },
  });
}

/** Bolix ativo de vários títulos de uma vez (para a lista de faturas). */
export async function bolixAtivos(ids: number[]) {
  if (!ids.length) return new Map<number, MensalidadeBolix>();
  const lista = await repo()
    .createQueryBuilder("b")
    .where("b.titulo_id IN (:...ids)", { ids })
    .andWhere("b.situacao = 'ativo'")
    .orderBy("b.id", "DESC")
    .getMany();
  const mapa = new Map<number, MensalidadeBolix>();
  for (const b of lista) if (!mapa.has(b.titulo_id)) mapa.set(b.titulo_id, b);
  return mapa;
}

/**
 * Devolve o bolix do título, criando na Efí se não houver um ativo com o
 * mesmo valor e vencimento. Título vencido ganha vencimento hoje, com multa e
 * mora do dia num item à parte (depois disso a própria Efí cobra).
 */
// Dois pedidos ao mesmo tempo para o mesmo título (duas abas, o React em
// modo de desenvolvimento) esperam o mesmo registro em vez de criar duas
// cobranças na Efí.
const emAndamento = new Map<number, Promise<MensalidadeBolix>>();

export function gerarBolix(
  tituloId: number,
  usuario: string,
  opcoes: { forcar?: boolean } = {},
): Promise<MensalidadeBolix> {
  const atual = emAndamento.get(tituloId);
  if (atual) return atual;
  const p = gerarBolixSemTrava(tituloId, usuario, opcoes).finally(() =>
    emAndamento.delete(tituloId),
  );
  emAndamento.set(tituloId, p);
  return p;
}

async function gerarBolixSemTrava(
  tituloId: number,
  usuario: string,
  opcoes: { forcar?: boolean },
) {
  const [t] = await MkauthSource.query(
    `SELECT l.*, COALESCE((SELECT SUM(IF(m.tipo = 'desconto', -m.valor, m.valor))
                             FROM sis_mlanc m
                            WHERE m.idlanc = l.id AND m.deltitulo = 0), 0) AS atrelados
       FROM sis_lanc l WHERE l.id = ? AND l.deltitulo = 0 LIMIT 1`,
    [tituloId],
  );
  if (!t) throw new ErroDeUso("Título não encontrado.");
  if (t.status === "pago") throw new ErroDeUso("Título já está pago.");

  const [c] = await MkauthSource.query(
    `SELECT nome, cpf_cnpj, email, celular, endereco, numero, bairro, cidade,
            estado, cep, complemento
       FROM sis_cliente WHERE login = ? LIMIT 1`,
    [t.login],
  );
  if (!c) throw new ErroDeUso("Cliente do título não encontrado.");

  const base = Number(t.valor || 0) + Number(t.atrelados || 0);
  const vencOriginal = isoDe(t.datavenc);
  const hoje = hojeIso();
  const vencido = vencOriginal < hoje;
  const { multa, mora } = vencido ? multaMoraDoTitulo(t) : { multa: 0, mora: 0 };
  const total = Math.round((base + multa + mora) * 100) / 100;
  const vencimento = vencido ? hoje : vencOriginal;
  if (total <= 0) throw new ErroDeUso("Título sem valor a cobrar.");

  const atual = await bolixAtivo(tituloId);
  if (
    atual &&
    !opcoes.forcar &&
    Number(atual.valor) === total &&
    String(atual.vencimento).slice(0, 10) === vencimento
  ) {
    return atual;
  }

  // Cliente: CPF (11 dígitos) ou CNPJ (14). A Efí recusa documento inválido.
  const doc = digitos(c.cpf_cnpj);
  const customer: any = {};
  if (doc.length === 14) {
    customer.juridical_person = {
      corporate_name: String(c.nome || "").slice(0, 255),
      cnpj: doc,
    };
  } else if (doc.length === 11) {
    customer.name = String(c.nome || "").slice(0, 255);
    customer.cpf = doc;
  } else {
    throw new ErroDeUso(
      "O cliente precisa de CPF ou CNPJ válido no cadastro do MK-Auth para gerar o boleto.",
    );
  }
  const fone = digitos(c.celular).replace(/^55(?=\d{10,11}$)/, "");
  if (fone.length === 10 || fone.length === 11) customer.phone_number = fone;
  const email = String(c.email || "").trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) customer.email = email;
  const cep = digitos(c.cep);
  if (
    cep.length === 8 &&
    c.endereco &&
    c.numero &&
    c.bairro &&
    c.cidade &&
    /^[A-Za-z]{2}$/.test(String(c.estado || ""))
  ) {
    customer.address = {
      street: String(c.endereco).slice(0, 200),
      number: String(c.numero).slice(0, 55),
      neighborhood: String(c.bairro).slice(0, 255),
      zipcode: cep,
      city: String(c.cidade),
      state: String(c.estado).toUpperCase(),
      ...(c.complemento ? { complement: String(c.complemento).slice(0, 55) } : {}),
    };
  }

  const numero = String(t.id).padStart(5, "0");
  const items: any[] = [
    {
      name: `Titulo ${numero} - ${t.tipo || "mensalidade"}${t.referencia ? ` ${t.referencia}` : ""}`.slice(0, 255),
      value: centavos(base),
      amount: 1,
    },
  ];
  if (multa + mora > 0)
    items.push({
      name: `Multa e juros do titulo ${numero}`,
      value: centavos(multa + mora),
      amount: 1,
    });

  const metadata: any = { custom_id: `mk-${t.id}` };
  if (process.env.EFI_BOLIX_NOTIFICACAO_URL)
    metadata.notification_url = process.env.EFI_BOLIX_NOTIFICACAO_URL;

  const configurations: any = {};
  const fine = Math.round(Number(t.percmulta || 0) * 100);
  const interest = Math.round((Number(t.percmora || 0) / 30) * 1000);
  if (fine > 0) configurations.fine = fine;
  if (interest > 0) configurations.interest = interest;

  let resposta: any;
  try {
    resposta = await efi().createOneStepCharge([] as any, {
      items,
      metadata,
      payment: {
        banking_billet: {
          expire_at: vencimento,
          customer,
          ...(Object.keys(configurations).length ? { configurations } : {}),
          ...(t.obs ? { message: String(t.obs).slice(0, 80) } : {}),
        },
      },
    } as any);
  } catch (e) {
    throw new ErroDeUso(`Efí recusou o boleto: ${erroEfi(e)}`);
  }
  const d = resposta?.data || resposta;
  if (!d?.charge_id) throw new ErroDeUso("A Efí não devolveu a cobrança.");

  // O anterior (valor ou vencimento antigos) sai de circulação.
  if (atual) await cancelarNaEfi(atual, "substituido");

  const novo = await repo().save({
    titulo_id: t.id,
    login_cliente: t.login,
    charge_id: String(d.charge_id),
    situacao: "ativo",
    valor: total.toFixed(2),
    vencimento,
    competencia: competenciaDoTitulo(t) || null,
    linha_digitavel: d.barcode || null,
    pix_copia_cola: d.pix?.qrcode || null,
    pix_qrcode_imagem: d.pix?.qrcode_image || null,
    link: d.billet_link || d.link || null,
    pdf: d.pdf?.charge || null,
    usuario,
    pago_em: null,
  });

  // Se outro processo criou um ao mesmo tempo, fica só o mais novo.
  const sobrando = await repo().find({
    where: { titulo_id: t.id, situacao: "ativo" },
  });
  for (const outro of sobrando)
    if (outro.id !== novo.id) await cancelarNaEfi(outro, "substituido");

  // A linha digitável também vai para o título, onde o MK-Auth e o resto do
  // sistema (NFCom, totem) já procuram.
  if (d.barcode)
    await MkauthSource.query(`UPDATE sis_lanc SET linhadig = ? WHERE id = ?`, [
      d.barcode,
      t.id,
    ]);
  return novo;
}

async function cancelarNaEfi(b: MensalidadeBolix, situacao: string) {
  try {
    await efi().cancelCharge({ id: Number(b.charge_id) } as any);
  } catch (e) {
    // Já paga, vencida ou cancelada na Efí: segue, mas fica no log.
    console.warn(
      `[Bolix] não cancelou a cobrança ${b.charge_id} na Efí: ${erroEfi(e)}`,
    );
  }
  await repo().update({ id: b.id }, { situacao });
}

/** Tira de circulação o bolix ativo (título recebido, alterado ou excluído). */
export async function cancelarBolixDoTitulo(tituloId: number, motivo: string) {
  try {
    const b = await bolixAtivo(tituloId);
    if (!b) return;
    console.log(`[Bolix] cancelando ${b.charge_id} do título ${tituloId}: ${motivo}`);
    await cancelarNaEfi(b, "cancelado");
  } catch (e) {
    console.error(`[Bolix] erro ao cancelar bolix do título ${tituloId}:`, e);
  }
}

/**
 * PDFs dos bolix para anexar no e-mail. O link vem da própria Efí (gravado
 * no banco, nunca do pedido) e só se baixa de domínio da Efí. Boleto cujo PDF
 * não baixar fica de fora: o e-mail ainda leva o link, a linha e o Pix.
 */
const PDF_MAXIMO = 5 * 1024 * 1024;

export async function anexosDosBolix(lista: MensalidadeBolix[]) {
  const anexos: { filename: string; content: Buffer; contentType: string }[] = [];
  for (const b of lista) {
    if (!b?.pdf) continue;
    try {
      const url = new URL(b.pdf);
      if (
        url.protocol !== "https:" ||
        !/(^|\.)(sejaefi\.com\.br|gerencianet\.com\.br|efipay\.com\.br)$/.test(url.hostname)
      )
        throw new Error(`domínio fora da Efí: ${url.hostname}`);
      const r = await axios.get<ArrayBuffer>(b.pdf, {
        responseType: "arraybuffer",
        timeout: 20_000,
        maxContentLength: PDF_MAXIMO,
      });
      const content = Buffer.from(r.data);
      if (content.subarray(0, 5).toString() !== "%PDF-")
        throw new Error("a Efí não devolveu um PDF");
      anexos.push({
        filename: `boleto-${String(b.titulo_id).padStart(5, "0")}.pdf`,
        content,
        contentType: "application/pdf",
      });
    } catch (e: any) {
      console.warn(
        `[Bolix] PDF da cobrança ${b.charge_id} não anexado: ${e?.message || e}`,
      );
    }
  }
  return anexos;
}

/** Situação do bolix cancelado pelo botão: a geração automática não refaz. */
export const CANCELADO_MANUAL = "cancelado_manual";

/**
 * Botão "Cancelar boleto": cancela na Efí a cobrança ativa do título. Ao
 * contrário de cancelarBolixDoTitulo, falha se a Efí recusar (cobrança já
 * paga, por exemplo), para o operador não achar que cancelou. O título no
 * MK-Auth continua em aberto; só perde a linha digitável deste boleto.
 */
export async function cancelarBolixManual(tituloId: number, usuario: string) {
  const b = await bolixAtivo(tituloId);
  if (!b) throw new ErroDeUso("Este título não tem boleto ativo para cancelar.");
  try {
    await efi().cancelCharge({ id: Number(b.charge_id) } as any);
  } catch (e) {
    // Já cancelada na Efí (por fora): só acerta o nosso registro.
    let status = "";
    try {
      const r: any = await efi().detailCharge({ id: Number(b.charge_id) } as any);
      status = String((r?.data || r)?.status || "");
    } catch {
      /* fica com o erro do cancelamento */
    }
    if (PAGO.includes(status))
      throw new ErroDeUso(
        "A cobrança já foi paga na Efí. Use \"Verificar pagamento\" para dar baixa.",
      );
    if (status !== "canceled")
      throw new ErroDeUso(`Efí não cancelou o boleto: ${erroEfi(e)}`);
  }
  console.log(
    `[Bolix] ${usuario} cancelou a cobrança ${b.charge_id} do título ${tituloId}`,
  );
  await repo().update({ id: b.id }, { situacao: CANCELADO_MANUAL });
  if (b.linha_digitavel)
    await MkauthSource.query(
      `UPDATE sis_lanc SET linhadig = '' WHERE id = ? AND linhadig = ?`,
      [tituloId, b.linha_digitavel],
    );
  return { cancelado: true, charge_id: b.charge_id };
}

/** Títulos cujo último bolix foi cancelado pelo botão (a automação pula). */
export async function canceladosManualmente(ids: number[]) {
  if (!ids.length) return new Set<number>();
  const linhas: { titulo_id: number; situacao: string }[] = await repo()
    .createQueryBuilder("b")
    .select(["b.titulo_id AS titulo_id", "b.situacao AS situacao"])
    .where("b.titulo_id IN (:...ids)", { ids })
    .orderBy("b.id", "DESC")
    .getRawMany();
  const vistos = new Set<number>();
  const cancelados = new Set<number>();
  for (const l of linhas) {
    const id = Number(l.titulo_id);
    if (vistos.has(id)) continue;
    vistos.add(id);
    if (l.situacao === CANCELADO_MANUAL) cancelados.add(id);
  }
  return cancelados;
}

/** Dá baixa no título da cobrança paga. Seguro de chamar mais de uma vez. */
async function baixarPorCobranca(chargeId: string, valorPagoCentavos?: number) {
  const b = await repo().findOne({ where: { charge_id: chargeId } });
  if (!b) {
    console.warn(`[Bolix] pagamento da cobrança ${chargeId} sem bolix nosso`);
    return { baixado: false, motivo: "cobrança desconhecida" };
  }
  if (b.situacao === "pago") return { baixado: false, motivo: "já baixado" };

  const valor =
    valorPagoCentavos && valorPagoCentavos > 0
      ? valorPagoCentavos / 100
      : Number(b.valor);
  let baixado = false;
  await MkauthSource.transaction(async (m) => {
    const [t] = await m.query(
      `SELECT * FROM sis_lanc WHERE id = ? LIMIT 1`,
      [b.titulo_id],
    );
    if (!t) return;
    if (t.status === "pago" || t.deltitulo) {
      // Recebido por outro caminho antes do aviso: alguém precisa estornar.
      console.warn(
        `[Bolix] título ${t.id} já estava ${t.deltitulo ? "excluído" : "pago"} quando a cobrança ${chargeId} foi paga (R$ ${valor.toFixed(2)})`,
      );
      return;
    }
    const { multa, mora } = multaMoraDoTitulo(t);
    await baixarTitulo(m, t, {
      autor: AUTOR_EFI,
      datapag: agoraMk(),
      valor,
      formapag: "bolix",
      coletor: "efi",
      valormulta: Math.min(multa, Math.max(0, valor - Number(t.valor || 0))),
      valormora: Math.min(
        mora,
        Math.max(0, valor - Number(t.valor || 0) - multa),
      ),
    });
    baixado = true;
  });
  await repo().update(
    { id: b.id },
    { situacao: "pago", pago_em: new Date() },
  );
  return { baixado, motivo: baixado ? "" : "título já estava pago ou excluído" };
}

/** Botão "Verificar pagamento": consulta a cobrança ativa na Efí. */
export async function verificarBolix(tituloId: number) {
  const b = await bolixAtivo(tituloId);
  if (!b) throw new ErroDeUso("Este título não tem bolix ativo.");
  let d: any;
  try {
    const r: any = await efi().detailCharge({ id: Number(b.charge_id) } as any);
    d = r?.data || r;
  } catch (e) {
    throw new ErroDeUso(`Erro ao consultar a Efí: ${erroEfi(e)}`);
  }
  const status = String(d?.status || "");
  if (PAGO.includes(status)) {
    const pago = Number(d?.paid_value || d?.total || 0);
    const r = await baixarPorCobranca(b.charge_id, pago || undefined);
    return { status, ...r };
  }
  return { status, baixado: false, motivo: "" };
}

/**
 * Rede de segurança do aviso da Efí: lista na Efí os boletos criados desde o
 * bolix ativo mais antigo e dá baixa nos que estão pagos. Cobre cobrança
 * criada sem notification_url (EFI_BOLIX_NOTIFICACAO_URL vazio), aviso
 * perdido com o servidor fora do ar e qualquer falha da rota pública.
 */
let conferindo = false;

export async function conferirPagamentosNaEfi() {
  if (conferindo) return { conferidos: 0, baixados: 0 };
  conferindo = true;
  try {
    const ativos = await repo().find({
      where: { situacao: "ativo" },
      select: ["id", "charge_id", "criado_em"],
    });
    if (!ativos.length) return { conferidos: 0, baixados: 0 };
    const nossos = new Set(ativos.map((b) => String(b.charge_id)));

    const umAno = new Date();
    umAno.setFullYear(umAno.getFullYear() - 1);
    const maisAntigo = ativos.reduce(
      (m, b) => (new Date(b.criado_em) < m ? new Date(b.criado_em) : m),
      new Date(),
    );
    const inicio = isoDe(maisAntigo < umAno ? umAno : maisAntigo);

    const pagos: string[] = [];
    const LIMITE = 100; // máximo da Efí por página
    for (let page = 1; page <= 100; page++) {
      const r: any = await efi().listCharges({
        charge_type: "billet",
        begin_date: inicio,
        end_date: hojeIso(),
        limit: LIMITE,
        page,
      } as any);
      const lista: any[] = r?.data || [];
      for (const c of lista) {
        const id = String(c?.id ?? c?.charge_id ?? "");
        if (nossos.has(id) && PAGO.includes(String(c?.status))) pagos.push(id);
      }
      if (lista.length < LIMITE) break;
    }

    let baixados = 0;
    for (const chargeId of pagos) {
      try {
        // O detalhe traz o valor pago (com multa/juros, se houver).
        const d: any = await efi().detailCharge({ id: Number(chargeId) } as any);
        const x = d?.data || d;
        if (!PAGO.includes(String(x?.status))) continue;
        const pago = Number(x?.paid_value || x?.total || 0);
        const r = await baixarPorCobranca(chargeId, pago || undefined);
        if (r.baixado) baixados++;
        console.log(`[Bolix] conferência: cobrança ${chargeId} paga: ${JSON.stringify(r)}`);
      } catch (e) {
        console.error(`[Bolix] conferência: erro na cobrança ${chargeId}:`, e);
      }
    }
    return { conferidos: ativos.length, baixados };
  } finally {
    conferindo = false;
  }
}

/** Aviso da Efí: só traz o token; o histórico vem da própria Efí. */
export async function processarNotificacao(token: string) {
  const r: any = await efi().getNotification({ token } as any);
  const eventos: any[] = r?.data || [];
  const resultados = [];
  for (const ev of eventos) {
    const chargeId = String(ev?.identifiers?.charge_id || "");
    const atual = String(ev?.status?.current || "");
    if (!chargeId || ev?.type !== "charge" || !PAGO.includes(atual)) continue;
    resultados.push({
      chargeId,
      ...(await baixarPorCobranca(chargeId, Number(ev?.value || 0) || undefined)),
    });
  }
  return resultados;
}
