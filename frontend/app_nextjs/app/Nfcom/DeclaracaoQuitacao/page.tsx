import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { DeclaracaoQuitacao, type DeclaranteDefaults } from "../_componentes/DeclaracaoQuitacao";

export const metadata = {
  title: "Declaração de quitação — Wip Diversos",
};

export default async function DeclaracaoQuitacaoPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  // Sem os padrões, a tela usa os que tem no código.
  const defaults = await apiFetch<DeclaranteDefaults>(
    "/NFCom/declaracaoQuitacao/declaranteDefaults",
  ).catch(() => null);

  return <DeclaracaoQuitacao user={user} defaults={defaults} />;
}
