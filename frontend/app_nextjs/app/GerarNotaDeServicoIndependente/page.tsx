import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import GerarNotaIndependenteClient from "./GerarNotaIndependenteClient";

export const metadata = {
  title: "Gerar Nota Independente — Wip Diversos",
};

export default async function GerarNotaIndependentePage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <GerarNotaIndependenteClient user={user} />;
}
