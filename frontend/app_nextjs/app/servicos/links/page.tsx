import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import GerarLinksServicoClient, { type ServicoCatalogo } from "./GerarLinksServicoClient";

export const metadata = {
  title: "Links de serviço — Wip Diversos",
};

export default async function GerarLinksServicoPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  const catalogo = await apiFetch<ServicoCatalogo[]>("/service-links/catalogo").catch((e) => {
    console.error("Erro ao carregar catálogo:", e);
    return [] as ServicoCatalogo[];
  });

  return <GerarLinksServicoClient user={user} catalogo={catalogo} />;
}
