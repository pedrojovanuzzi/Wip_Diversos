import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AutorizarOnu } from "../_componentes/AutorizarOnu";

export const metadata = {
  title: "Autorizar ONU — Wip Diversos",
};

export default async function AutorizarOnuPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <AutorizarOnu user={user} />;
}
