"use client";

import dynamic from "next/dynamic";

// Tela copiada do app React (app/_telas). Roda só no navegador, como no CRA:
// ela usa window/localStorage livremente e não foi preparada para SSR.
const MensalidadesClienteTela = dynamic(
  () => import("@/app/_telas/Mensalidades/MensalidadesCliente").then((m) => m.MensalidadesCliente),
  { ssr: false },
);

export default function Tela() {
  return <MensalidadesClienteTela />;
}
