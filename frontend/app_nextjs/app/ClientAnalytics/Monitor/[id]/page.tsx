import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import {
  MonitorCliente,
  type Monitor,
  type MonitorEvent,
} from "../../_componentes/MonitorCliente";

export const metadata = {
  title: "Monitor do cliente — Wip Diversos",
};

export default async function MonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  const id = decodeURIComponent((await params).id);

  // Mesma busca que a tela fazia ao abrir (todos os eventos).
  const { inicial, erroInicial } = await apiFetch<{ monitor: Monitor; eventos?: MonitorEvent[] }>(
    `/ClientAnalytics/Monitor/${encodeURIComponent(id)}?apenasMudancas=false`,
  )
    .then((d) => ({ inicial: { monitor: d.monitor, eventos: d.eventos ?? [] }, erroInicial: null }))
    .catch((e) => ({
      inicial: null,
      erroInicial:
        (e as { detail?: { error?: string } }).detail?.error || "Erro ao carregar o monitoramento.",
    }));

  return <MonitorCliente user={user} id={id} inicial={inicial} erroInicial={erroInicial} />;
}
