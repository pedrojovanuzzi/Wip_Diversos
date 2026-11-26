import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ConsumoClientes } from "../_componentes/ConsumoClientes";

export const metadata = {
  title: "Consumo — Wip Diversos",
};

export default async function ConsumoPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <ConsumoClientes user={user} />;
}
