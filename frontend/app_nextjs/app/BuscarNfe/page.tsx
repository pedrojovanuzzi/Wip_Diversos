import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import BuscarNfeClient from "./BuscarNfeClient";

export const metadata = {
  title: "Buscar NFe — Wip Diversos",
};

export default async function BuscarNfePage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <BuscarNfeClient user={user} />;
}
