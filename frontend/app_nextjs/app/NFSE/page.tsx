import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { NFSE } from "./_componentes/NFSE";

export const metadata = {
  title: "NFS-e — Wip Diversos",
};

export default async function NFSEPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  // Mesmas buscas que a tela fazia ao abrir: clientes sem filtro e o último
  // RPS, os dois no ambiente de produção (o padrão da tela).
  const [clientesIniciais, ultimoRpsInicial] = await Promise.all([
    apiFetch<any[]>("/nfse/BuscarClientes", {
      method: "POST",
      body: {
        cpf: "",
        filters: { plano: [], vencimento: [], cli_ativado: [], nova_nfe: [], servicos: [] },
        dateFilter: null,
        ambiente: "producao",
      },
    }).catch((e) => {
      console.error("Erro ao Buscar Clientes:", e);
      return [] as any[];
    }),
    apiFetch<{ ultimoRps?: number | string }>("/nfse/ultimoRps?ambiente=producao")
      .then((d) => (d?.ultimoRps ? String(d.ultimoRps) : ""))
      .catch(() => ""),
  ]);

  return (
    <NFSE user={user} clientesIniciais={clientesIniciais} ultimoRpsInicial={ultimoRpsInicial} />
  );
}
