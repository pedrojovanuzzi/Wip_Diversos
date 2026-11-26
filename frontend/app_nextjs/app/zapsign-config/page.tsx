import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import ZapSignConfigClient from "../ZapSignConfig/ZapSignConfigClient";
import { carregarTemplates } from "../ZapSignConfig/templates";

export const metadata = {
  title: "Config ZapSign — Wip Diversos",
};

/** Mesma tela do /ZapSignConfig, com nível 5 (como no app antigo). */
export default async function ZapSignConfigAdminPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  return <ZapSignConfigClient user={user} templatesIniciais={await carregarTemplates()} />;
}
