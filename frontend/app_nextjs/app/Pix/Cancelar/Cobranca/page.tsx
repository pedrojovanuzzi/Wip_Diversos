import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import PixCancelarCobrancaClient from "./PixCancelarCobrancaClient";

export const metadata = {
  title: "Cobrança Pix — Wip Diversos",
};

export default async function PixCancelarCobrancaPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <PixCancelarCobrancaClient user={user} />;
}
