import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import SerContratosClient, {
  type ClienteComServico,
  type PlanoArmazenamento,
} from "./SerContratosClient";

export const metadata = {
  title: "Streaming e câmeras — Wip Diversos",
};

export default async function SerContratosPage() {
  // no app antigo: só logado, qualquer nível
  const user = await requireUser(0);
  if (!user) redirect("/auth/login");

  const [clientesIniciais, planosIniciais] = await Promise.all([
    apiFetch<{ clientes: ClienteComServico[] }>("/sercontratos/clientes")
      .then((d) => d.clientes)
      .catch((e) => {
        console.error("Erro ao carregar clientes com serviços:", e);
        return [] as ClienteComServico[];
      }),
    apiFetch<{ plans: PlanoArmazenamento[] }>("/cameras/admin/planos")
      .then((d) => d.plans || [])
      .catch((e) => {
        console.error("Erro ao carregar os planos de armazenamento:", e);
        return [] as PlanoArmazenamento[];
      }),
  ]);

  return (
    <SerContratosClient
      user={user}
      clientesIniciais={clientesIniciais}
      planosIniciais={planosIniciais}
    />
  );
}
