import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import LogViewerClient from "./LogViewerClient";

export const metadata = {
  title: "Visualizar log — Wip Diversos",
};

/** /LogViewer?arquivo=<caminho do arquivo>&pasta=<pasta para voltar> */
export default async function LogViewerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  const sp = await searchParams;
  const ler = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  return <LogViewerClient user={user} arquivo={ler("arquivo")} pasta={ler("pasta")} />;
}
