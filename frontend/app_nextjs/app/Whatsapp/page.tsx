import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import WhatsappChatClient from "./WhatsappChatClient";

export const metadata = {
  title: "WhatsApp — Wip Diversos",
};

export default async function WhatsappPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <WhatsappChatClient authUser={user} />;
}
