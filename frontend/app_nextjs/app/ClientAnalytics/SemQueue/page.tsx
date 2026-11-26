import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ClientesSemQueue } from "../_componentes/ClientesSemQueue";

export const metadata = {
  title: "Clientes sem queue — Wip Diversos",
};

export default async function ClientesSemQueuePage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <ClientesSemQueue user={user} />;
}
