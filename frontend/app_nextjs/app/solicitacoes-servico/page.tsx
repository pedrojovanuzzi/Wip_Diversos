import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import SolicitacoesServicoClient, { type ListaInicial } from "./SolicitacoesServicoClient";

export const metadata = {
  title: "Serviços solicitados — Wip Diversos",
};

export default async function SolicitacoesServicoPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  // Mesma busca que a tela faz ao abrir: pendentes, página 1, 10 por página.
  const qs = new URLSearchParams({
    startDate: "",
    endDate: "",
    page: "1",
    limit: "10",
    finalizado: "false",
  });
  const inicial = await apiFetch<ListaInicial>(`/solicitacao-servico?${qs}`).catch(
    (e): ListaInicial => {
      console.error("Erro ao buscar serviços solicitados:", e);
      return { data: [], links_abertos: [], totalPages: 0, page: 1 };
    },
  );

  return (
    <SolicitacoesServicoClient
      user={user}
      inicial={{
        data: inicial.data ?? [],
        links_abertos: inicial.links_abertos ?? [],
        totalPages: inicial.totalPages ?? 0,
        page: inicial.page ?? 1,
      }}
    />
  );
}
