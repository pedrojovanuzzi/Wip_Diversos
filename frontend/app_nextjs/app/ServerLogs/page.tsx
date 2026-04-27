import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import ServerLogsClient from "./ServerLogsClient";

export const metadata = { title: "Server Logs" };

export default async function ServerLogsPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");
  return <ServerLogsClient user={user} />;
}
