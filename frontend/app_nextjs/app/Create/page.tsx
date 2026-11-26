import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import CreateClient, { type Usuario } from "./CreateClient";

export const metadata = {
  title: "Novo usuário — Wip Diversos",
};

export default async function CreatePage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  const { usuarios, proximoId } = await apiFetch<{ usuarios: Usuario[]; proximoId: number }>(
    "/auth/users",
  ).catch((e) => {
    console.log(e);
    return { usuarios: [] as Usuario[], proximoId: null as number | null };
  });

  return <CreateClient user={user} usuariosIniciais={usuarios} proximoIdInicial={proximoId} />;
}
