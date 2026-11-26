import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import AuditoriaClient, {
  type Filtros,
  type Opcoes,
  type Resultado,
} from "./AuditoriaClient";

export const metadata = {
  title: "Auditoria — Wip Diversos",
};

/**
 * Roda no SERVIDOR do Next, a cada vez que a página é aberta ou a URL muda.
 *
 * Os filtros ficam na URL (/auditoria?usuario=joao&pagina=2). O servidor lê a
 * URL, busca os registros no backend e já entrega a página com a tabela
 * preenchida. O navegador não precisa fazer nenhuma chamada para mostrar os
 * dados.
 */
export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  const sp = await searchParams;
  const ler = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const filtros: Filtros = {
    usuario: ler("usuario"),
    acao: ler("acao"),
    modulo: ler("modulo"),
    inicio: ler("inicio"),
    fim: ler("fim"),
    busca: ler("busca"),
    pagina: Math.max(1, Number(ler("pagina")) || 1),
  };

  // Mesma chamada que a tela do React fazia, mas daqui do servidor.
  const qs = new URLSearchParams({ pagina: String(filtros.pagina) });
  for (const k of ["usuario", "acao", "modulo", "inicio", "fim", "busca"] as const) {
    const v = filtros[k].trim();
    if (v) qs.set(k, v);
  }

  // As duas buscas saem ao mesmo tempo.
  const [resultado, opcoes] = await Promise.all([
    apiFetch<Resultado>(`/auditoria?${qs}`).catch((e) => mensagemDoBackend(e)),
    apiFetch<Opcoes>("/auditoria/filtros").catch(
      (): Opcoes => ({ usuarios: [], modulos: [] }),
    ),
  ]);

  return (
    <AuditoriaClient
      user={user}
      filtros={filtros}
      opcoes={opcoes}
      resultado={typeof resultado === "string" ? null : resultado}
      erro={typeof resultado === "string" ? resultado : null}
    />
  );
}

/** O apiFetch guarda a resposta de erro do backend em `detail`. */
function mensagemDoBackend(e: unknown): string {
  const detail = (e as { detail?: { message?: string } })?.detail;
  return detail?.message ?? "Erro ao carregar os logs.";
}
