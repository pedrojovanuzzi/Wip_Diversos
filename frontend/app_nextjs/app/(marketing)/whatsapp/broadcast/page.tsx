import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import EnviarMensagemClient from "./EnviarMensagemClient";

export const metadata = {
  title: "Disparo WhatsApp — Wip Diversos",
};

// Fica no route group (marketing) porque no Windows a pasta "whatsapp"
// colide com "Whatsapp" (o disco não diferencia maiúsculas). A URL continua
// /whatsapp/broadcast, igual ao app antigo.
export default async function EnviarMensagemPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  return <EnviarMensagemClient user={user} />;
}
