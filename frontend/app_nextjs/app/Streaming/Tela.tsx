"use client";

import dynamic from "next/dynamic";

// Tela copiada do app React (app/_telas). Roda só no navegador, como no CRA:
// ela usa window/localStorage livremente e não foi preparada para SSR.
const StreamingAdminTela = dynamic(
  () => import("@/app/_telas/SerContratos/StreamingAdmin").then((m) => m.StreamingAdmin),
  { ssr: false },
);

export default function Tela() {
  return <StreamingAdminTela />;
}
