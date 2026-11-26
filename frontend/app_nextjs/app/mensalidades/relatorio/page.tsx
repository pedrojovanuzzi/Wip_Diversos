import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import {
  mesAtual,
  RelatorioMensalidades,
  type Aba,
  type Linha,
} from "../_componentes/RelatorioMensalidades";

export const metadata = {
  title: "Relatório de mensalidades — Wip Diversos",
};

type Sp = Record<string, string | string[] | undefined>;

/** Relatório Wip 1 / Wip 2. Aba e mês vêm da URL. */
export default async function RelatorioMensalidadesPage({
  searchParams,
}: {
  searchParams: Promise<Sp>;
}) {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  const sp = await searchParams;
  const aba: Aba = sp.aba === "wip2" ? "wip2" : "wip1";
  const mesUrl = typeof sp.mes === "string" ? sp.mes : "";
  // mesAtual usa o fuso do processo (Brasília, ver next.config.js)
  const mes = /^\d{4}-\d{2}$/.test(mesUrl) ? mesUrl : mesAtual();

  const qs = new URLSearchParams({ aba, mes });
  const { linhas, erro } = await apiFetch<{ linhas?: Linha[] }>(`/mensalidades/relatorio?${qs}`)
    .then((d) => ({ linhas: d.linhas || [], erro: "" }))
    .catch((e) => ({
      linhas: [] as Linha[],
      erro:
        (e as { detail?: { message?: string } }).detail?.message || "Erro ao carregar o relatório.",
    }));

  return <RelatorioMensalidades user={user} aba={aba} mes={mes} linhas={linhas} erro={erro} />;
}
