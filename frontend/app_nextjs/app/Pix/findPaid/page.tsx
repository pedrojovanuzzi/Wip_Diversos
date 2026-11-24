import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import PixFindPaidClient from "./PixFindPaidClient";

export const metadata = {
  title: "Buscar Pix Pagos — Wip Diversos",
};

export default async function PixFindPaidPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <PixFindPaidClient user={user} />;
}
