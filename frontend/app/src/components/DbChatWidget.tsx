import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { BsChatDots, BsX, BsCode } from "react-icons/bs";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "react-router-dom";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  sql?: string;
  rowCount?: number;
  rows?: any[];
}

const STORAGE_KEY = "dbchat-history-v1";

export const DbChatWidget: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [history, setHistory] = useState<ChatTurn[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      /* ignore */
    }
  }, [history]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, history, loading]);

  // O totem (autoatendimento) não deve exibir o chat de IA.
  if (location.pathname.startsWith("/TokenAutoAtendimento")) return null;
  // Páginas do cliente de câmeras (login, portal, setup) — não exibir o chat,
  // mesmo que um operador esteja logado no sistema interno na mesma sessão.
  if (/^\/Cameras\/(Login|Portal|Setup)/i.test(location.pathname)) return null;
  if (!user?.token) return null;

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    const turn: ChatTurn = { role: "user", content: q };
    const next = [...history, turn];
    setHistory(next);
    setInput("");
    setLoading(true);
    setStage("generating_sql");
    try {
      const baseUrl = process.env.REACT_APP_URL;
      const startRes = await axios.post(
        `${baseUrl}/db-chat/ask/start`,
        {
          question: q,
          history: history.map((h) => ({ role: h.role, content: h.content })),
        },
        {
          headers: { Authorization: `Bearer ${user.token}` },
          timeout: 30000,
        },
      );
      const jobId = startRes.data.jobId;

      let result: any = null;
      while (true) {
        await new Promise((r) => setTimeout(r, 1500));
        const statusRes = await axios.get(`${baseUrl}/db-chat/ask/status`, {
          params: { jobId },
          headers: { Authorization: `Bearer ${user.token}` },
          timeout: 30000,
        });
        const data = statusRes.data;
        if (data.stage) setStage(data.stage);
        if (data.stage === "done") {
          result = data.result;
          break;
        }
        if (data.stage === "error") {
          throw new Error(data.error || "Erro na consulta");
        }
      }

      setHistory([
        ...next,
        {
          role: "assistant",
          content: result?.answer || "(sem resposta)",
          sql: result?.sql,
          rowCount: result?.rowCount,
          rows: result?.rows,
        },
      ]);
    } catch (e: any) {
      setHistory([
        ...next,
        {
          role: "assistant",
          content:
            "Erro ao consultar o banco: " +
            (e?.response?.data?.message || e?.message || "desconhecido"),
        },
      ]);
    } finally {
      setLoading(false);
      setStage("");
    }
  };

  const stageLabel = (s: string) => {
    if (s === "generating_sql") return "Gerando SQL...";
    if (s === "executing") return "Executando consulta no banco...";
    if (s === "summarizing") return "Formatando resposta...";
    return "Processando...";
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-lg flex items-center gap-2"
          title="Perguntar ao banco de dados"
        >
          <BsChatDots className="text-xl" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-2rem)] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-indigo-600 text-white rounded-t-lg">
            <div>
              <h3 className="font-bold">Consultar Banco (IA)</h3>
              <p className="text-[10px] opacity-80">
                Read-only. Não modifica dados.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearHistory}
                className="text-xs underline opacity-80 hover:opacity-100"
                title="Limpar histórico"
              >
                Limpar
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-xl hover:opacity-80"
              >
                <BsX />
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50"
          >
            {history.length === 0 && (
              <div className="text-sm text-gray-500 text-center mt-8">
                <p className="mb-2">
                  Pergunte sobre clientes, chamados, faturas...
                </p>
                <p className="text-xs">Exemplos:</p>
                <ul className="text-xs mt-1 space-y-1">
                  <li>• Quantos clientes ativos tem em São Paulo?</li>
                  <li>• Quantos cancelamentos abertos no último mês?</li>
                  <li>• Quais os 5 clientes com mais chamados em 2026?</li>
                </ul>
              </div>
            )}

            {history.map((m, i) => (
              <div
                key={i}
                className={`text-sm rounded p-2 ${
                  m.role === "user"
                    ? "bg-indigo-100 text-indigo-900 ml-8"
                    : "bg-white border border-gray-200 text-gray-800 mr-8"
                }`}
              >
                <div className="text-[10px] uppercase font-bold mb-1 opacity-60">
                  {m.role === "user" ? "Você" : "IA"}
                </div>
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.sql && (
                  <details className="mt-2 text-xs text-gray-500">
                    <summary className="cursor-pointer hover:text-gray-700 flex items-center gap-1">
                      <BsCode /> SQL executado ({m.rowCount} linha(s))
                    </summary>
                    <pre className="mt-1 p-2 bg-gray-100 rounded overflow-x-auto text-[10px]">
                      {m.sql}
                    </pre>
                  </details>
                )}
              </div>
            ))}

            {loading && (
              <div className="text-xs text-gray-500 italic flex items-center gap-2">
                <AiOutlineLoading3Quarters className="animate-spin" />
                {stageLabel(stage)}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={loading}
                placeholder="Faça sua pergunta..."
                className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="px-3 py-2 bg-indigo-600 text-white rounded text-sm font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
