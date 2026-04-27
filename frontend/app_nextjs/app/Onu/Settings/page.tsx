import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import OnuSettingsClient from "./OnuSettingsClient";

export const metadata = { title: "ONU — Configurações Avançadas" };

export default async function OnuSettingsPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");
  return <OnuSettingsClient user={user} />;
}
