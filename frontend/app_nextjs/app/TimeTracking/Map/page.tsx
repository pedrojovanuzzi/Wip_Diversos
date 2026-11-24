import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import Tela from "./Tela";

export const metadata = {
  title: "Mapa do ponto — Wip Diversos",
};

export default async function Page() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  return <Tela />;
}
