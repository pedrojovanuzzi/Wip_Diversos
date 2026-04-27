import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import ComodatoClient from "./ComodatoClient";

export const metadata = {
  title: "NFe Comodato — Wip Diversos",
};

export default async function ComodatoPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  return <ComodatoClient user={user} />;
}
