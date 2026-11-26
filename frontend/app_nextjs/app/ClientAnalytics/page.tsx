import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ClientAnalytics } from "./_componentes/ClientAnalytics";

export const metadata = {
  title: "Análise de clientes — Wip Diversos",
};

export default async function ClientAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  // Vindo de outra tela com o cliente escolhido: /ClientAnalytics?pppoe=...
  const pppoe = (await searchParams).pppoe;

  return <ClientAnalytics user={user} pppoeInicial={typeof pppoe === "string" ? pppoe : ""} />;
}
