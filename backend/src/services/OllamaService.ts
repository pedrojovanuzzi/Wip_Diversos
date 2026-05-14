import axios from "axios";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:1.5b";

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
      { timeout: 120000 },
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

export async function ensureOllamaModel(): Promise<void> {
  const target = OLLAMA_MODEL;
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
                  `[Ollama] ${ev.status || "pulling"}: ${pct}%`,
                );
                lastPct = pct;
              }
            } else if (ev.status) {
              console.log(`[Ollama] ${ev.status}`);
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
