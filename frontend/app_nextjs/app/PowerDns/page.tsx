import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import PowerDnsClient from "./PowerDnsClient";

export const metadata = { title: "PowerDNS" };

export default async function PowerDnsPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");
  return <PowerDnsClient user={user} />;
}
