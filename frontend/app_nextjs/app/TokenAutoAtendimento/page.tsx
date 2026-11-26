import { TokenAutoAtendimento } from "./_componentes/TokenAutoAtendimento";

export const metadata = {
  title: "Autoatendimento — Wip Diversos",
};

/** Totem (público). ?ocioso=false volta direto ao menu, sem a tela de descanso. */
export default async function TokenAutoAtendimentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ocioso = (await searchParams).ocioso;
  return <TokenAutoAtendimento ocioso={typeof ocioso === "string" ? ocioso : ""} />;
}
