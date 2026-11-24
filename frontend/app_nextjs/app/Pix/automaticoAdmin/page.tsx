import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import PixAutomaticoAdminClient from "./PixAutomaticoAdminClient";

export const metadata = {
  title: "Pix Automático — Admin — Wip Diversos",
};

export default async function PixAutomaticoAdminPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  return <PixAutomaticoAdminClient user={user} />;
}
