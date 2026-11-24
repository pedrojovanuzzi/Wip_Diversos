import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import Tela from "./Tela";

export const metadata = {
  title: "Teste do robô — Wip Diversos",
};

export default async function Page() {
  // O app antigo só registrava esta rota em localhost.
  const host = (await headers()).get("host") ?? "";
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) notFound();

  const user = await requireUser(0); // no app antigo: só logado, qualquer nível
  if (!user) redirect("/auth/login");

  return <Tela />;
}
