import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import BuscarNfcomClient from "./BuscarNfcomClient";

export const metadata = {
  title: "Buscar NFCom — Wip Diversos",
};

export default async function BuscarNfcomPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  return <BuscarNfcomClient user={user} />;
}
