"use client";

import dynamic from "next/dynamic";
import type { User } from "@/lib/auth";
import type { Employee, Record as Registro } from "./_componentes/TimeTrackingMap";

// Leaflet só existe no navegador.
const TimeTrackingMap = dynamic(() => import("./_componentes/TimeTrackingMap"), { ssr: false });

export default function MapClient({
  user,
  registros,
  funcionarios,
}: {
  user: User;
  registros: Registro[];
  funcionarios: Employee[];
}) {
  return <TimeTrackingMap user={user} registros={registros} funcionarios={funcionarios} />;
}
