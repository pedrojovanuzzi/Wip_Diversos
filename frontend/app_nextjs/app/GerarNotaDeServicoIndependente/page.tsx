import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { GerarNotaDeServicoIndependente } from "../NFSE/_componentes/GerarNotaDeServicoIndependente";

export const metadata = {
  title: "Nota de serviço independente — Wip Diversos",
};

export default async function GerarNotaDeServicoIndependentePage() {
  // Sem guard no app antigo, mas toda chamada da tela exige nível 2 no backend.
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <GerarNotaDeServicoIndependente user={user} />;
}
