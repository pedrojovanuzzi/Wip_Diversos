import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import PixDetalheClient from "./PixDetalheClient";

export const metadata = {
  title: "Gerar Pix — Wip Diversos",
};

export default async function PixDetalhePage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  const { tipo } = await params;
  return <PixDetalheClient user={user} tipo={tipo} />;
}
