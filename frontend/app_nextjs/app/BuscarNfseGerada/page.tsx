import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import BuscarNfseGeradaClient from "./BuscarNfseGeradaClient";

export const metadata = {
  title: "Buscar NFS-e Geradas — Wip Diversos",
};

export default async function BuscarNfseGeradaPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <BuscarNfseGeradaClient user={user} />;
}
