import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { BuscarNfseGerada } from "../NFSE/_componentes/BuscarNFSEGerada";

export const metadata = {
  title: "Buscar NFS-e — Wip Diversos",
};

export default async function BuscarNfseGeradaPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <BuscarNfseGerada user={user} />;
}
