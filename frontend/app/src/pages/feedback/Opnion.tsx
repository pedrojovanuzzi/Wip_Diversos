import { useEffect, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import List from "./components/List";

interface Opnion {
  login: string;
  opnion: string;
  time: string;
}

// "YYYY-MM" do mês atual, no horário local.
function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function somarMes(mes: string, delta: number) {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(ano, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nomeDoMes(mes: string) {
  const [ano, m] = mes.split("-").map(Number);
  const texto = new Date(ano, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export const Opnion = () => {
  const [feedback, setFeedback] = useState<Opnion[]>([]);
  const [mes, setMes] = useState(mesAtual());
  const [carregando, setCarregando] = useState(false);
  const { user } = useAuth();
  const token = user?.token;
  const ehMesAtual = mes >= mesAtual();

  function convertToBrasiliaTime(utcTime: string) {
    const date = new Date(utcTime);
    return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }

  // Troca de mês cancela a busca anterior: senão uma resposta lenta chega
  // por último e mostra as opiniões de outro mês sob o título deste.
  async function getFeed(mesBuscado: string, signal: AbortSignal) {
    setCarregando(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL}/feedback/NoteFeedbackOpnion?mes=${mesBuscado}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal,
        },
      );
      const data = response.ok ? await response.json() : [];
      if (!signal.aborted) setFeedback(data);
    } catch (error) {
      if (signal.aborted) return;
      console.error("Erro ao mostrar feedbacks:", error);
      setFeedback([]);
    } finally {
      if (!signal.aborted) setCarregando(false);
    }
  }

  useEffect(() => {
    const controle = new AbortController();
    getFeed(mes, controle.signal);
    return () => controle.abort();
  }, [mes]);

  const people = (feedback || []).map((client) => ({
    login: client.login,
    opnion: client.opnion,
    time: convertToBrasiliaTime(client.time),
  }));

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-8 -mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMes(somarMes(mes, -1))}
            className="inline-flex items-center justify-center size-9 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Mês anterior"
          >
            <FiChevronLeft />
          </button>
          <input
            type="month"
            value={mes}
            max={mesAtual()}
            onChange={(e) => e.target.value && setMes(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          />
          <button
            type="button"
            onClick={() => setMes(somarMes(mes, 1))}
            disabled={ehMesAtual}
            className="inline-flex items-center justify-center size-9 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Próximo mês"
          >
            <FiChevronRight />
          </button>
          {!ehMesAtual && (
            <button
              type="button"
              onClick={() => setMes(mesAtual())}
              className="h-9 rounded-lg px-3 text-sm text-indigo-700 hover:bg-indigo-50"
            >
              Mês atual
            </button>
          )}
          <span className="ml-auto text-sm text-slate-500">
            {carregando
              ? "Carregando..."
              : `${nomeDoMes(mes)}: ${people.length} ${people.length === 1 ? "opinião" : "opiniões"}`}
          </span>
        </div>
      </div>
      <List people={people} />
    </div>
  );
};
