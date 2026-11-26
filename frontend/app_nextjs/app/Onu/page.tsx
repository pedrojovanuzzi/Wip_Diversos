import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { OnuHome } from "./_componentes/OnuHome";

export const metadata = {
  title: "ONU — Wip Diversos",
};

export default async function OnuHomePage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <OnuHome user={user} />;
}
