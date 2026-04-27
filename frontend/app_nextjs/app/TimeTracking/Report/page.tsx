import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import MonthlyReportClient from "./MonthlyReportClient";

export const metadata = {
  title: "Relatório Mensal",
};

export default async function MonthlyReportPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  return <MonthlyReportClient user={user} />;
}
