import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import {
  DeclaracoesQuitacaoLista,
  type DeclaracaoItem,
} from "../_componentes/DeclaracoesQuitacaoLista";

export const metadata = {
  title: "Declarações de quitação — Wip Diversos",
};

export default async function DeclaracoesQuitacaoPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  const iniciais = await apiFetch<DeclaracaoItem[]>("/NFCom/declaracaoQuitacao/listar").catch(
    (e) => {
      console.error("Erro ao listar declarações:", e);
      return [] as DeclaracaoItem[];
    },
  );

  return <DeclaracoesQuitacaoLista user={user} iniciais={iniciais} />;
}
