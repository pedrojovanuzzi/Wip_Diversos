"use client";

import dynamic from "next/dynamic";

// Tela copiada do app React (app/_telas). Roda só no navegador, como no CRA:
// ela usa window/localStorage livremente e não foi preparada para SSR.
const GraficoInstalacoesTela = dynamic(
  () => import("@/app/_telas/Chamados/GraficoInstalacoes").then((m) => m.GraficoInstalacoes),
  { ssr: false },
);

export default function Tela() {
  return <GraficoInstalacoesTela />;
}
