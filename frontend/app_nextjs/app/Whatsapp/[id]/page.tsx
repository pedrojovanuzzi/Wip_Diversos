import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import UserChatClient from "./UserChatClient";

export const metadata = {
  title: "Conversa WhatsApp — Wip Diversos",
};

export default async function UserChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  const { id } = await params;
  return <UserChatClient authUser={user} id={id} />;
}
