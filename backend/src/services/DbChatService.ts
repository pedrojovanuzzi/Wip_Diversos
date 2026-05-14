import axios from "axios";
import MkauthSource from "../database/MkauthSource";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";
const OLLAMA_MODEL_SQL = process.env.OLLAMA_MODEL_SQL || "qwen2.5-coder:7b";

const ALLOWED_TABLES = new Set([
  "sis_cliente",
  "sis_suporte",
  "sis_msg",
  "sis_lanc",
  "sis_plano",
  "sis_produto",
  "sis_prodcliente",
  "sis_func",
  "radacct",
]);

const SCHEMA_DESCRIPTION = `
TABELAS DISPONÍVEIS (NÃO EXISTEM OUTRAS, NÃO INVENTE):

sis_cliente  (cadastro de clientes)
  - id INT PK
  - login VARCHAR (identificador único do cliente, ex: "JOSESILVA")
  - nome VARCHAR
  - email, cpf_cnpj, fone, celular VARCHAR
  - cidade, bairro, endereco, cep, estado VARCHAR
  - plano VARCHAR (nome do plano contratado)
  - cli_ativado ENUM('s','n')   -- 's' = ATIVO, 'n' = inativo
  - bloqueado ENUM('sim','nao')
  - data_ins DATE      -- data de cadastro/ativação inicial
  - data_desativacao DATE   -- preenchida quando cliente sai
  - vendedor, tecnico, grupo VARCHAR

sis_suporte  (CHAMADOS de suporte/atendimento)
  - id INT PK
  - chamado VARCHAR  -- código do chamado (NÃO é INT). Usado para JOIN com sis_msg.chamado
  - assunto VARCHAR  -- ex: "Cancelamento", "Instalação", "Renovação", "Mudança"
  - login VARCHAR     -- login do cliente, joina com sis_cliente.login
  - atendente VARCHAR
  - abertura DATETIME   -- quando o chamado foi aberto
  - fechamento DATETIME -- quando foi fechado (NULL se aberto)
  - status VARCHAR   -- "aberto", "fechado", etc.
  - prioridade, tecnico VARCHAR
  - motivo_fechar TEXT
  - nome, email VARCHAR

sis_msg  (mensagens dentro de um chamado de sis_suporte)
  - id INT PK
  - chamado VARCHAR  -- JOIN: sis_msg.chamado = sis_suporte.chamado
  - msg LONGTEXT
  - tipo VARCHAR    -- "provedor" ou "cliente" (quem escreveu). NÃO é categoria!
  - login VARCHAR
  - atendente VARCHAR
  - msg_data DATETIME

sis_lanc  (FATURAS / lançamentos financeiros)
  - id INT PK
  - login VARCHAR (joina com sis_cliente.login)
  - valor DECIMAL
  - datavenc DATE   -- vencimento
  - datapag DATE    -- pagamento (NULL se em aberto)
  - liquidado ENUM('s','n')   -- 's' = paga
  - tipo VARCHAR

sis_plano  (planos de internet)
  - id INT PK
  - nome VARCHAR
  - valor DECIMAL
  - download, upload VARCHAR

sis_produto  (produtos/serviços contratados)
  - id INT PK
  - nome VARCHAR

sis_prodcliente  (relação cliente-produto)
  - login VARCHAR
  - produto VARCHAR

sis_func  (funcionários do sistema)
  - id INT PK
  - nome, login, email VARCHAR

radacct  (sessões RADIUS — histórico de conexões)
  - radacctid BIGINT PK
  - username VARCHAR (joina com sis_cliente.login)
  - acctstarttime, acctstoptime DATETIME
  - framedipaddress VARCHAR
  - acctinputoctets, acctoutputoctets BIGINT

REGRAS DE NEGÓCIO:
- "clientes ativos": sis_cliente.cli_ativado = 's'
- "clientes bloqueados": sis_cliente.bloqueado = 'sim'
- "cancelamentos": sis_suporte.assunto LIKE '%Cancela%'
- "instalações": sis_suporte.assunto LIKE '%Instala%' AND sis_suporte.assunto NOT LIKE '%INSTALACAO INTERNA%' AND sis_suporte.assunto NOT LIKE '%INSTALACAO TEMPORARIA%' AND sis_suporte.assunto NOT LIKE '%INSTALACAO WIFI ESTENDIDO%'
- "chamados abertos": sis_suporte.status = 'aberto' OU sis_suporte.fechamento IS NULL
- "faturas em aberto": sis_lanc.liquidado = 'n' AND sis_lanc.datapag IS NULL
- JOINs corretos:
    * sis_msg.chamado  = sis_suporte.chamado   (NÃO é com .id)
    * sis_suporte.login = sis_cliente.login
    * sis_lanc.login    = sis_cliente.login
    * radacct.username  = sis_cliente.login
`.trim();

const FORBIDDEN_RE = new RegExp(
  [
    "\\b(insert|update|delete|drop|alter|truncate|create|replace|rename)\\b",
    "\\b(grant|revoke|set|use|call|do|handler|lock|unlock|begin|commit|rollback|start)\\b",
    "\\b(load_file|into\\s+outfile|into\\s+dumpfile)\\b",
    "\\b(information_schema|mysql|performance_schema|sys)\\b",
    ";\\s*\\S",
  ].join("|"),
  "i",
);

export interface DbChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function generateSqlFromQuestion(
  question: string,
  history: DbChatTurn[],
  previousAttempt?: { sql: string; error: string },
): Promise<string> {
  const historyText = history
    .slice(-6)
    .map(
      (t) => `${t.role === "user" ? "Pergunta" : "SQL anterior"}: ${t.content}`,
    )
    .join("\n");

  const retryBlock = previousAttempt
    ? `
TENTATIVA ANTERIOR FALHOU. Corrija o problema:
SQL gerado: ${previousAttempt.sql}
Erro do banco: ${previousAttempt.error}

Causas comuns:
- Referenciou tabela/coluna que não existe no esquema → use SOMENTE as listadas.
- Citou tabela no SELECT/WHERE sem incluí-la no FROM/JOIN → adicione o JOIN ou remova a referência.
- JOIN errado → revise as relações em "JOINs corretos" do esquema.
`
    : "";

  const prompt = `Você é um especialista em SQL para MariaDB. Sua tarefa é gerar UMA query SELECT que responda à pergunta.

${SCHEMA_DESCRIPTION}

REGRAS RÍGIDAS:
- APENAS SELECT. Nada de INSERT/UPDATE/DELETE/DROP/etc.
- Uma única instrução, sem ponto-e-vírgula no meio.
- Sempre adicione LIMIT 50 no final, EXCETO para agregações (COUNT, SUM, AVG, MIN, MAX).
- Use APENAS as tabelas e colunas listadas no esquema acima. Não invente nada.
- Toda coluna citada no SELECT/WHERE/ORDER deve vir de uma tabela presente no FROM ou JOIN.
- Sempre qualifique as colunas com nome da tabela em JOINs (ex: sis_suporte.login).
- Se a pergunta não puder ser respondida com as tabelas disponíveis, retorne: SELECT 'pergunta_fora_do_escopo' AS erro
${retryBlock}
CONTEXTO ANTERIOR:
${historyText}

PERGUNTA: ${question}

Retorne APENAS o SQL puro, sem markdown, sem explicação, sem comentários. Apenas a query.`;

  const res = await axios.post(
    `${OLLAMA_URL}/api/generate`,
    {
      model: OLLAMA_MODEL_SQL,
      prompt,
      stream: false,
      options: { temperature: 0.1, num_ctx: 4096, num_predict: 400 },
      keep_alive: "30m",
    },
    { timeout: 300000 },
  );

  let sql = String(res.data?.response || "").trim();
  sql = sql
    .replace(/^```sql\s*/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "");
  sql = sql.replace(/^["']/g, "").replace(/["']$/g, "");
  sql = sql.trim();
  if (sql.endsWith(";")) sql = sql.slice(0, -1).trim();
  return sql;
}

export interface SqlValidation {
  ok: boolean;
  reason?: string;
  sql: string;
}

export function validateSql(sql: string): SqlValidation {
  const cleaned = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  if (!/^\s*select\b/i.test(cleaned)) {
    return { ok: false, reason: "Não é uma query SELECT.", sql };
  }
  if (FORBIDDEN_RE.test(cleaned)) {
    return {
      ok: false,
      reason: "Query contém comandos não permitidos.",
      sql,
    };
  }
  if ((cleaned.match(/;/g) || []).length > 0) {
    return {
      ok: false,
      reason: "Múltiplas instruções não são permitidas.",
      sql,
    };
  }
  return { ok: true, sql };
}

export async function executeReadOnly(sql: string): Promise<{
  rows: any[];
  durationMs: number;
}> {
  const start = Date.now();
  const runner = MkauthSource.createQueryRunner();
  await runner.connect();
  try {
    try {
      await runner.query("SET SESSION TRANSACTION READ ONLY");
    } catch (e) {
      console.warn("DbChat: não foi possível setar READ ONLY:", e);
    }
    try {
      await runner.query("SET SESSION max_statement_time = 15");
    } catch {
      try {
        await runner.query("SET SESSION MAX_EXECUTION_TIME = 15000");
      } catch {
        /* nenhum dos dois suportado; segue sem timeout server-side */
      }
    }
    let safeSql = sql;
    if (
      !/\blimit\s+\d+/i.test(safeSql) &&
      !/\b(count|sum|avg|min|max)\s*\(/i.test(safeSql)
    ) {
      safeSql = `${safeSql} LIMIT 50`;
    }
    const rows = await runner.query(safeSql);
    return { rows, durationMs: Date.now() - start };
  } finally {
    try {
      await runner.query("SET SESSION TRANSACTION READ WRITE");
    } catch {
      /* ignore */
    }
    await runner.release();
  }
}

export async function summarizeAnswer(
  question: string,
  sql: string,
  rows: any[],
): Promise<string> {
  const preview = rows.slice(0, 30);
  const truncated = rows.length > 30;
  const payload = JSON.stringify(preview, null, 2).slice(0, 6000);

  const prompt = `Você é um analista que responde perguntas sobre dados de uma provedora de internet. Foi feita a pergunta abaixo. O SQL gerado retornou os dados.

Pergunta: ${question}

SQL executado:
${sql}

Resultados (${rows.length} linha(s)${truncated ? ", mostrando primeiras 30" : ""}):
${payload}

Responda à pergunta de forma direta e objetiva, em português. Cite números reais. Se a resposta for uma lista, apresente em formato amigável. Não invente dados — use SOMENTE o que está nos resultados. Máximo 4 parágrafos curtos. Sem markdown.`;

  const res = await axios.post(
    `${OLLAMA_URL}/api/generate`,
    {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.3, num_ctx: 4096, num_predict: 500 },
      keep_alive: "30m",
    },
    { timeout: 300000 },
  );
  return String(res.data?.response || "").trim();
}

export async function dbChatAsk(
  question: string,
  history: DbChatTurn[],
): Promise<{
  sql: string;
  rows: any[];
  rowCount: number;
  answer: string;
  durationMs: number;
}> {
  const sql = await generateSqlFromQuestion(question, history);
  const validation = validateSql(sql);
  if (!validation.ok) {
    return {
      sql,
      rows: [],
      rowCount: 0,
      answer: `Não posso executar essa query com segurança: ${validation.reason}`,
      durationMs: 0,
    };
  }

  const { rows, durationMs } = await executeReadOnly(validation.sql);
  const answer = await summarizeAnswer(question, validation.sql, rows);
  return {
    sql: validation.sql,
    rows,
    rowCount: rows.length,
    answer,
    durationMs,
  };
}
