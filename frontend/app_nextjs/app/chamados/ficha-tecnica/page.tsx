import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import ListarFichasTecnicasClient, { type FichasIniciais } from "./ListarFichasTecnicasClient";

export const metadata = {
  title: "Fichas técnicas — Wip Diversos",
};

export default async function ListarFichasTecnicasPage() {
  // no app antigo: só logado, qualquer nível
  const user = await requireUser(0);
  if (!user) redirect("/auth/login");

  // Mesma busca que a tela faz ao abrir: página 1, 10 por página, sem filtro.
  const inicial = await apiFetch<FichasIniciais>("/chamados-ficha?page=1&limit=10").catch(
    (e): FichasIniciais => {
      console.error("Erro ao buscar fichas:", e);
      return { data: [], totalPages: 1, page: 1 };
    },
  );

  return (
    <ListarFichasTecnicasClient
      user={user}
      inicial={{
        data: inicial.data ?? [],
        totalPages: inicial.totalPages || 1,
        page: inicial.page || 1,
      }}
    />
  );
}
