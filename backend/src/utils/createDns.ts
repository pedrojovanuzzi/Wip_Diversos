// ========================
// Importações necessárias
// ========================
import fs from "fs"; // para leitura de arquivos
import path from "path"; // para manipular extensões de arquivos
import { Client } from "pg"; // driver PostgreSQL
import pdf from "pdf-parse"; // leitura de PDF
import * as XLSX from "xlsx"; // leitura de Excel
import Papa from "papaparse"; // leitura de CSV
import dotenv from "dotenv";

dotenv.config();

// ========================
// Config do banco PowerDNS
// ========================
const DB_CONFIG = {
  host: process.env.POWERDNS_IP,
  port: Number(process.env.POWERDNS_PORT),
  database: process.env.POWERDNS_DATABASE, // ajuste se seu banco tiver outro nome
  user: process.env.POWERDNS_USER,
  password: process.env.POWERDNS_PASS,
};

// Nome da tabela de bloqueio
const TABLE_NAME = "blocked_domains";

// =========================
// Função para obter conexão
// =========================
function getClient() {
  // cria um cliente PostgreSQL
  return new Client(DB_CONFIG);
}

// =====================================
// Criação da tabela se não existir
// =====================================
async function ensureTable() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id SERIAL PRIMARY KEY,
        domain TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  const client = getClient();
  await client.connect();
  await client.query(ddl); // executa o comando DDL
  await client.end();
}

// =========================================
// Expressão regex para capturar domínios
// =========================================
const PADRAO_DOMINIO = /\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b/g;

// =========================================
// Função que extrai domínios de arquivos
// =========================================
export async function extrairDominios(
  caminhoArquivo: string,
): Promise<string[]> {
  // pega a extensão do arquivo
  const extensao = path.extname(caminhoArquivo).toLowerCase();

  let dominios: string[] = [];

  if (extensao === ".pdf") {
    // lê PDF inteiro
    const buffer = fs.readFileSync(caminhoArquivo);
    const data = await pdf(buffer);
    const encontrados = data.text.match(PADRAO_DOMINIO) || [];
    dominios.push(...encontrados);
  } else if (extensao === ".xlsx") {
    // lê Excel (todas as abas)
    const workbook = XLSX.readFile(caminhoArquivo);
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const texto = XLSX.utils.sheet_to_csv(sheet); // transforma em texto CSV
      const encontrados = texto.match(PADRAO_DOMINIO) || [];
      dominios.push(...encontrados);
    });
  } else if (extensao === ".csv") {
    // lê CSV
    const conteudo = fs.readFileSync(caminhoArquivo, "utf8");
    const resultado = Papa.parse(conteudo, { header: false });
    const texto = JSON.stringify(resultado.data);
    const encontrados = texto.match(PADRAO_DOMINIO) || [];
    dominios.push(...encontrados);
  } else {
    console.log("❌ Formato não suportado (use .pdf, .xlsx ou .csv).");
    return [];
  }

  // normaliza: minúsculas, remove pontos extras e adiciona ponto final
  const normalizados = new Set(
    dominios.map((d) => d.toLowerCase().replace(/\.+$/, "") + "."),
  );

  return Array.from(normalizados).sort();
}

// ======================================
// Inserção em lote no PostgreSQL
// ======================================
export async function inserirDominios(dominios: string[]) {
  if (dominios.length === 0) {
    console.log("⚠️ Nenhum domínio para inserir.");
    return;
  }

  await ensureTable(); // garante que a tabela existe

  const client = getClient();
  await client.connect();

  try {
    // Monta query de inserção com ON CONFLICT DO NOTHING
    const sql = `
      INSERT INTO ${TABLE_NAME} (domain) VALUES ($1)
      ON CONFLICT (domain) DO NOTHING
    `;

    let inseridos = 0;
    for (const d of dominios) {
      const res = await client.query(sql, [d]);
      if (res.rowCount) {
        if (res.rowCount > 0) inseridos++;
      }
    }

    const repetidos = dominios.length - inseridos;

    const resumo = `
📋 Resumo da operação:
✅ ${inseridos} domínios novos inseridos.
⏭️ ${repetidos} domínios já existiam (ou foram ignorados).
  `;

    console.log(resumo);
    return resumo; // aqui sim retorna string
  } catch (e) {
    console.error("❌ Falha ao inserir domínios:", e);
    throw e;
  } finally {
    await client.end();
  }
}

// ======================================
// Listagem de Domínios
// ======================================
export async function listarDominios(): Promise<string[]> {
  await ensureTable();

  const client = getClient();
  await client.connect();

  try {
    const sql = `SELECT domain FROM ${TABLE_NAME} ORDER BY domain ASC`;
    const res = await client.query(sql);

    // Retorna apenas um array de strings com os nomes dos domínios
    return res.rows.map((row) => row.domain);
  } catch (e) {
    console.error("❌ Falha ao listar domínios:", e);
    throw e;
  } finally {
    await client.end();
  }
}
