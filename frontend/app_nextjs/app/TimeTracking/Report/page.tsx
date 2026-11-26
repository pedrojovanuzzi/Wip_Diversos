import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { hojeLocal } from "@/lib/hora";
import MonthlyReportClient from "./MonthlyReportClient";

export const metadata = {
  title: "Relatório de ponto — Wip Diversos",
};

export default async function MonthlyReportPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  const funcionarios = await apiFetch<any[]>("/time-tracking/employee")
    .then((lista) => [...lista].sort((a, b) => Number(a.id) - Number(b.id)))
    .catch((e) => {
      console.error("Error fetching employees:", e);
      return [] as any[];
    });

  const [ano, mes] = hojeLocal().split("-");

  return (
    <MonthlyReportClient user={user} funcionarios={funcionarios} mesInicial={mes} anoInicial={ano} />
  );
}
