import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import Pm2LogsClient from "./Pm2LogsClient";

export const metadata = { title: "PM2 Logs" };

export default async function Pm2LogsPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");
  return <Pm2LogsClient user={user} />;
}
