import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { OnuSettings } from "../_componentes/OnuSettings";

export const metadata = {
  title: "Configurações da ONU — Wip Diversos",
};

export default async function OnuSettingsPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  return <OnuSettings user={user} />;
}
