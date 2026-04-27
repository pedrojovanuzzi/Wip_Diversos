import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import AutorizarOnuClient from "./AutorizarOnuClient";

export const metadata = { title: "Autorizar ONU" };

export default async function AutorizarOnuPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");
  return <AutorizarOnuClient user={user} />;
}
