import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import CriarFichaTecnicaClient from "./CriarFichaTecnicaClient";

export const metadata = {
  title: "Nova ficha técnica — Wip Diversos",
};

export default async function CriarFichaTecnicaPage() {
  // no app antigo: só logado, qualquer nível
  const user = await requireUser(0);
  if (!user) redirect("/auth/login");

  return <CriarFichaTecnicaClient user={user} abertoEm={new Date().toISOString()} />;
}
