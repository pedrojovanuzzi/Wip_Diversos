import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import FileShareManagerClient, { type FileItem } from "./FileShareManagerClient";

export const metadata = {
  title: "Arquivos — Wip Diversos",
};

export default async function ArquivosPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  const { iniciais, erroInicial } = await apiFetch<FileItem[]>("/files/list")
    .then((d) => ({ iniciais: d || [], erroInicial: "" }))
    .catch((e) => ({
      iniciais: [] as FileItem[],
      erroInicial: (e as { detail?: { erro?: string } }).detail?.erro || "Erro ao carregar arquivos",
    }));

  return <FileShareManagerClient user={user} iniciais={iniciais} erroInicial={erroInicial} />;
}
