import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import CodefClient, { type Apuracao } from "./CodefClient";

export const metadata = {
  title: "Coleta CODEF — Wip Diversos",
};

export default async function CodefPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  // Fuso do processo = Brasília (next.config.js).
  const hoje = new Date();
  const anoHoje = hoje.getFullYear();
  // Em janeiro o mês a reportar é dezembro do ano anterior; abrir já no ano
  // certo evita a tela começar num ano inteiro vazio.
  const anoInicial = hoje.getMonth() === 0 ? anoHoje - 1 : anoHoje;
  // O mês corrente ainda não fechou: abre no último mês fechado.
  const mesInicial = hoje.getMonth() === 0 ? 12 : hoje.getMonth();

  // Mesma busca que a tela faz ao abrir.
  const qs = new URLSearchParams({ ano: String(anoInicial), base: "vencimento", tributos: "todos" });
  const apuracaoInicial = await apiFetch<Apuracao>(`/codef?${qs}`).catch((e) => {
    console.error("Erro ao apurar o CODEF:", e);
    return null;
  });

  return (
    <CodefClient
      user={user}
      anoHoje={anoHoje}
      anoInicial={anoInicial}
      mesInicial={mesInicial}
      apuracaoInicial={apuracaoInicial}
    />
  );
}
