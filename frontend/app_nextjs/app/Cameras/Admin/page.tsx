import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import CamerasAdminClient, { type ClienteItem, type Plano } from "./CamerasAdminClient";

export const metadata = {
  title: "Câmeras — Wip Diversos",
};

export default async function CamerasAdminPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  const [clientes, planos] = await Promise.all([
    apiFetch<{ items?: ClienteItem[] }>("/cameras/admin/clientes")
      .then((d) => ({ itens: d.items || [], erro: null as string | null }))
      .catch((e) => ({
        itens: [] as ClienteItem[],
        erro: (e as { detail?: { message?: string } }).detail?.message || "Erro ao carregar.",
      })),
    apiFetch<{ plans?: Plano[] }>("/cameras/admin/planos")
      .then((d) => ({ planos: d.plans || [], erro: null as string | null }))
      .catch(() => ({ planos: [] as Plano[], erro: "Erro ao carregar os planos de armazenamento." })),
  ]);

  return (
    <CamerasAdminClient
      user={user}
      itensIniciais={clientes.itens}
      planosIniciais={planos.planos}
      erroInicial={clientes.erro ?? planos.erro}
    />
  );
}
