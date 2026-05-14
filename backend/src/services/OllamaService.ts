import axios from "axios";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";

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
      : CATEGORIAS_PADRAO.find((c) =>
          target.includes(norm(c)) || norm(c).includes(target),
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

export async function summarizeCancellations(
  messages: string[],
): Promise<string> {
  const cleanMessages = messages
    .map((m) => (m || "").trim())
    .filter((m) => m.length > 5)
    .map((m) => m.slice(0, 500))
    .slice(0, 60);

  if (cleanMessages.length === 0) return "";

  const corpus = cleanMessages
    .map((m, i) => `${i + 1}. ${m}`)
    .join("\n\n");

  const prompt = `Você é um analista de uma provedora de internet brasileira. Abaixo está uma lista de mensagens reais de chamados de cancelamento de clientes.

Sua tarefa: redigir um DIAGNÓSTICO EXECUTIVO em português claro, com no máximo 6 parágrafos curtos. Inclua:

1. Quais são os PRINCIPAIS MOTIVOS de cancelamento (em ordem de frequência aparente).
2. Padrões recorrentes — palavras, situações, reclamações que se repetem.
3. Quais cancelamentos parecem ser por falha da empresa (qualidade, atendimento, preço) vs externos (mudança, óbito, deixou de usar).
4. Sugestões objetivas de ação para reduzir o churn.

Escreva direto, sem listas numeradas, sem markdown, em linguagem corrida. Não cite mensagens individuais — agregue padrões.

MENSAGENS:
${corpus}

DIAGNÓSTICO:`;

  try {
    const res = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.4, num_ctx: 8192, num_predict: 800 },
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
