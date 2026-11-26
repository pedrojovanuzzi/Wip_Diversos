import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import {
  NFSEServicosAdicionais,
  type ClienteServico,
} from "../_componentes/NFSEServicosAdicionais";

export const metadata = {
  title: "NFS-e serviços adicionais — Wip Diversos",
};

export default async function NFSEServicosAdicionaisPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  // Mesmas buscas que a tela fazia ao abrir, no ambiente de produção.
  const [clientesIniciais, ultimoRpsInicial] = await Promise.all([
    apiFetch<ClienteServico[]>("/nfse/BuscarClientesServicos", {
      method: "POST",
      body: { cpf: "", cidade: "", ambiente: "producao" },
    })
      .then((d) => d || [])
      .catch((e) => {
        console.error("Erro ao buscar clientes:", e);
        return [] as ClienteServico[];
      }),
    apiFetch<{ ultimoRps?: number | string }>("/nfse/ultimoRps?ambiente=producao")
      .then((d) => (d?.ultimoRps ? String(d.ultimoRps) : ""))
      .catch(() => ""),
  ]);

  return (
    <NFSEServicosAdicionais
      user={user}
      clientesIniciais={clientesIniciais}
      ultimoRpsInicial={ultimoRpsInicial}
    />
  );
}
