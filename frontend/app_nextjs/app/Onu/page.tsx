import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import OnuHomeClient from "./OnuHomeClient";

export const metadata = { title: "ONU" };

export default async function OnuPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");
  return <OnuHomeClient user={user} />;
}
