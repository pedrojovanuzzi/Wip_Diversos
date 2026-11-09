import { Request, Response } from "express";
import crypto from "crypto";
import { EntityManager } from "typeorm";
import MkauthSource from "../database/MkauthSource";
import AppDataSource from "../database/DataSource";
import { MensalidadeNota } from "../entities/MensalidadeNota";
import Email from "./Email";
import {
  agoraMk,
  baixarTitulo,
  dois,
  ErroDeUso,
  lancarCaixa,
  multaMoraDoTitulo,
  recalcularAbertos,
  registrarAtividade,
  usuarioDe,
} from "../services/mkauthTitulos";
import {
  bolixAtivos,
  cancelarBolixDoTitulo,
  gerarBolix,
  processarNotificacao,
  verificarBolix,
} from "../services/BolixEfi";
import {
  lerConfig,
  rodarGeracao,
  salvarConfig,
  situacaoGeracao,
  ultimaExecucao,
  ultimaVerificacao,
} from "../services/MensalidadesAutomacao";

/**
 * Tela "Mensalidades": a lista de clientes do MK-Auth (admin/clientes.hhvm) e,
 * ao abrir um cliente, a aba Financeiro de admin/cliente_det.hhvm com as
 * mesmas ações (Eventos e Suporte ficam no próprio MK-Auth).
 *
 * As ações gravam direto no banco do MK-Auth, como o Pix e o PayGo já fazem.
 * O que cada uma grava foi copiado comparando o banco antes e depois da mesma
 * ação feita no próprio MK-Auth:
 * - receber: sis_lanc pago + entrada no sis_caixa + sis_ativ
 * - estornar: sis_lanc volta a aberto + saída no sis_caixa + sis_ativ
 * - alterar: sis_lanc + sis_ativ
 * - atrelar: sis_mlanc (o valor do sis_lanc não muda; a tela soma) + sis_ativ
 * - novo título: sis_lanc + sis_ativ
 * Em todas, sis_cliente.tit_abertos é recalculado (o MK-Auth faz o mesmo).
 * O desbloqueio de quem pagou continua com o próprio MK-Auth
 * (view vtab_desbloqueio), e o boleto é registrado no gateway quando alguém
 * abre /boleto/boleto.hhvm, como acontece com títulos criados lá.
 */

// Campos que a busca aceita. A chave vem do <select> da tela e nunca entra no
// SQL sem passar por esta lista.
const CAMPOS_BUSCA: Record<string, string> = {
  nome: "c.nome",
  nome_res: "c.nome_res",
  login: "c.login",
  cpf_cnpj: "c.cpf_cnpj",
  email: "c.email",
  plano: "c.plano",
  ip: "c.ip",
  endereco: "c.endereco",
  bairro: "c.bairro",
  cidade: "c.cidade",
  celular: "c.celular",
};

// Mesmos filtros do menu CLIENTES do MK-Auth.
const FILTROS_TIPO: Record<string, string> = {
  todos: "c.cli_ativado = 's'",
  bloqueados: "c.cli_ativado = 's' AND c.bloqueado = 'sim'",
  liberados: "c.cli_ativado = 's' AND c.bloqueado <> 'sim'",
  desativados: "c.cli_ativado = 'n'",
};

const POR_PAGINA = [50, 100];
const FORMAS_PAGAMENTO = ["dinheiro", "cheque", "cartao", "vale", "outros"];
const TIPOS_TITULO = ["mensalidade", "servicos", "outros"];
const TIPOS_ATRELADO = ["servicos", "outros", "desconto"];
const MESES = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

// Envio em lote é sequencial (o SMTP usa uma conexão só); acima disso a
// requisição demoraria demais.
const LOTE_MAXIMO = 200;

const dataBr = (v: unknown) => {
  const d = new Date(v as any);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};
const reaisBr = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------- utilidades ----------


/** Aceita 79.9, "79,90", "1.234,56" ou "1234.56". */
function dinheiro(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const limpo = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function dataValida(s: unknown): string | null {
  const m = String(s ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : `${m[1]}-${m[2]}-${m[3]}`;
}

/** "2026-11-09T15:02" (datetime-local) -> "2026-11-09 15:02:00". */
function dataHoraValida(s: unknown): string | null {
  const m = String(s ?? "").match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6] || "00"}`;
}

function somarMeses(iso: string, meses: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimo));
  return `${alvo.getFullYear()}-${dois(alvo.getMonth() + 1)}-${dois(alvo.getDate())}`;
}

const nivelDe = (req: Request) => Number((req as any).user?.permission || 0);





async function tituloOuErro(m: EntityManager, id: number) {
  const [t] = await m.query(
    `SELECT * FROM sis_lanc WHERE id = ? AND deltitulo = 0 LIMIT 1`,
    [id],
  );
  if (!t) throw new ErroDeUso("Título não encontrado.");
  return t;
}

/** Valor que a tela mostra: o do título mais os atrelados (desconto subtrai). */
function valorComAtrelados(valor: unknown, atrelados: any[]) {
  return (
    Number(valor || 0) +
    atrelados.reduce(
      (s, a) => s + (a.tipo === "desconto" ? -1 : 1) * Number(a.valor || 0),
      0,
    )
  );
}

function responderErro(res: Response, error: unknown, contexto: string) {
  if (error instanceof ErroDeUso) {
    res.status(400).json({ message: error.message });
    return;
  }
  console.error(`[Mensalidades] ${contexto}:`, error);
  res.status(500).json({ message: "Erro ao falar com o MK-Auth." });
}

/** Endereço do MK-Auth em uso, para o botão Boleto abrir a página dele. */
function urlMkauth() {
  if (process.env.MKAUTH_TESTE === "true") {
    return (
      process.env.MKAUTH_TESTE_URL ||
      `http://${process.env.MKAUTH_TESTE_HOST || "127.0.0.1"}`
    );
  }
  return process.env.MKAUTH_URL || "";
}

// ---------- controller ----------

class Mensalidades {
  listarClientes = async (req: Request, res: Response) => {
    try {
      const porPaginaPedida = Number(req.query.porPagina) || 50;
      const porPagina = POR_PAGINA.includes(porPaginaPedida)
        ? porPaginaPedida
        : 50;
      const pagina = Math.max(1, Math.floor(Number(req.query.pagina) || 1));
      const tipo = FILTROS_TIPO[String(req.query.tipo || "todos")]
        ? String(req.query.tipo || "todos")
        : "todos";
      const busca = String(req.query.busca || "").trim();
      const coluna = CAMPOS_BUSCA[String(req.query.campo || "nome")];

      const where = [FILTROS_TIPO[tipo]];
      const params: any[] = [];
      if (busca && coluna) {
        where.push(`${coluna} LIKE ?`);
        params.push(`%${busca}%`);
      }
      const whereSql = where.join(" AND ");

      const [{ total }] = await MkauthSource.query(
        `SELECT COUNT(*) AS total FROM sis_cliente c WHERE ${whereSql}`,
        params,
      );

      const clientes = await MkauthSource.query(
        `SELECT c.id, c.uuid_cliente AS uuid, c.login, c.nome, c.plano, c.ip,
                c.ramal, c.bloqueado, c.cli_ativado,
                (SELECT COUNT(*) FROM sis_lanc l
                  WHERE l.login = c.login AND l.deltitulo = 0
                    AND l.status IN ('aberto', 'vencido')) AS abertos
           FROM sis_cliente c
          WHERE ${whereSql}
          ORDER BY c.nome ASC, c.id ASC
          LIMIT ? OFFSET ?`,
        [...params, porPagina, (pagina - 1) * porPagina],
      );

      res.json({
        total: Number(total),
        pagina,
        porPagina,
        clientes: clientes.map((c: any) => ({
          ...c,
          abertos: Number(c.abertos),
        })),
      });
    } catch (error) {
      responderErro(res, error, "listarClientes");
    }
  };

  faturasDoCliente = async (req: Request, res: Response) => {
    try {
      const login = String(req.params.login || "");
      const [cliente] = await MkauthSource.query(
        `SELECT id, uuid_cliente AS uuid, login, nome, plano, ip, email,
                bloqueado, cli_ativado, venc, obs
           FROM sis_cliente WHERE login = ? LIMIT 1`,
        [login],
      );
      if (!cliente) {
        res.status(404).json({ message: "Cliente não encontrado." });
        return;
      }

      const titulos = await MkauthSource.query(
        `SELECT id, tipo, status, datavenc, datapag, nossonum, valor, valorpag,
                coletor, formapag, num_retornos, linhadig, uuid_lanc, obs,
                recibo, referencia, percmulta, percmora, valordesc,
                valormulta, valormora
           FROM sis_lanc
          WHERE login = ? AND deltitulo = 0
          ORDER BY datavenc ASC, id ASC`,
        [login],
      );

      const ids = titulos.map((t: any) => t.id);
      const atrelados = ids.length
        ? await MkauthSource.query(
            `SELECT id, idlanc, valor, tipo, \`desc\` AS descricao
               FROM sis_mlanc WHERE deltitulo = 0 AND idlanc IN (?)`,
            [ids],
          )
        : [];
      const notas = ids.length
        ? await AppDataSource.query(
            `SELECT titulo_id, COUNT(*) AS n FROM mensalidade_notas
              WHERE titulo_id IN (?) GROUP BY titulo_id`,
            [ids],
          )
        : [];
      const notasPor = new Map(
        notas.map((n: any) => [Number(n.titulo_id), Number(n.n)]),
      );

      const bolixPor = await bolixAtivos(ids);

      const completos = titulos.map((t: any) => {
        const itens = atrelados.filter((a: any) => a.idlanc === t.id);
        const bx = bolixPor.get(t.id);
        return {
          ...t,
          atrelados: itens,
          valorTotal: valorComAtrelados(t.valor, itens),
          notas: notasPor.get(t.id) || 0,
          // Sem a imagem do QR (pesada): ela vem ao abrir o boleto.
          bolix: bx
            ? {
                valor: bx.valor,
                vencimento: bx.vencimento,
                linha_digitavel: bx.linha_digitavel,
                pix_copia_cola: bx.pix_copia_cola,
                link: bx.link,
                pdf: bx.pdf,
              }
            : null,
        };
      });

      const abertos = completos.filter(
        (t: any) => t.status === "aberto" || t.status === "vencido",
      );
      const pagos = completos.filter((t: any) => t.status === "pago").reverse();
      const totalAberto = abertos.reduce(
        (soma: number, t: any) => soma + t.valorTotal,
        0,
      );

      const [provedor] = await MkauthSource.query(
        `SELECT nome, razao, cnpj, endereco, bairro, cidade, estado, fone
           FROM sis_provedor LIMIT 1`,
      );

      res.json({
        cliente,
        abertos,
        pagos,
        totalAberto,
        provedor: provedor || null,
        mkauthUrl: urlMkauth(),
        nivel: nivelDe(req),
      });
    } catch (error) {
      responderErro(res, error, "faturasDoCliente");
    }
  };

  /** Valores iniciais do formulário "Novo título", como o MK-Auth sugere. */
  sugestaoNovoTitulo = async (req: Request, res: Response) => {
    try {
      const login = String(req.params.login || "");
      const [c] = await MkauthSource.query(
        `SELECT c.venc, c.plano, p.valor AS valor_plano
           FROM sis_cliente c LEFT JOIN sis_plano p ON p.nome = c.plano
          WHERE c.login = ? LIMIT 1`,
        [login],
      );
      if (!c) throw new ErroDeUso("Cliente não encontrado.");
      const [ultimo] = await MkauthSource.query(
        `SELECT DATE_FORMAT(MAX(datavenc), '%Y-%m-%d') AS d FROM sis_lanc
          WHERE login = ? AND deltitulo = 0 AND tipo = 'mensalidade'`,
        [login],
      );
      let vencimento: string;
      if (ultimo?.d) {
        vencimento = somarMeses(ultimo.d, 1);
      } else {
        const hoje = new Date();
        const dia = Math.min(28, Math.max(1, Number(c.venc) || 10));
        const base = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
        if (base <= hoje) base.setMonth(base.getMonth() + 1);
        vencimento = `${base.getFullYear()}-${dois(base.getMonth() + 1)}-${dois(base.getDate())}`;
      }
      res.json({ vencimento, valor: Number(c.valor_plano || 0) });
    } catch (error) {
      responderErro(res, error, "sugestaoNovoTitulo");
    }
  };

  receber = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const formapag = String(b.formapag || "dinheiro");
      if (!FORMAS_PAGAMENTO.includes(formapag))
        throw new ErroDeUso("Forma de pagamento inválida.");
      const datapag = dataHoraValida(b.data) || agoraMk();
      const valor = dinheiro(b.valor);
      const acrescimo = dinheiro(b.acrescimo);
      const multaMora = dinheiro(b.multa_mora);
      const desconto = dinheiro(b.desconto);
      if ([valor, acrescimo, multaMora, desconto].some(Number.isNaN))
        throw new ErroDeUso("Valor inválido.");
      if (valor <= 0) throw new ErroDeUso("Informe o valor pago.");
      const insnext = ["sim", "nao", "nada"].includes(b.insnext)
        ? b.insnext
        : "nao";

      let aviso = "";
      await MkauthSource.transaction(async (m) => {
        const t = await tituloOuErro(m, id);
        if (t.status === "pago") throw new ErroDeUso("Título já está pago.");

        // A multa/mora informada vai para as colunas na mesma proporção do
        // que o título calcula; sem cálculo, tudo como multa.
        const { multa, mora } = multaMoraDoTitulo(t);
        const base = multa + mora;
        const vMulta = base > 0 ? (multaMora * multa) / base : multaMora;
        const vMora = multaMora - vMulta;

        await baixarTitulo(m, t, {
          autor: req,
          datapag,
          valor,
          formapag,
          valormulta: vMulta,
          valormora: vMora,
          valordesc: desconto,
          fcartaobandeira: formapag === "cartao" ? b.fcartaobandeira || null : null,
          fcartaonumero: formapag === "cartao" ? b.fcartaonumero || null : null,
          fchequebanco: formapag === "cheque" ? b.fchequebanco || null : null,
          fchequenumero: formapag === "cheque" ? b.fchequenumero || null : null,
          fchequeagcc: formapag === "cheque" ? b.fchequeagcc || null : null,
        });

        // "Incluir juros/mora em outra mensalidade": vira um atrelado na
        // próxima mensalidade em aberto.
        if (insnext === "sim" && base > 0) {
          const [proxima] = await m.query(
            `SELECT id FROM sis_lanc
              WHERE login = ? AND deltitulo = 0 AND tipo = 'mensalidade'
                AND status IN ('aberto', 'vencido') AND id <> ?
              ORDER BY datavenc ASC LIMIT 1`,
            [t.login, id],
          );
          if (proxima) {
            await m.query(
              `INSERT INTO sis_mlanc (idlanc, valor, tipo, cfop_mlanc, \`desc\`, deltitulo)
               VALUES (?, ?, 'outros', 'X949', ?, 0)`,
              [
                proxima.id,
                base.toFixed(2),
                `multa/mora do titulo ${id}`,
              ],
            );
          } else {
            aviso =
              "Não há outra mensalidade em aberto para incluir a multa/mora.";
          }
        }

      });
      // Pago aqui: o bolix que estava em aberto na Efí não pode ser pago de novo.
      await cancelarBolixDoTitulo(id, "titulo recebido na tela");
      res.json({ ok: true, aviso });
    } catch (error) {
      responderErro(res, error, "receber");
    }
  };

  estornar = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      await MkauthSource.transaction(async (m) => {
        const t = await tituloOuErro(m, id);
        if (t.status !== "pago")
          throw new ErroDeUso("Só dá para estornar título pago.");
        await m.query(
          `UPDATE sis_lanc SET status = 'aberto', datapag = NULL,
                  valorpag = NULL, recibo = NULL WHERE id = ?`,
          [id],
        );
        await lancarCaixa(
          m,
          req,
          `Titulo ${id} estornado`,
          0,
          Number(t.valorpag || 0),
        );
        await registrarAtividade(m, req, `estornou o titulo de numero ${id}`);
        await recalcularAbertos(m, t.login);
      });
      res.json({ ok: true });
    } catch (error) {
      responderErro(res, error, "estornar");
    }
  };

  alterar = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const datavenc = dataValida(b.datavenc);
      if (!datavenc) throw new ErroDeUso("Vencimento inválido.");
      const tipo = String(b.tipo || "");
      if (!TIPOS_TITULO.includes(tipo)) throw new ErroDeUso("Tipo inválido.");
      const valor = dinheiro(b.valor);
      if (Number.isNaN(valor) || valor <= 0)
        throw new ErroDeUso("Valor inválido.");
      const obs = String(b.obs ?? "").slice(0, 255);

      let login = "";
      let mudouCobranca = false;
      await MkauthSource.transaction(async (m) => {
        const t = await tituloOuErro(m, id);
        if (t.status === "pago")
          throw new ErroDeUso("Título pago não pode ser alterado.");
        login = t.login;
        const mudouVenc =
          agoraMk(new Date(t.datavenc)).slice(0, 10) !== datavenc;
        mudouCobranca = mudouVenc || Number(t.valor) !== valor;
        await m.query(
          `UPDATE sis_lanc SET datavenc = ?, tipo = ?, obs = ?, valor = ?,
                  alt_venc = IF(?, 1, alt_venc)
            WHERE id = ?`,
          [`${datavenc} 00:00:00`, tipo, obs, valor.toFixed(2), mudouVenc, id],
        );
        const [c] = await m.query(
          `SELECT nome FROM sis_cliente WHERE login = ? LIMIT 1`,
          [t.login],
        );
        await registrarAtividade(
          m,
          req,
          `alterou lancamentos do cliente: ${String(c?.nome || t.login).toLowerCase()}`,
        );
      });

      // Valor ou vencimento novos: o bolix antigo não vale mais.
      if (mudouCobranca) await cancelarBolixDoTitulo(id, "titulo alterado");
      const nota = String(b.nota ?? "").trim();
      if (nota) await this.gravarNota(id, login, nota, req);
      res.json({ ok: true });
    } catch (error) {
      responderErro(res, error, "alterar");
    }
  };

  atrelar = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const tipo = String(b.tipo || "");
      if (!TIPOS_ATRELADO.includes(tipo)) throw new ErroDeUso("Tipo inválido.");
      const valor = dinheiro(b.valor);
      if (Number.isNaN(valor) || valor <= 0)
        throw new ErroDeUso("Informe o valor.");
      const descricao = String(b.descricao ?? "").slice(0, 255);
      await MkauthSource.transaction(async (m) => {
        const t = await tituloOuErro(m, id);
        if (t.status === "pago" || t.tipo !== "mensalidade")
          throw new ErroDeUso("Só dá para atrelar em mensalidade em aberto.");
        await m.query(
          `INSERT INTO sis_mlanc (idlanc, valor, tipo, cfop_mlanc, \`desc\`, deltitulo)
           VALUES (?, ?, ?, 'X949', ?, 0)`,
          [id, valor.toFixed(2), tipo, descricao],
        );
        await registrarAtividade(
          m,
          req,
          `atrelou um lancamento ao titulo ${id}`,
        );
      });
      await cancelarBolixDoTitulo(id, "lancamento atrelado");
      res.json({ ok: true });
    } catch (error) {
      responderErro(res, error, "atrelar");
    }
  };

  removerAtrelado = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const atrelado = Number(req.params.atrelado);
      await MkauthSource.transaction(async (m) => {
        const t = await tituloOuErro(m, id);
        if (t.status === "pago")
          throw new ErroDeUso("Título pago não pode ser alterado.");
        const r = await m.query(
          `UPDATE sis_mlanc SET deltitulo = 1
            WHERE id = ? AND idlanc = ? AND deltitulo = 0`,
          [atrelado, id],
        );
        if (!r?.affectedRows) throw new ErroDeUso("Lançamento não encontrado.");
        await registrarAtividade(
          m,
          req,
          `removeu um lancamento atrelado ao titulo ${id}`,
        );
      });
      await cancelarBolixDoTitulo(id, "lancamento atrelado removido");
      res.json({ ok: true });
    } catch (error) {
      responderErro(res, error, "removerAtrelado");
    }
  };

  novoTitulo = async (req: Request, res: Response) => {
    try {
      const login = String(req.params.login || "");
      const b = req.body || {};
      const parcelas = Math.floor(Number(b.parcelas) || 1);
      if (parcelas < 1 || parcelas > 24)
        throw new ErroDeUso("Quantidade de títulos inválida.");
      const tipo = String(b.tipo || "mensalidade");
      if (!TIPOS_TITULO.includes(tipo)) throw new ErroDeUso("Tipo inválido.");
      const vencimento = dataValida(b.vencimento);
      if (!vencimento) throw new ErroDeUso("Vencimento inválido.");
      const valor = dinheiro(b.valor);
      const desconto = dinheiro(b.desconto);
      const acrescimo = dinheiro(b.acrescimo);
      if ([valor, desconto, acrescimo].some(Number.isNaN))
        throw new ErroDeUso("Valor inválido.");
      const final = valor - desconto + acrescimo;
      if (final <= 0) throw new ErroDeUso("O valor do título precisa ser maior que zero.");
      const descricao = String(b.descricao ?? "").slice(0, 255);
      const usuario = usuarioDe(req);

      const criados: number[] = [];
      await MkauthSource.transaction(async (m) => {
        const [c] = await m.query(
          `SELECT c.nome, c.conta, c.mesref, p.cfop_plano
             FROM sis_cliente c LEFT JOIN sis_plano p ON p.nome = c.plano
            WHERE c.login = ? LIMIT 1`,
          [login],
        );
        if (!c) throw new ErroDeUso("Cliente não encontrado.");
        const [conta] = await m.query(
          `SELECT gateway, multa, juros FROM sis_boleto WHERE id = ? LIMIT 1`,
          [Number(c.conta) || 1],
        );

        for (let i = 0; i < parcelas; i++) {
          const venc = somarMeses(vencimento, i);
          const [a, mes] = venc.split("-").map(Number);
          // mesref "ant": a mensalidade cobra o mês anterior ao vencimento.
          const ref = new Date(a, mes - 1 - (c.mesref === "ant" ? 1 : 0), 1);
          const referencia = `${MESES[ref.getMonth()]}/${ref.getFullYear()}`;
          const r = await m.query(
            `INSERT INTO sis_lanc
               (datavenc, nossonum, status, login, tipo, cfop_lanc, obs,
                processamento, aviso, usergerou, valorger, linhadig, valor, imp,
                referencia, tipocob, numconta, gerourem, percmulta, percmora,
                deltitulo, num_recibos, num_retornos, alt_venc, uuid_lanc)
             VALUES (?, ?, 'aberto', ?, ?, ?, ?, ?, 'nao', ?, 'completo', '', ?,
                     'nao', ?, 'fat', ?, 1, ?, ?, 0, 0, 0, 0, ?)`,
            [
              `${venc} 00:00:00`,
              // Conta Efí: o MK-Auth marca "gerencianet" e registra o boleto
              // quando ele é aberto. Banco comum: o MK-Auth numera depois
              // (view vtab_sem_nossonum).
              conta?.gateway === "gnet" ? "gerencianet" : null,
              login,
              tipo,
              tipo === "mensalidade" ? c.cfop_plano || "5307" : "X949",
              descricao,
              agoraMk(),
              usuario,
              final.toFixed(2),
              referencia,
              Number(c.conta) || 1,
              Number(conta?.multa || 0).toFixed(2),
              Number(conta?.juros || 0).toFixed(2),
              crypto.randomUUID(),
            ],
          );
          criados.push(r.insertId);
        }
        await registrarAtividade(
          m,
          req,
          `adicionou lancamentos para o cliente ${String(c.nome || login).toLowerCase()}`,
        );
        await recalcularAbertos(m, login);
      });
      for (const id of criados)
        await this.gravarNota(id, login, `adicionado por ${usuario}`, req);
      res.json({ ok: true, criados });
    } catch (error) {
      responderErro(res, error, "novoTitulo");
    }
  };

  /** Exclusão lógica, como o MK-Auth: deltitulo = 1 e data da exclusão. */
  excluirTitulos = async (req: Request, res: Response) => {
    try {
      const login = String(req.params.login || "");
      const ids: number[] = (Array.isArray(req.body?.ids) ? req.body.ids : [])
        .map(Number)
        .filter((n: number) => Number.isInteger(n) && n > 0);
      if (!ids.length) throw new ErroDeUso("Selecione os títulos.");
      await MkauthSource.transaction(async (m) => {
        const titulos = await m.query(
          `SELECT id, status FROM sis_lanc
            WHERE id IN (?) AND login = ? AND deltitulo = 0`,
          [ids, login],
        );
        if (titulos.length !== ids.length)
          throw new ErroDeUso("Algum título não é deste cliente.");
        if (titulos.some((t: any) => t.status === "pago"))
          throw new ErroDeUso("Título pago não pode ser excluído; estorne antes.");
        await m.query(
          `UPDATE sis_lanc SET deltitulo = 1, datadel = ? WHERE id IN (?)`,
          [agoraMk(), ids],
        );
        await m.query(`UPDATE sis_mlanc SET deltitulo = 1 WHERE idlanc IN (?)`, [
          ids,
        ]);
        for (const id of ids)
          await registrarAtividade(
            m,
            req,
            `excluiu o titulo de numero ${String(id).padStart(8, "0")}`,
          );
        await recalcularAbertos(m, login);
      });
      for (const id of ids) await cancelarBolixDoTitulo(id, "titulo excluido");
      res.json({ ok: true });
    } catch (error) {
      responderErro(res, error, "excluirTitulos");
    }
  };

  infoTitulo = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const [t] = await MkauthSource.query(
        `SELECT id, uuid_lanc, processamento, datavenc, referencia, datapag,
                nossonum, valor, valorpag, tipo, usergerou, coletor, obs,
                linhadig, login, status, formapag
           FROM sis_lanc WHERE id = ? AND deltitulo = 0 LIMIT 1`,
        [id],
      );
      if (!t) throw new ErroDeUso("Título não encontrado.");
      const [c] = await MkauthSource.query(
        `SELECT nome, endereco, numero, complemento, codigo, cpf_cnpj, bairro,
                email, cidade, estado, fone, celular, opcelular, celular2,
                cadastro, grupo, ssid, equipamento
           FROM sis_cliente WHERE login = ? LIMIT 1`,
        [t.login],
      );
      // CPF é dado de nível 5 (.claude/rules/rotas-seguras.md).
      if (c && nivelDe(req) < 5) c.cpf_cnpj = null;
      const [resumo] = await MkauthSource.query(
        `SELECT COUNT(*) AS total,
                SUM(status = 'pago') AS pagos,
                SUM(status IN ('aberto','vencido') AND datavenc >= CURDATE()) AS em_dia,
                SUM(status IN ('aberto','vencido') AND datavenc < CURDATE()) AS vencidos
           FROM sis_lanc WHERE login = ? AND deltitulo = 0`,
        [t.login],
      );
      res.json({
        titulo: t,
        cliente: c || null,
        resumo: {
          total: Number(resumo?.total || 0),
          pagos: Number(resumo?.pagos || 0),
          emDia: Number(resumo?.em_dia || 0),
          vencidos: Number(resumo?.vencidos || 0),
        },
      });
    } catch (error) {
      responderErro(res, error, "infoTitulo");
    }
  };

  // ---------- notas ----------

  private async gravarNota(
    tituloId: number,
    login: string,
    texto: string,
    req: Request,
  ) {
    await AppDataSource.getRepository(MensalidadeNota).save({
      titulo_id: tituloId,
      login_cliente: login,
      texto: texto.slice(0, 5000),
      usuario: usuarioDe(req),
    });
  }

  listarNotas = async (req: Request, res: Response) => {
    try {
      const notas = await AppDataSource.getRepository(MensalidadeNota).find({
        where: { titulo_id: Number(req.params.id) },
        order: { criado_em: "DESC" },
      });
      res.json(notas);
    } catch (error) {
      responderErro(res, error, "listarNotas");
    }
  };

  adicionarNota = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const texto = String(req.body?.texto ?? "").trim();
      if (!texto) throw new ErroDeUso("Escreva a nota.");
      const [t] = await MkauthSource.query(
        `SELECT login FROM sis_lanc WHERE id = ? LIMIT 1`,
        [id],
      );
      if (!t) throw new ErroDeUso("Título não encontrado.");
      await this.gravarNota(id, t.login, texto, req);
      res.json({ ok: true });
    } catch (error) {
      responderErro(res, error, "adicionarNota");
    }
  };

  // ---------- engrenagem (configurações) ----------

  configuracoes = async (_req: Request, res: Response) => {
    try {
      res.json({
        config: await lerConfig(),
        ultima: await ultimaExecucao(),
        situacao: situacaoGeracao(),
        ultimaVerificacao: await ultimaVerificacao(),
        sandbox: process.env.SERVIDOR_HOMOLOGACAO === "true",
        notificacaoConfigurada: !!process.env.EFI_BOLIX_NOTIFICACAO_URL,
      });
    } catch (error) {
      responderErro(res, error, "configuracoes");
    }
  };

  salvarConfiguracoes = async (req: Request, res: Response) => {
    try {
      res.json({ config: await salvarConfig(req.body || {}, usuarioDe(req)) });
    } catch (error) {
      responderErro(res, error, "salvarConfiguracoes");
    }
  };

  /**
   * "Rodar agora": começa em segundo plano (cada cobrança na Efí leva
   * segundos) e a engrenagem acompanha por GET /config.
   */
  rodarGeracao = async (req: Request, res: Response) => {
    if (situacaoGeracao().rodando) {
      res.status(409).json({ message: "A geração já está rodando." });
      return;
    }
    rodarGeracao("manual", usuarioDe(req)).catch((e) =>
      console.error("[Mensalidades] erro no Rodar agora:", e),
    );
    res.status(202).json({ iniciado: true });
  };

  // ---------- bolix da Efí ----------

  /** Gera (ou devolve o que já existe) o bolix do título, com o QR do Pix. */
  bolix = async (req: Request, res: Response) => {
    try {
      const b = await gerarBolix(Number(req.params.id), usuarioDe(req), {
        forcar: req.body?.forcar === true,
      });
      res.json(b);
    } catch (error) {
      responderErro(res, error, "bolix");
    }
  };

  verificarBolix = async (req: Request, res: Response) => {
    try {
      res.json(await verificarBolix(Number(req.params.id)));
    } catch (error) {
      responderErro(res, error, "verificarBolix");
    }
  };

  /**
   * Aviso de pagamento da Efí (rota pública). Só traz o token, que é conferido
   * na Efí; responde 200 mesmo em erro para a Efí não ficar reenviando.
   */
  notificacaoEfi = async (req: Request, res: Response) => {
    const token = String(req.body?.notification || "").trim();
    if (!/^[\w-]{8,128}$/.test(token)) {
      res.status(400).json({ message: "Token inválido." });
      return;
    }
    try {
      const r = await processarNotificacao(token);
      console.log(`[Bolix] notificação ${token}: ${JSON.stringify(r)}`);
    } catch (error) {
      console.error(`[Bolix] erro na notificação ${token}:`, error);
    }
    res.status(200).end();
  };

  // ---------- enviar para vários clientes ----------

  /**
   * Um e-mail por cliente marcado na lista. Variáveis na mensagem e no
   * assunto: %nome%, %login%, %provedor%, %total% e %titulos% (cada título em
   * aberto com vencimento, valor, link do boleto e linha digitável).
   */
  enviarLote = async (req: Request, res: Response) => {
    try {
      const logins: string[] = Array.from(
        new Set<string>(
          (Array.isArray(req.body?.logins) ? req.body.logins : [])
            .map((l: unknown) => String(l ?? "").trim())
            .filter(Boolean),
        ),
      );
      const assunto = String(req.body?.assunto ?? "").trim().slice(0, 200);
      const mensagem = String(req.body?.mensagem ?? "").trim();
      const pularSemTitulo = req.body?.pularSemTitulo !== false;
      if (!logins.length) throw new ErroDeUso("Selecione os clientes.");
      if (logins.length > LOTE_MAXIMO)
        throw new ErroDeUso(
          `No máximo ${LOTE_MAXIMO} clientes por envio (vieram ${logins.length}).`,
        );
      if (!assunto || !mensagem)
        throw new ErroDeUso("Preencha o assunto e a mensagem.");

      const clientes = await MkauthSource.query(
        `SELECT login, nome, email FROM sis_cliente WHERE login IN (?)`,
        [logins],
      );
      const titulos = await MkauthSource.query(
        `SELECT l.id, l.login, l.tipo, l.datavenc, l.valor, l.linhadig,
                COALESCE((SELECT SUM(IF(m.tipo = 'desconto', -m.valor, m.valor))
                            FROM sis_mlanc m
                           WHERE m.idlanc = l.id AND m.deltitulo = 0), 0) AS atrelados
           FROM sis_lanc l
          WHERE l.login IN (?) AND l.deltitulo = 0
            AND l.status IN ('aberto', 'vencido')
          ORDER BY l.datavenc ASC, l.id ASC`,
        [logins],
      );
      const [provedor] = await MkauthSource.query(
        `SELECT nome FROM sis_provedor LIMIT 1`,
      );
      const gerarBoletos = req.body?.gerarBoletos !== false;
      const email = new Email();

      const resultado = {
        enviados: [] as string[],
        semEmail: [] as string[],
        semTitulo: [] as string[],
        naoEncontrados: logins.filter(
          (l) => !clientes.some((c: any) => c.login === l),
        ),
        erros: [] as { login: string; erro: string }[],
        // E-mail enviado, mas algum boleto não pôde ser gerado.
        semBoleto: [] as { login: string; erro: string }[],
      };

      for (const c of clientes) {
        const doCliente = titulos.filter((t: any) => t.login === c.login);
        if (pularSemTitulo && !doCliente.length) {
          resultado.semTitulo.push(c.login);
          continue;
        }
        const para = String(c.email || "").trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) {
          resultado.semEmail.push(c.login);
          continue;
        }
        const total = doCliente.reduce(
          (s: number, t: any) => s + Number(t.valor || 0) + Number(t.atrelados || 0),
          0,
        );
        const blocos: string[] = [];
        for (const t of doCliente) {
          const valor = Number(t.valor || 0) + Number(t.atrelados || 0);
          const linhas = [
            `Título ${String(t.id).padStart(5, "0")} - ${t.tipo || ""} - vencimento ${dataBr(t.datavenc)} - ${reaisBr(valor)}`,
          ];
          if (gerarBoletos) {
            try {
              const bx = await gerarBolix(t.id, usuarioDe(req));
              if (bx.link) linhas.push(`Boleto: ${bx.link}`);
              if (bx.linha_digitavel)
                linhas.push(`Linha digitável: ${bx.linha_digitavel}`);
              if (bx.pix_copia_cola)
                linhas.push(`Pix copia e cola: ${bx.pix_copia_cola}`);
            } catch (e: any) {
              resultado.semBoleto.push({
                login: c.login,
                erro: `título ${t.id}: ${String(e?.message || e).slice(0, 200)}`,
              });
            }
          } else if (t.linhadig) {
            linhas.push(`Linha digitável: ${t.linhadig}`);
          }
          blocos.push(linhas.join("\n"));
        }
        const blocoTitulos = blocos.join("\n\n");
        const trocar = (texto: string) =>
          texto
            .replace(/%nome%/gi, c.nome || "")
            .replace(/%login%/gi, c.login)
            .replace(/%provedor%/gi, provedor?.nome || "")
            .replace(/%total%/gi, reaisBr(total))
            .replace(/%titulos%/gi, blocoTitulos || "Nenhum título em aberto.");
        try {
          await email.sendEmail(para, trocar(assunto), trocar(mensagem));
          resultado.enviados.push(c.login);
        } catch (e: any) {
          resultado.erros.push({
            login: c.login,
            erro: String(e?.message || e).slice(0, 200),
          });
        }
      }

      if (resultado.enviados.length) {
        await MkauthSource.transaction((m) =>
          registrarAtividade(
            m,
            req,
            `enviou titulos por e-mail para ${resultado.enviados.length} clientes`,
          ),
        );
      }
      res.json(resultado);
    } catch (error) {
      responderErro(res, error, "enviarLote");
    }
  };

  // ---------- enviar ----------

  enviar = async (req: Request, res: Response) => {
    try {
      const login = String(req.params.login || "");
      const assunto = String(req.body?.assunto ?? "").trim().slice(0, 200);
      const mensagem = String(req.body?.mensagem ?? "").trim();
      if (!assunto || !mensagem)
        throw new ErroDeUso("Preencha o assunto e a mensagem.");
      const [c] = await MkauthSource.query(
        `SELECT email FROM sis_cliente WHERE login = ? LIMIT 1`,
        [login],
      );
      const email = String(c?.email || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        throw new ErroDeUso("O cliente não tem e-mail válido no cadastro.");
      await new Email().sendEmail(email, assunto, mensagem);
      await MkauthSource.transaction((m) =>
        registrarAtividade(m, req, `enviou titulos por e-mail para ${login}`),
      );
      res.json({ ok: true, para: email });
    } catch (error) {
      responderErro(res, error, "enviar");
    }
  };

}


export default new Mensalidades();
