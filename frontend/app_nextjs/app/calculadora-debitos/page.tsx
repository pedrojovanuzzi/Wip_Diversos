import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import CalculadoraDebitosClient from "./CalculadoraDebitosClient";

export const metadata = {
  title: "Calculadora de débitos — Wip Diversos",
};

export default async function CalculadoraDebitosPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <CalculadoraDebitosClient user={user} />;
}
