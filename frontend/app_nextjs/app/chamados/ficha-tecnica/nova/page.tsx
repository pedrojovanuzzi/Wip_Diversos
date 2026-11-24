import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import Tela from "./Tela";

export const metadata = {
  title: "Nova ficha técnica — Wip Diversos",
};

export default async function Page() {
  const user = await requireUser(0); // no app antigo: só logado, qualquer nível
  if (!user) redirect("/auth/login");

  return <Tela />;
}
