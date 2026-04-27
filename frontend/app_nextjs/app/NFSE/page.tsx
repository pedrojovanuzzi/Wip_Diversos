import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import NFSEClient from "./NFSEClient";

export const metadata = {
  title: "NFSE — Wip Diversos",
};

export default async function NFSEPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <NFSEClient user={user} />;
}
