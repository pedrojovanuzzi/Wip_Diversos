import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import EmployeeManagerClient from "./EmployeeManagerClient";

export const metadata = {
  title: "Gerenciar Funcionários",
};

export default async function EmployeeManagerPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  return <EmployeeManagerClient user={user} />;
}
