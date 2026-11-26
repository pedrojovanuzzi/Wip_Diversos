import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { hojeLocal } from "@/lib/hora";
import ClientLogsSearchClient from "./ClientLogsSearchClient";

export const metadata = {
  title: "Busca de logs — Wip Diversos",
};

export default async function ClientLogsSearchPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  const { pastas, erroPastas } = await apiFetch<string[]>("/ServerLogs")
    .then((d) => ({ pastas: d || [], erroPastas: null }))
    .catch((e) => {
      console.error(e);
      return { pastas: [] as string[], erroPastas: "Falha ao carregar pastas do servidor de logs." };
    });

  return (
    <ClientLogsSearchClient user={user} pastas={pastas} erroPastas={erroPastas} hoje={hojeLocal()} />
  );
}
