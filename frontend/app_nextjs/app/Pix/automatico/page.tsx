import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import PixAutomaticoClient from "./PixAutomaticoClient";

export const metadata = {
  title: "Pix Automático — Wip Diversos",
};

export default async function PixAutomaticoPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <PixAutomaticoClient user={user} />;
}
