import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { MensalidadesCliente } from "../_componentes/MensalidadesCliente";
import type { Detalhe } from "../_componentes/api";

export const metadata = {
  title: "Mensalidades do cliente — Wip Diversos",
};

/** Financeiro de um cliente (/mensalidades/:login). */
export default async function MensalidadesClientePage({
  params,
}: {
  params: Promise<{ login: string }>;
}) {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  // o Next entrega o segmento ainda codificado (%20 etc.)
  const login = decodeURIComponent((await params).login);

  const { inicial, erroInicial } = await apiFetch<Detalhe>(
    `/mensalidades/clientes/${encodeURIComponent(login)}/faturas`,
  )
    .then((d) => ({ inicial: d as Detalhe | null, erroInicial: "" }))
    .catch((e) => ({
      inicial: null,
      erroInicial:
        (e as { detail?: { message?: string } }).detail?.message || "Erro ao carregar faturas.",
    }));

  return (
    <MensalidadesCliente user={user} login={login} inicial={inicial} erroInicial={erroInicial} />
  );
}
