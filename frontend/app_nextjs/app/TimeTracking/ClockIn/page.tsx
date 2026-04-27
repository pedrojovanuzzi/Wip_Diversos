import { getUser } from "@/lib/auth";
import ClockInClient from "./ClockInClient";

export const metadata = {
  title: "Bater Ponto",
};

export default async function ClockInPage() {
  // Esta página é pública (quiosque), mas usamos getUser() 
  // para verificar se há um admin logado (habilita edição de data).
  const user = await getUser();

  return <ClockInClient user={user} />;
}
