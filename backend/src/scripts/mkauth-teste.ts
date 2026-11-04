/**
 * Banco MK-Auth de teste, sem copiar nada de produção.
 *
 *   npx ts-node src/scripts/mkauth-teste.ts criar    cria o banco e as tabelas
 *   npx ts-node src/scripts/mkauth-teste.ts popular  insere os 10 clientes mock
 *   npx ts-node src/scripts/mkauth-teste.ts limpar   apaga só os dados mock
 *   npx ts-node src/scripts/mkauth-teste.ts recriar  apaga o banco e faz tudo de novo
 *
 * As tabelas saem das entidades do próprio MkauthSource (synchronize), então
 * têm exatamente as colunas que o backend lê. Tabelas usadas só em SQL cru,
 * sem entidade, aparecem num aviso no fim do "criar".
 *
 * Variáveis (todas opcionais):
 *   MKAUTH_TESTE_HOST      padrão 127.0.0.1 (só aceita host local)
 *   MKAUTH_TESTE_PORT      padrão 3306
 *   MKAUTH_TESTE_USER      padrão root
 *   MKAUTH_TESTE_PASSWORD  padrão vazio
 *   MKAUTH_TESTE_DATABASE  padrão mkradius_teste (precisa terminar em _teste)
 */
import "reflect-metadata";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { DataSource } from "typeorm";
import MkauthSource from "../database/MkauthSource";

const HOST = process.env.MKAUTH_TESTE_HOST || "127.0.0.1";
const PORT = Number(process.env.MKAUTH_TESTE_PORT || 3306);
const USER = process.env.MKAUTH_TESTE_USER || "root";
const PASSWORD = process.env.MKAUTH_TESTE_PASSWORD || "";
const DATABASE = process.env.MKAUTH_TESTE_DATABASE || "mkradius_teste";

// synchronize altera tabelas: nunca pode apontar para o MK-Auth de verdade.
function travaDeSeguranca() {
  if (!["127.0.0.1", "localhost", "::1"].includes(HOST)) {
    throw new Error(`Host ${HOST} recusado: o banco de teste só pode ser local.`);
  }
  if (!/_teste$/.test(DATABASE)) {
    throw new Error(`Banco ${DATABASE} recusado: o nome precisa terminar em _teste.`);
  }
}

function fonteDeTeste(synchronize = false) {
  return new DataSource({
    ...(MkauthSource.options as any),
    host: HOST,
    port: PORT,
    username: USER,
    password: PASSWORD,
    database: DATABASE,
    synchronize,
    migrationsRun: false,
    migrations: [],
    logging: false,
  });
}

async function criar() {
  const conn = await mysql.createConnection({ host: HOST, port: PORT, user: USER, password: PASSWORD });
  // Mesmo charset das tabelas do MK-Auth de verdade. Em utf8mb4 (4 bytes por
  // caractere) os varchar das entidades estouram o limite de linha do MySQL.
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DATABASE}\` CHARACTER SET latin1 COLLATE latin1_swedish_ci`,
  );
  await conn.end();

  const ds = fonteDeTeste(true);
  await ds.initialize();
  const tabelas = new Set(
    ((await ds.query("SHOW TABLES")) as any[]).map((r) => String(Object.values(r)[0]).toLowerCase()),
  );
  console.log(`✅ ${DATABASE}: ${tabelas.size} tabelas criadas a partir das entidades.`);

  // Tabelas do MK-Auth citadas em SQL cru que nenhuma entidade criou.
  const faltando = new Map<string, string[]>();
  const src = path.resolve(__dirname, "..");
  const varrer = (dir: string) => {
    for (const nome of fs.readdirSync(dir)) {
      const p = path.join(dir, nome);
      if (fs.statSync(p).isDirectory()) {
        if (nome !== "node_modules" && nome !== "migration") varrer(p);
      } else if (/\.ts$/.test(nome)) {
        const txt = fs.readFileSync(p, "utf8");
        const re = /\b(?:FROM|JOIN|INTO|UPDATE)\s+`?((?:sis_|rad)\w+)`?/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(txt))) {
          const t = m[1].toLowerCase();
          if (!tabelas.has(t)) {
            const lista = faltando.get(t) || [];
            const rel = path.relative(src, p);
            if (!lista.includes(rel)) lista.push(rel);
            faltando.set(t, lista);
          }
        }
      }
    }
  };
  varrer(src);
  if (faltando.size) {
    console.warn("⚠️  Tabelas usadas em SQL cru que não têm entidade (não foram criadas):");
    for (const [t, arqs] of faltando) console.warn(`   ${t}  ←  ${arqs.join(", ")}`);
    console.warn("   As telas que dependem delas vão dar erro no banco de teste.");
  }
  await ds.destroy();
}

// ---------- dados mock ----------

type Coluna = { nome: string; tipo: string; nula: boolean; padrao: unknown; auto: boolean };
const colunasCache = new Map<string, Map<string, Coluna>>();

async function colunas(ds: DataSource, tabela: string) {
  if (!colunasCache.has(tabela)) {
    const rows = (await ds.query(
      `SELECT COLUMN_NAME n, DATA_TYPE t, IS_NULLABLE nul, COLUMN_DEFAULT d, EXTRA e
         FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [DATABASE, tabela],
    )) as any[];
    colunasCache.set(
      tabela,
      new Map(
        rows.map((r) => [
          String(r.n).toLowerCase(),
          { nome: r.n, tipo: r.t, nula: r.nul === "YES", padrao: r.d, auto: /auto_increment/.test(r.e) },
        ]),
      ),
    );
  }
  return colunasCache.get(tabela)!;
}

function valorPadrao(tipo: string) {
  if (/int|decimal|float|double|bit/.test(tipo)) return 0;
  if (/date|time/.test(tipo)) return new Date();
  return "";
}

/** Insere só as colunas que existem; preenche as obrigatórias que ficaram de fora. */
async function inserir(ds: DataSource, tabela: string, dados: Record<string, unknown>) {
  const cols = await colunas(ds, tabela);
  if (!cols.size) {
    console.warn(`   (tabela ${tabela} não existe no banco de teste, pulei)`);
    return null;
  }
  const linha: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dados)) {
    const c = cols.get(k.toLowerCase());
    if (c && v !== undefined) linha[c.nome] = v;
  }
  for (const c of cols.values()) {
    if (!(c.nome in linha) && !c.nula && c.padrao === null && !c.auto) linha[c.nome] = valorPadrao(c.tipo);
  }
  const nomes = Object.keys(linha);
  const r: any = await ds.query(
    `INSERT INTO \`${tabela}\` (${nomes.map((n) => `\`${n}\``).join(",")}) VALUES (${nomes.map(() => "?").join(",")})`,
    nomes.map((n) => linha[n]),
  );
  return r?.insertId ?? null;
}

function cpf(base: number) {
  const d = String(100000000 + base * 7919).slice(0, 9).split("").map(Number);
  for (let n = 9; n < 11; n++) {
    const soma = d.reduce((s, v, i) => s + v * (n + 1 - i), 0);
    d.push(((soma * 10) % 11) % 10);
  }
  return d.join("").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function dia(mesesAtras: number, diaDoMes: number) {
  const h = new Date();
  return new Date(h.getFullYear(), h.getMonth() - mesesAtras, diaDoMes, 12);
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

const PLANOS = [
  { nome: "TESTE_100MB", valor: "99.90", velup: "50000", veldown: "100000" },
  { nome: "TESTE_300MB", valor: "129.90", velup: "150000", veldown: "300000" },
  { nome: "TESTE_BARATO", valor: "10.00", velup: "5000", veldown: "10000" },
  // O site só oferece planos que começam com "_" (fora os _EST), e o Wi-Fi
  // estendido lista os "_EST_WIFI..." (plano.service.ts).
  { nome: "_TESTE_500MB", valor: "149.90", velup: "250000", veldown: "500000" },
  { nome: "_EST_WIFI_TESTE", valor: "19.90", velup: "0", veldown: "0" },
];

type Lanc = {
  tipo: "mensalidade" | "servicos";
  valor: number;
  venc: Date;
  status: "aberto" | "pago" | "vencido";
  obs?: string;
  excluida?: boolean;
};

type Mock = {
  login: string;
  nome: string;
  plano: string;
  vendedor: "SVA" | "SCM";
  desconto?: number;
  pj?: boolean;
  bloqueado?: boolean;
  desativado?: boolean;
  cenario: string;
  faturas: Lanc[];
  servicosMensais?: { descricao: string; valor: number }[];
};

const mens = (mesesAtras: number, valor: number, status: Lanc["status"]): Lanc => ({
  tipo: "mensalidade",
  valor,
  venc: dia(mesesAtras, 10),
  status,
});
const serv = (nome: string, valor: number, status: Lanc["status"], diaDoMes = 20): Lanc => ({
  tipo: "servicos",
  valor,
  venc: dia(0, diaDoMes),
  status,
  obs: `Serviço: ${nome} - solicitado pela web (mock)`,
});

const CLIENTES: Mock[] = [
  { login: "TESTE01", nome: "ANA MOCK SILVA", plano: "TESTE_100MB", vendedor: "SVA",
    cenario: "Caso simples: mensalidade do mês passado paga e a deste mês em aberto.",
    faturas: [mens(1, 99.9, "pago"), mens(0, 99.9, "aberto")] },
  { login: "TESTE02", nome: "BRUNO MOCK SOUZA", plano: "TESTE_100MB", vendedor: "SVA", desconto: 20,
    cenario: "Correções 1 e 4: mensalidade paga + mudança de endereço de R$ 200 paga no mesmo mês, com R$ 20 de desconto.",
    faturas: [mens(0, 99.9, "pago"), serv("Mudança de endereço", 200, "pago")] },
  { login: "TESTE03", nome: "CARLA MOCK LIMA", plano: "TESTE_300MB", vendedor: "SVA",
    cenario: "Correção 2: instalação pedida e não paga. Não pode aparecer na tela de NFS-e.",
    faturas: [mens(0, 129.9, "pago"), serv("Instalação", 150, "aberto")] },
  { login: "TESTE04", nome: "DANIEL MOCK ROCHA", plano: "TESTE_100MB", vendedor: "SCM",
    cenario: "Correção 5 (decisão pendente): cliente SCM com serviço pago.",
    faturas: [mens(0, 99.9, "pago"), serv("Mudança de cômodo", 80, "pago")] },
  { login: "TESTE05", nome: "ELISA MOCK COSTA", plano: "TESTE_BARATO", vendedor: "SVA", desconto: 20,
    cenario: "Nota negativa: desconto de R$ 20 maior que a mensalidade de R$ 10.",
    faturas: [mens(0, 10, "pago")] },
  { login: "TESTE06", nome: "FABIO MOCK ALVES", plano: "TESTE_100MB", vendedor: "SVA",
    cenario: "Serviço mensal: Watch TV em sis_sercontratos.",
    faturas: [mens(0, 129.8, "pago")],
    servicosMensais: [{ descricao: "WATCHTV BRASIL", valor: 29.9 }] },
  { login: "TESTE07", nome: "GABRIELA MOCK DIAS", plano: "TESTE_300MB", vendedor: "SVA",
    cenario: "Serviço mensal: câmeras em sis_sercontratos, mensalidade em aberto.",
    faturas: [mens(0, 169.8, "aberto")],
    servicosMensais: [{ descricao: "2 CANAIS DE GRAVACAO NA NUVEM", valor: 39.9 }] },
  { login: "TESTE08", nome: "HENRIQUE MOCK PINTO", plano: "TESTE_100MB", vendedor: "SVA", bloqueado: true,
    cenario: "Inadimplente bloqueado: três mensalidades vencidas (multa e juros).",
    faturas: [mens(3, 99.9, "vencido"), mens(2, 99.9, "vencido"), mens(1, 99.9, "vencido")] },
  { login: "TESTE09", nome: "MOCK SOLUCOES LTDA", plano: "TESTE_300MB", vendedor: "SVA", pj: true,
    cenario: "Pessoa jurídica (CNPJ) com mensalidade e serviço pagos.",
    faturas: [mens(0, 129.9, "pago"), serv("Mudança de endereço", 200, "pago", 15)] },
  { login: "TESTE10", nome: "JULIA MOCK NUNES", plano: "TESTE_100MB", vendedor: "SVA", desativado: true,
    cenario: "Cliente desativado com fatura de serviço já excluída (deltitulo/datadel): ela não pode aparecer em lugar nenhum.",
    faturas: [mens(1, 99.9, "pago"), { ...serv("Instalação", 150, "aberto"), excluida: true }] },
];

async function popular() {
  const ds = fonteDeTeste();
  await ds.initialize();
  await limparDados(ds);

  for (const p of PLANOS) {
    await inserir(ds, "sis_plano", { ...p, descricao: "Plano mock de teste", desc_titulo: p.nome, oculto: "nao" });
  }

  let recibo = 900000;
  for (const [i, c] of CLIENTES.entries()) {
    const n = i + 1;
    const documento = c.pj
      ? `12.345.678/0001-${String(n).padStart(2, "0")}`
      : cpf(n);
    await inserir(ds, "sis_cliente", {
      login: c.login,
      nome: c.nome,
      senha: "teste123",
      // O MK-Auth guarda só os dígitos; a busca por CPF compara assim.
      cpf_cnpj: documento.replace(/\D/g, ""),
      pessoa: c.pj ? "juridica" : "fisica",
      tipo: c.pj ? "pj" : "pf",
      email: `${c.login.toLowerCase()}@exemplo.test`,
      celular: `(00) 90000-00${String(n).padStart(2, "0")}`,
      fone: "",
      endereco: "Rua dos Testes",
      numero: String(100 + n),
      bairro: "Centro",
      cidade: "Cidade Teste",
      estado: "SP",
      cep: "00000-000",
      plano: c.plano,
      venc: "10",
      desconto: (c.desconto ?? 0).toFixed(2),
      vendedor: c.vendedor,
      cli_ativado: c.desativado ? "n" : "s",
      bloqueado: c.bloqueado ? "sim" : "nao",
      obs: `MOCK: ${c.cenario}`,
      cadastro: iso(dia(6, 1)),
      data_ins: iso(dia(6, 1)),
    });

    for (const f of c.faturas) {
      recibo++;
      const pago = f.status === "pago";
      const id = await inserir(ds, "sis_lanc", {
        login: c.login,
        // sis_lanc.nome tem 16 caracteres; o app corta do mesmo jeito.
        nome: c.nome.slice(0, 16),
        tipo: f.tipo,
        valor: f.valor.toFixed(2),
        valorpag: pago ? f.valor.toFixed(2) : undefined,
        datapag: pago ? f.venc : undefined,
        formapag: pago ? "pix" : undefined,
        datavenc: iso(f.venc),
        processamento: f.venc,
        status: f.status,
        recibo: `MOCK-${recibo}`,
        nossonum: String(recibo),
        obs: f.obs ?? `Mensalidade mock ${iso(f.venc).slice(0, 7)}`,
        deltitulo: f.excluida ? 1 : 0,
        datadel: f.excluida ? new Date() : undefined,
      });
      console.log(`   ${c.login}  fatura ${id ?? "?"}  ${f.tipo.padEnd(11)} R$ ${f.valor.toFixed(2).padStart(7)}  ${f.status}${f.excluida ? " (excluída)" : ""}`);
    }

    for (const s of c.servicosMensais ?? []) {
      await inserir(ds, "sis_sercontratos", {
        login: c.login,
        // O backend reconhece o serviço pelo texto de "nome" (sqlTagServico).
        nome: s.descricao,
        valor: s.valor.toFixed(2),
        incluir: "sim",
        data: iso(dia(2, 1)),
      });
    }
  }

  console.log(`\n✅ ${CLIENTES.length} clientes mock em ${DATABASE}:`);
  for (const c of CLIENTES) console.log(`   ${c.login}  ${c.cenario}`);
  await ds.destroy();
}

/** Apaga tudo que o popular cria (login TESTE*, planos TESTE_*). */
async function limparDados(ds: DataSource) {
  const tabelas = (await ds.query(
    `SELECT DISTINCT TABLE_NAME t FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = 'login'`,
    [DATABASE],
  )) as any[];
  for (const { t } of tabelas) await ds.query(`DELETE FROM \`${t}\` WHERE login LIKE 'TESTE%'`);
  if ((await colunas(ds, "sis_plano")).size) {
    await ds.query(
      "DELETE FROM sis_plano WHERE nome LIKE 'TESTE\\_%' OR nome IN ('_TESTE_500MB', '_EST_WIFI_TESTE')",
    );
  }
}

async function main() {
  travaDeSeguranca();
  const cmd = process.argv[2];
  if (cmd === "criar") await criar();
  else if (cmd === "popular") await popular();
  else if (cmd === "limpar") {
    const ds = fonteDeTeste();
    await ds.initialize();
    await limparDados(ds);
    await ds.destroy();
    console.log("🧹 Dados mock apagados.");
  } else if (cmd === "recriar") {
    const conn = await mysql.createConnection({ host: HOST, port: PORT, user: USER, password: PASSWORD });
    await conn.query(`DROP DATABASE IF EXISTS \`${DATABASE}\``);
    await conn.end();
    await criar();
    await popular();
  } else {
    console.log("Uso: npx ts-node src/scripts/mkauth-teste.ts criar | popular | limpar | recriar");
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("❌", e?.message || e);
  process.exit(1);
});
