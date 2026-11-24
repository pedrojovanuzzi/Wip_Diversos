"use client";

import dynamic from "next/dynamic";

// Tela copiada do app React (app/_telas). Roda só no navegador, como no CRA:
// ela usa window/localStorage livremente e não foi preparada para SSR.
const LogsClientTela = dynamic(
  () => import("@/app/_telas/ClientAnalytics/LogsClient").then((m) => m.LogsClient),
  { ssr: false },
);

export default function Tela() {
  return <LogsClientTela />;
}
