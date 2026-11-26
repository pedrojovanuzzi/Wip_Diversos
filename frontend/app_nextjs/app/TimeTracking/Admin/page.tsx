import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import EmployeeManagerClient, { type Employee } from "./EmployeeManagerClient";

export const metadata = {
  title: "Gestão de ponto — Wip Diversos",
};

export default async function EmployeeManagerPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  // Tela de nível 5: a API manda o CPF junto, e a tela mostra/edita o CPF.
  const iniciais = await apiFetch<Employee[]>("/time-tracking/employee").catch((e) => {
    console.error("Manager: Error fetching", e);
    return [] as Employee[];
  });

  return <EmployeeManagerClient user={user} iniciais={iniciais} />;
}
