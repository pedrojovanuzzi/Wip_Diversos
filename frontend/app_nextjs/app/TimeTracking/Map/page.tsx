import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import MapClient from "./MapClient";

export const metadata = {
  title: "Mapa de Ponto",
};

export default async function TimeTrackingMapPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  return <MapClient user={user} />;
}
