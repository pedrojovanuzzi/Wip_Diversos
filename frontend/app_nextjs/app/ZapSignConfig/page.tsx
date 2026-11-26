import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import ZapSignConfigClient from "./ZapSignConfigClient";
import { carregarTemplates } from "./templates";

export const metadata = {
  title: "Config ZapSign — Wip Diversos",
};

export default async function ZapSignConfigPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <ZapSignConfigClient user={user} templatesIniciais={await carregarTemplates()} />;
}
