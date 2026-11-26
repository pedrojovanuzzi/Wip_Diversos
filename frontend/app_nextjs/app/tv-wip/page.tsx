import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { TvWipLista, type ContasIniciais } from "./_componentes/TvWipLista";
import type { Pacote } from "./_componentes/TvWipPacotes";

export const metadata = {
  title: "TV WIP — Wip Diversos",
};

export default async function TvWipPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  // Mesmas buscas que a tela fazia ao abrir: contas ativas (pág. 1) e pacotes.
  const [inicial, pacotesIniciais] = await Promise.all([
    apiFetch<Partial<ContasIniciais>>("/tv-wip?pagina=1&porPagina=50&situacao=ativas&busca=")
      .then(
        (d): ContasIniciais => ({
          contas: d.contas || [],
          total: d.total || 0,
          paginas: d.paginas || 1,
          resumo: d.resumo || { ativas: 0, desativadas: 0 },
        }),
      )
      .catch((e): ContasIniciais => {
        console.error("Erro ao carregar a lista:", e);
        return { contas: [], total: 0, paginas: 1, resumo: { ativas: 0, desativadas: 0 } };
      }),
    apiFetch<{ pacotes?: Pacote[] }>("/tv-wip/pacotes")
      .then((d) => d.pacotes || [])
      .catch((e) => {
        console.error("Erro ao carregar os pacotes:", e);
        return [] as Pacote[];
      }),
  ]);

  return <TvWipLista user={user} inicial={inicial} pacotesIniciais={pacotesIniciais} />;
}
