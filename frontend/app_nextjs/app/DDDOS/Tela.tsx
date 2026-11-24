"use client";

import dynamic from "next/dynamic";

// Tela copiada do app React (app/_telas). Roda só no navegador, como no CRA:
// ela usa window/localStorage livremente e não foi preparada para SSR.
const DDDOSHomeTela = dynamic(
  () => import("@/app/_telas/DDDOS_Monitoring/DDDOS_Home").then((m) => m.DDDOS_Home),
  { ssr: false },
);

export default function Tela() {
  return <DDDOSHomeTela />;
}
