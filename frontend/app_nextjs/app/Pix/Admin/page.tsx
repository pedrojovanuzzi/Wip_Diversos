import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import PixAdminClient from "./PixAdminClient";

export const metadata = {
  title: "Configurações Pix — Wip Diversos",
};

export default async function PixAdminPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  return <PixAdminClient user={user} />;
}
