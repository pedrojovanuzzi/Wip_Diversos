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
    const categoria = CATEGORIAS_PADRAO.includes(parsed.categoria)
      ? parsed.categoria
      : "Outro";
    return {
      categoria,
      resumo: String(parsed.resumo || "").slice(0, 200),
    };
  } catch (err: any) {
    console.error("Ollama analyze error:", err?.message || err);
    return { categoria: "Outro", resumo: "" };
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
