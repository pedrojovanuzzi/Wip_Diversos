import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import PixClient from "./PixClient";

export const metadata = {
  title: "Central Pix — Wip Diversos",
};

export default async function PixPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <PixClient user={user} />;
}
