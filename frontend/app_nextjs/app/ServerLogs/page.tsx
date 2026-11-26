import Link from "next/link";
import { redirect } from "next/navigation";
import { FaSearch } from "react-icons/fa";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { Folder } from "@/lib/types";
import FolderList, { ROOT } from "./_componentes/FolderList";

export const metadata = {
  title: "Logs do servidor — Wip Diversos",
};

/**
 * Origem: frontend/app/src/pages/logs/ServerLogs.tsx
 * Voltando do visualizador, a pasta vem em ?pasta=.
 */
export default async function ServerLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  const pedida = (await searchParams).pasta;
  const pastaInicial = typeof pedida === "string" && pedida.startsWith(ROOT) ? pedida : ROOT;

  const folders = await apiFetch<Folder[]>("/ServerLogs/FoldersRecursion", {
    method: "POST",
    body: { path: pastaInicial },
  }).catch((e) => {
    console.error(e);
    return [] as Folder[];
  });

  return (
    <div className="relative min-h-screen bg-slate-100">
      <FolderList user={user} pastaInicial={pastaInicial} folders={folders} />

      <Link
        href="/ClientLogsSearch"
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-3 shadow-lg shadow-emerald-900/20 transition"
      >
        <FaSearch />
        <span className="hidden sm:inline">Busca de Conexões</span>
      </Link>
    </div>
  );
}
