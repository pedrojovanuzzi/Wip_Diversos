import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import NfcomClient from "./NfcomClient";

export const metadata = {
  title: "NFCom — Wip Diversos",
};

export default async function NfcomPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  return <NfcomClient user={user} />;
}
