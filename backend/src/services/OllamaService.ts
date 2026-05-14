import axios from "axios";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";

export interface CancellationAnalysis {
  categoria: string;
  resumo: string;
}

const CATEGORIAS_PADRAO = [
  "Preço",
  "Qualidade do sinal",
  "Mudança de endereço",
  "Falta de pagamento",
  "Foi para concorrente",
  "Atendimento",
  "Não usa mais internet",
  "Cliente faleceu",
  "Outro",
];

export async function analyzeCancellationReason(
  text: string,
  signal?: AbortSignal,
): Promise<CancellationAnalysis> {
  const trimmed = (text || "").slice(0, 3000).trim();
  if (!trimmed) {
    return { categoria: "Outro", resumo: "Sem mensagem disponível" };
  }

  const prompt = `Você é um analista de uma provedora de internet brasileira.
Receberá a mensagem de um chamado de cancelamento. Sua tarefa: identificar o motivo do cancelamento.

Retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem comentários, sem texto antes/depois) no formato:
{"categoria": "...", "resumo": "..."}

Regras:
- "categoria" deve ser exatamente uma destas: ${CATEGORIAS_PADRAO.map((c) => `"${c}"`).join(", ")}
- "resumo" no máximo 15 palavras, em português, descrevendo o motivo concreto

Mensagem do chamado:
"""
${trimmed}
"""`;

  try {
    const res = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt,
        format: "json",
        stream: false,
        options: { temperature: 0.2, num_ctx: 4096 },
      },
      { timeout: 120000, signal },
    );
    const raw = (res.data?.response || "").trim();
    const parsed = JSON.parse(raw);
    const norm = (s: string) =>
      String(s || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
    const target = norm(parsed.categoria);
    const matched = CATEGORIAS_PADRAO.find((c) => norm(c) === target);
    const fuzzy = matched
      ? matched
      : CATEGORIAS_PADRAO.find(
          (c) => target.includes(norm(c)) || norm(c).includes(target),
        );
    return {
      categoria: fuzzy || "Outro",
      resumo: String(parsed.resumo || "").slice(0, 200),
    };
  } catch (err: any) {
    if (axios.isCancel(err) || err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
      throw err;
    }
    const status = err?.response?.status;
    const body = err?.response?.data;
    if (status === 404) {
      console.error(
        `Ollama 404: modelo "${OLLAMA_MODEL}" não encontrado. ` +
          `Rode: docker exec -it ollama ollama pull ${OLLAMA_MODEL}`,
      );
    } else {
      console.error(
        "Ollama analyze error:",
        err?.message || err,
        body ? `body=${JSON.stringify(body).slice(0, 200)}` : "",
      );
    }
    return { categoria: "Outro", resumo: "" };
  }
}

export interface CategorySummaryInput {
  categoria: string;
  count: number;
  percent: number;
  samples: string[];
}

const INTERNAL_CATEGORIES = new Set([
  "Preço",
  "Qualidade do sinal",
  "Atendimento",
]);

const EXTERNAL_CATEGORIES = new Set([
  "Mudança de endereço",
  "Foi para concorrente",
  "Falta de pagamento",
  "Não usa mais internet",
  "Cliente faleceu",
]);

export async function summarizeCancellations(
  categories: CategorySummaryInput[],
  totalAnalyzed: number,
): Promise<string> {
  if (categories.length === 0 || totalAnalyzed === 0) return "";

  const sorted = [...categories].sort((a, b) => b.count - a.count);

  const internalCount = sorted
    .filter((c) => INTERNAL_CATEGORIES.has(c.categoria))
    .reduce((a, c) => a + c.count, 0);
  const externalCount = sorted
    .filter((c) => EXTERNAL_CATEGORIES.has(c.categoria))
    .reduce((a, c) => a + c.count, 0);
  const internalPct = Math.round((internalCount / totalAnalyzed) * 100);
  const externalPct = Math.round((externalCount / totalAnalyzed) * 100);

  const breakdown = sorted
    .map((c) => {
      const samples = c.samples
        .slice(0, 4)
        .map((s) => `   - "${s}"`)
        .join("\n");
      return `- ${c.categoria}: ${c.count} casos (${c.percent}%)\n${samples}`;
    })
    .join("\n");

  const prompt = `Você é um analista de churn de uma provedora de internet. Os dados abaixo já foram classificados — sua tarefa é APENAS narrar esses números, sem inventar nada.

DADOS REAIS:
Total analisado: ${totalAnalyzed} chamados de cancelamento
Por falha interna (Preço/Qualidade/Atendimento): ${internalCount} (${internalPct}%)
Por causa externa (Mudança/Concorrente/Não-pagamento/Não-usa/Faleceu): ${externalCount} (${externalPct}%)

Distribuição por motivo (em ordem de frequência):
${breakdown}

INSTRUÇÕES:
- Escreva 3 a 5 parágrafos curtos em português corrido, sem listas, sem markdown, sem títulos.
- Use SOMENTE os números acima. NÃO invente percentuais diferentes.
- Comece descrevendo o motivo dominante (o mais frequente).
- Depois comente os 2-3 motivos seguintes em importância.
- Cite a divisão interna vs externo usando EXATAMENTE os percentuais acima.
- Termine com 2-3 sugestões concretas de ação focadas nos motivos dominantes encontrados.
- Não generalize categorias raras como se fossem maioria.

DIAGNÓSTICO:`;

  try {
    const res = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.3, num_ctx: 4096, num_predict: 700 },
      },
      { timeout: 300000 },
    );
    return String(res.data?.response || "").trim();
  } catch (err: any) {
    console.error("Ollama summarize error:", err?.message || err);
    return "";
  }
}

export async function ollamaHealth(): Promise<{
  ok: boolean;
  model: string;
  modelsAvailable: string[];
}> {
  try {
    const res = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
    const modelsAvailable = (res.data?.models || []).map((m: any) => m.name);
    return {
      ok: true,
      model: OLLAMA_MODEL,
      modelsAvailable,
    };
  } catch {
    return { ok: false, model: OLLAMA_MODEL, modelsAvailable: [] };
  }
}

export interface ChurnAnalysis {
  score: number;
  sinais: string[];
  acao_sugerida: string;
  justificativa: string;
}

export async function analyzeClientChurnRisk(
  clientInfo: {
    login: string;
    nome?: string;
    plano?: string;
    cidade?: string;
  },
  chamados: {
    abertura?: Date | string | null;
    assunto?: string | null;
    status?: string | null;
    mensagens: string[];
  }[],
  signal?: AbortSignal,
): Promise<ChurnAnalysis> {
  if (chamados.length === 0) {
    return {
      score: 0,
      sinais: [],
      acao_sugerida: "Sem dados recentes",
      justificativa: "Cliente sem chamados no período analisado.",
    };
  }

  const corpus = chamados
    .slice(0, 15)
    .map((c, i) => {
      const dt =
        c.abertura instanceof Date
          ? c.abertura.toISOString().slice(0, 10)
          : String(c.abertura || "").slice(0, 10);
      const msgs = c.mensagens
        .filter(Boolean)
        .map((m) => m.slice(0, 400))
        .slice(0, 3)
        .join(" | ");
      return `[${i + 1}] ${dt} | ${c.assunto || "?"} | status=${c.status || "?"}\n  msgs: ${msgs}`;
    })
    .join("\n");

  const prompt = `Você é um analista de retenção de uma provedora de internet. Sua tarefa: dar uma NOTA DE RISCO DE CANCELAMENTO de 0 a 100 baseado nos chamados recentes deste cliente.

REGRAS RÍGIDAS DE PONTUAÇÃO:

SCORE ALTO (70-100) — só quando houver SINAIS EXPLÍCITOS de querer sair:
- Cliente pediu cancelamento, mesmo que tenha desistido depois
- Cliente perguntou sobre multa de rescisão, prazo de fidelidade, como cancelar
- Cliente comparou negativamente com concorrente ("vou pra X que é melhor")
- Cliente ameaçou cancelar ("vou cancelar se não resolver")
- 3 ou mais reclamações técnicas DA MESMA falha nos últimos meses (problema não resolvido)
- Cliente demonstrou irritação grave / acusação à empresa

SCORE MÉDIO (40-69) — sinais ambíguos:
- Reclamação técnica única não resolvida (lentidão, queda)
- Pediu desconto ou ameaça velada
- Dúvida sobre fatura/cobrança que pode virar disputa

SCORE BAIXO (0-39) — chamados rotineiros, SEM SINAL DE SAÍDA:
- Instalação, renovação de contrato, mudança de plano — esses são RETENÇÃO, não risco
- Alteração de nome/senha de WiFi
- Configuração técnica simples já resolvida
- Visita técnica concluída com sucesso
- Cliente apenas tirou dúvida

REGRAS ABSOLUTAS:
- Renovação de contrato = SCORE BAIXO. Renovar é o oposto de cancelar.
- Instalação nova = SCORE BAIXO. Cliente acabou de chegar.
- Troca de equipamento concluída = SCORE BAIXO.
- Mudança de SSID/senha WiFi = SCORE BAIXO.
- Se NÃO há sinais explícitos das categorias ALTO ou MÉDIO, score DEVE ser < 40.
- Score 100 é apenas pra casos onde cliente JÁ pediu cancelamento formal.

EXEMPLOS:
- "Cliente renovou contrato por mais 12 meses" → score 5
- "Mudou nome do WiFi de WipX pra CasaY" → score 5
- "Cliente reclamou de internet lenta 1x e foi resolvido" → score 30
- "Cliente perguntou valor da multa de rescisão" → score 75
- "3 chamados de queda na mesma semana, cliente irritado" → score 80
- "Cliente pediu cancelamento formal, técnico retirou equipamento" → score 95

CLIENTE:
- login: ${clientInfo.login}
${clientInfo.nome ? `- nome: ${clientInfo.nome}` : ""}
${clientInfo.plano ? `- plano: ${clientInfo.plano}` : ""}

CHAMADOS (${chamados.length}):
${corpus}

Retorne EXCLUSIVAMENTE um JSON válido, sem markdown:
{"score": 0, "sinais": ["frase curta 1", "frase curta 2"], "acao_sugerida": "...", "justificativa": "..."}

- "sinais": 2-4 frases CURTAS e ESPECÍFICAS do que você encontrou no histórico (não invente). Se não há nada relevante, retorne sinais vazios e score baixo.
- "acao_sugerida": ação concreta. Se score < 40, sugira "Nenhuma ação necessária" ou "Manter monitoramento".
- "justificativa": uma frase explicando o score com base nas regras acima.`;

  try {
    const res = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt,
        format: "json",
        stream: false,
        options: { temperature: 0.2, num_ctx: 4096, num_predict: 500 },
      },
      { timeout: 120000, signal },
    );
    const raw = String(res.data?.response || "").trim();
    const parsed = JSON.parse(raw);
    return {
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      sinais: Array.isArray(parsed.sinais)
        ? parsed.sinais.map((s: any) => String(s).slice(0, 200)).slice(0, 8)
        : [],
      acao_sugerida: String(parsed.acao_sugerida || "").slice(0, 300),
      justificativa: String(parsed.justificativa || "").slice(0, 500),
    };
  } catch (err: any) {
    if (axios.isCancel(err) || err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
      throw err;
    }
    console.error("Churn analysis error:", err?.message || err);
    return {
      score: 0,
      sinais: [],
      acao_sugerida: "Erro na análise",
      justificativa: "",
    };
  }
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function askAboutCancellations(
  context: {
    summary: string;
    categories: CategorySummaryInput[];
    totalAnalyzed: number;
    items: { login: string; categoria: string; resumo: string }[];
  },
  history: ChatTurn[],
  question: string,
): Promise<string> {
  const sorted = [...context.categories].sort((a, b) => b.count - a.count);
  const breakdown = sorted
    .map(
      (c) =>
        `- ${c.categoria}: ${c.count} casos (${c.percent}%)` +
        (c.samples.length
          ? "\n" + c.samples.slice(0, 3).map((s) => `   • "${s}"`).join("\n")
          : ""),
    )
    .join("\n");

  const sampleItems = context.items
    .slice(0, 30)
    .map((i) => `[${i.categoria}] ${i.login}: ${i.resumo}`)
    .join("\n");

  const messages: { role: "system" | "user" | "assistant"; content: string }[] =
    [
      {
        role: "system",
        content: `Você é um analista de churn de uma provedora de internet. Responda perguntas do usuário SOMENTE com base no contexto abaixo. Se a pergunta não puder ser respondida com esses dados, diga claramente que não tem informação suficiente. Seja conciso (máximo 3 parágrafos), em português, sem markdown.

CONTEXTO:
Total analisado: ${context.totalAnalyzed} chamados de cancelamento.

Diagnóstico geral já produzido:
"""
${context.summary || "(diagnóstico não disponível)"}
"""

Distribuição por motivo:
${breakdown}

Amostra de chamados individuais (até 30):
${sampleItems}`,
      },
      ...history.map((t) => ({
        role: t.role as "user" | "assistant",
        content: t.content,
      })),
      { role: "user", content: question },
    ];

  try {
    const res = await axios.post(
      `${OLLAMA_URL}/api/chat`,
      {
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: { temperature: 0.3, num_ctx: 8192, num_predict: 600 },
      },
      { timeout: 180000 },
    );
    return String(res.data?.message?.content || "").trim();
  } catch (err: any) {
    console.error("Ollama chat error:", err?.message || err);
    return "Erro ao consultar o modelo. Verifique se o Ollama está rodando.";
  }
}

async function pullSingleModel(target: string): Promise<void> {
  try {
    const tags = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
    const available: string[] = (tags.data?.models || []).map(
      (m: any) => m.name,
    );
    const isPresent = available.some(
      (n) => n === target || n.startsWith(`${target}:`),
    );
    if (isPresent) {
      console.log(`[Ollama] modelo "${target}" já disponível.`);
      return;
    }

    console.log(`[Ollama] baixando modelo "${target}"... (pode levar minutos)`);
    const res = await axios.post(
      `${OLLAMA_URL}/api/pull`,
      { model: target, stream: true },
      { responseType: "stream", timeout: 0 },
    );

    await new Promise<void>((resolve, reject) => {
      let lastPct = -1;
      res.data.on("data", (chunk: Buffer) => {
        const lines = chunk.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const ev = JSON.parse(line);
            if (ev.total && ev.completed) {
              const pct = Math.floor((ev.completed / ev.total) * 100);
              if (pct !== lastPct && pct % 10 === 0) {
                console.log(
                  `[Ollama] ${target} ${ev.status || "pulling"}: ${pct}%`,
                );
                lastPct = pct;
              }
            } else if (ev.status) {
              console.log(`[Ollama] ${target} ${ev.status}`);
            }
          } catch {
            /* ignore */
          }
        }
      });
      res.data.on("end", () => {
        console.log(`[Ollama] modelo "${target}" pronto.`);
        resolve();
      });
      res.data.on("error", reject);
    });
  } catch (err: any) {
    console.error(
      `[Ollama] falha ao garantir modelo "${target}":`,
      err?.message || err,
    );
  }
}

export async function ensureOllamaModel(): Promise<void> {
  const sqlModel = process.env.OLLAMA_MODEL_SQL || "qwen2.5-coder:7b";
  const targets = new Set<string>([OLLAMA_MODEL]);
  if (sqlModel && sqlModel !== OLLAMA_MODEL) targets.add(sqlModel);
  console.log(
    `[Ollama] modelos a garantir: ${Array.from(targets).join(", ")}`,
  );
  for (const t of targets) {
    await pullSingleModel(t);
  }
}
