import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { SearchInterface } from "../_componentes/SearchInterface";

export const metadata = {
  title: "Buscar NFCom — Wip Diversos",
};

export default async function BuscarNfcomPage() {
  // Nível 1 é a tela de quem só consulta.
  const user = await requireUser(1);
  if (!user) redirect("/auth/login");

  // Opcional: sem a chave a tela segue funcionando.
  const chave = await apiFetch<{ Chave?: string }>("/NFCom/getNfcomByChaveDeOlhoNoImposto")
    .then((d) => d?.Chave || "")
    .catch((e) => {
      console.error("Erro ao buscar a chave do Olho no Imposto:", e);
      return "";
    });

  return <SearchInterface user={user} chaveOlhoNoImposto={chave} />;
}
