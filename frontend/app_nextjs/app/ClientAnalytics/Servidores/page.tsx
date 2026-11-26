import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { ServidoresAcesso, type Servidor } from "../_componentes/ServidoresAcesso";

export const metadata = {
  title: "Servidores — Wip Diversos",
};

export default async function ServidoresPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  const { iniciais, erroInicial } = await apiFetch<Servidor[]>("/servidores-acesso")
    .then((d) => ({ iniciais: d, erroInicial: null }))
    .catch((e) => ({
      iniciais: [] as Servidor[],
      erroInicial:
        (e as { detail?: { message?: string } }).detail?.message || "Erro ao carregar os servidores.",
    }));

  return <ServidoresAcesso user={user} iniciais={iniciais} erroInicial={erroInicial} />;
}
