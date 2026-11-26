import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import FeedbackCreateClient, {
  type Indicadores,
  type Tecnico,
} from "./FeedbackCreateClient";

export const metadata = {
  title: "Feedback — Wip Diversos",
};

/**
 * Gerar link de feedback e ver os indicadores.
 * O período e o técnico ficam na URL: /feedbackCreate?periodo=ano&tecnico=Joao
 */
export default async function FeedbackCreatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  const sp = await searchParams;
  const anual = sp.periodo === "ano";
  const tecnico = typeof sp.tecnico === "string" ? sp.tecnico : "";

  const qs = new URLSearchParams({ period: anual ? "year" : "month" });
  if (tecnico) qs.set("technician", tecnico);

  const [tecnicos, indicadores] = await Promise.all([
    // Sem token: para nível 5 a API manda o CPF junto, e ele não pode ir para
    // o HTML. O seletor só usa id e nome.
    apiFetch<any[]>("/time-tracking/employee", { noAuth: true })
      .then((lista) =>
        lista
          .filter((e) => e.active !== false)
          .map((e): Tecnico => ({ id: Number(e.id), name: String(e.name || "").trim() }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      )
      .catch(() => [] as Tecnico[]),
    apiFetch<any>(`/feedback/resumo?${qs}`)
      .then(montarIndicadores)
      .catch(() => null),
  ]);

  return (
    <FeedbackCreateClient
      user={user}
      tecnicos={tecnicos}
      tecnico={tecnico}
      anual={anual}
      indicadores={indicadores}
    />
  );
}

/** "Sim/Não" chega do MySQL como bit: { type: "Buffer", data: [1] }. */
function sim(dados: any[]) {
  return dados.map((item) => ({
    note: Array.isArray(item.note?.data) ? item.note.data[0] : item.note,
    count: Number(item.count),
  }));
}

function montarIndicadores(data: any): Indicadores {
  return {
    internet: data.internet ?? [],
    service: data.service ?? [],
    responseTime: data.responseTime ?? [],
    recommend: sim(data.recommend ?? []),
    solved: sim(data.solved ?? []),
    technician: (data.technician ?? []).map((item: any) => ({
      note: item.note,
      count: Number(item.count),
      login: item.login || "",
    })),
  };
}
