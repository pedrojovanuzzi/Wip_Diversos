import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { Nfcom } from "./_componentes/Nfcom";

export const metadata = {
  title: "NFCom — Wip Diversos",
};

export default async function NfcomPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  // Mesma busca que a tela fazia ao abrir: sem filtro, ambiente de produção.
  const clientesIniciais = await apiFetch<any[]>("/NFCom/buscarClientes", {
    method: "POST",
    body: {
      cpf: "",
      filters: { plano: [], vencimento: [], cli_ativado: [], nova_nfe: [], SVA: [], servicos: [] },
      dateFilter: null,
      ambiente: "producao",
    },
  }).catch((e) => {
    console.error("Erro ao Buscar Clientes:", e);
    return [] as any[];
  });

  return <Nfcom user={user} clientesIniciais={clientesIniciais} />;
}
