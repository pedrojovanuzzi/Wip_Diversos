import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { DesautorizaOnu } from "../_componentes/DesautorizaOnu";

export const metadata = {
  title: "Desautorizar ONU — Wip Diversos",
};

export default async function DesautorizaOnuPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <DesautorizaOnu user={user} />;
}
