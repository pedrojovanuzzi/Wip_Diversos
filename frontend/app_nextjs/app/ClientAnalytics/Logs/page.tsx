import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { LogsClient } from "../_componentes/LogsClient";

export const metadata = {
  title: "Logs do cliente — Wip Diversos",
};

export default async function LogsPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <LogsClient user={user} />;
}
