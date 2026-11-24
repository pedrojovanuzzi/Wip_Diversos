import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import ComodatoClient from "../nfe/comodato/ComodatoClient";

export const metadata = {
  title: "NFe Comodato — Wip Diversos",
};

export default async function NfeComodatoPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <ComodatoClient user={user} />;
}
