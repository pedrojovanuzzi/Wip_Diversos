import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import MapClient from "./MapClient";
import type { Employee, Record as Registro } from "./_componentes/TimeTrackingMap";

export const metadata = {
  title: "Mapa do ponto — Wip Diversos",
};

export default async function TimeTrackingMapPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  const [registros, funcionarios] = await Promise.all([
    apiFetch<Registro[]>("/time-tracking/map-records"),
    apiFetch<Employee[]>("/time-tracking/employee"),
  ]).catch((e) => {
    console.error("Error fetching data:", e);
    return [[], []] as [Registro[], Employee[]];
  });

  return <MapClient user={user} registros={registros} funcionarios={funcionarios} />;
}
