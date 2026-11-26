import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import StreamingAdminClient, { type Assinante } from "./StreamingAdminClient";

export const metadata = {
  title: "Streaming — Wip Diversos",
};

export default async function StreamingPage() {
  // no app antigo: só logado, qualquer nível
  const user = await requireUser(0);
  if (!user) redirect("/auth/login");

  const { iniciais, erroInicial } = await apiFetch<{ items?: Assinante[] }>("/streaming")
    .then((d) => ({ iniciais: d.items || [], erroInicial: "" }))
    .catch((e) => ({
      iniciais: [] as Assinante[],
      erroInicial: (e as { detail?: { message?: string } }).detail?.message || "Erro ao carregar.",
    }));

  return <StreamingAdminClient user={user} iniciais={iniciais} erroInicial={erroInicial} />;
}
