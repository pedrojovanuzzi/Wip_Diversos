"use client";

import dynamic from "next/dynamic";
import type { User } from "@/lib/auth";
import type { PhoneDevice } from "./_componentes/PhoneLocationMap";

// Leaflet e o "há X minutos" só no navegador.
const PhoneLocationMap = dynamic(() => import("./_componentes/PhoneLocationMap"), { ssr: false });

export default function PhoneLocationClient({ user, iniciais }: { user: User; iniciais: PhoneDevice[] }) {
  return <PhoneLocationMap user={user} iniciais={iniciais} />;
}
