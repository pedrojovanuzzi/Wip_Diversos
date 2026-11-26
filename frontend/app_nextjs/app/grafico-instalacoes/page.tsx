import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import GraficoInstalacoesClient, {
  type ClientesAtivadosResponse,
  type ClientesMensalResponse,
  type DadosGrafico,
  type MonthlyHistoryResponse,
  type MonthlyTrendResponse,
  type StatsResponse,
  type YearlyComparisonResponse,
} from "./GraficoInstalacoesClient";

export const metadata = {
  title: "Gráfico de instalações — Wip Diversos",
};

const VAZIO: DadosGrafico = {
  data: null,
  trend: null,
  yearly: null,
  clientesAtivados: null,
  breakdown: null,
  history: null,
  clientesMensal: null,
  falhou: false,
};

/** Mesmas buscas que a tela fazia ao abrir, com as mesmas regras de erro. */
async function carregar(month: number, year: number): Promise<DadosGrafico> {
  const a = "/chamados/analytics";
  let principais;
  try {
    // As 4 principais: se uma falha, a tela avisa (era um alert no React).
    principais = await Promise.all([
      apiFetch<StatsResponse>(`${a}/instalacoes?month=${month}&year=${year}`),
      apiFetch<MonthlyTrendResponse>(`${a}/instalacoes/trend?year=${year}`),
      apiFetch<YearlyComparisonResponse>(`${a}/instalacoes/anos?years=5`),
      apiFetch<ClientesAtivadosResponse>(`${a}/clientes/ativados`),
    ]);
  } catch (e) {
    console.error("Erro ao buscar dados:", e);
    return { ...VAZIO, falhou: true };
  }
  const [data, trend, yearly, clientesAtivados] = principais;

  // As extras falham sozinhas, sem derrubar o resto.
  const [breakdown, history, clientesMensal] = await Promise.all([
    apiFetch<{ breakdown: { assunto: string; total: number }[] }>(
      `${a}/instalacoes/diagnostico?year=${year}`,
    )
      .then((d) => d.breakdown)
      .catch((e) => (console.error("Erro no diagnóstico de assuntos:", e), null)),
    apiFetch<MonthlyHistoryResponse>(`${a}/instalacoes/historico-mensal?years=5&endYear=${year}`).catch(
      (e) => (console.error("Erro no histórico mensal:", e), null),
    ),
    apiFetch<ClientesMensalResponse>(`${a}/clientes/mensal?year=${year}`).catch(
      (e) => (console.error("Erro nos snapshots mensais de clientes:", e), null),
    ),
  ]);

  return { data, trend, yearly, clientesAtivados, breakdown, history, clientesMensal, falhou: false };
}

export default async function GraficoInstalacoesPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  // Fuso do processo = Brasília (next.config.js).
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();

  return (
    <GraficoInstalacoesClient
      user={user}
      inicial={await carregar(mes, ano)}
      mesInicial={mes}
      anoAtual={ano}
    />
  );
}
