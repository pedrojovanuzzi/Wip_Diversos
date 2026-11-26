import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import WhatsappTesteClient, { type FlowInfo } from "./WhatsappTesteClient";

export const metadata = {
  title: "Teste do robô — Wip Diversos",
};

export default async function WhatsappTestePage() {
  // O app antigo só registrava esta rota em localhost.
  const host = (await headers()).get("host") ?? "";
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) notFound();

  const user = await requireUser(0); // no app antigo: só logado, qualquer nível
  if (!user) redirect("/auth/login");

  const fluxos = await apiFetch<FlowInfo[]>("/whatsapp-test/flows").catch((e) => {
    console.error("Erro ao carregar fluxos:", e);
    return [] as FlowInfo[];
  });

  return <WhatsappTesteClient user={user} fluxos={fluxos} />;
}
