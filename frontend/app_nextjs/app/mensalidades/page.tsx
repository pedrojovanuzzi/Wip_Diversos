import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { Mensalidades, type ClienteMk, type ListaClientes } from "./_componentes/Mensalidades";

export const metadata = {
  title: "Mensalidades — Wip Diversos",
};

type Sp = Record<string, string | string[] | undefined>;

/** Clientes do MK-Auth. Página, tipo, campo e busca vêm da URL. */
export default async function MensalidadesPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  const sp = await searchParams;
  const ler = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  // mesmas regras da tela para ler a URL
  const qs = new URLSearchParams({
    pagina: String(Math.max(1, Number(ler("pagina")) || 1)),
    porPagina: ler("porPagina") === "100" ? "100" : "50",
    tipo: ler("tipo") || "todos",
    campo: ler("campo") || "nome",
    busca: ler("busca"),
  });

  const lista: ListaClientes = await apiFetch<{ clientes: ClienteMk[]; total: number }>(
    `/mensalidades/clientes?${qs}`,
  )
    .then((d) => ({ clientes: d.clientes ?? [], total: d.total ?? 0, erro: "" }))
    .catch((e) => ({
      clientes: [],
      total: 0,
      erro: (e as { detail?: { message?: string } }).detail?.message || "Erro ao carregar clientes.",
    }));

  return <Mensalidades user={user} lista={lista} />;
}
