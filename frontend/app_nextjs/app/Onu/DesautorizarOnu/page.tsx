import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import DesautorizarOnuClient from "./DesautorizarOnuClient";

export const metadata = { title: "Desautorizar ONU" };

export default async function DesautorizarOnuPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");
  return <DesautorizarOnuClient user={user} />;
}
