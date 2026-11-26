import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { GerenciarLicencas, type Aba, type Licenca } from "./_componentes/GerenciarLicencas";

export const metadata = {
  title: "Licenças — Wip Diversos",
};

const ABAS: Aba[] = ["licencas", "mensalidades", "notas", "configuracao"];

export default async function LicencasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  // O sino de notificações abre direto numa aba: /licencas?aba=mensalidades
  const pedida = (await searchParams).aba;
  const abaInicial: Aba = ABAS.includes(pedida as Aba) ? (pedida as Aba) : "licencas";

  const licencasIniciais = await apiFetch<Licenca[]>("/licenca/listar").catch((e) => {
    console.error("Erro ao buscar licenças:", e);
    return [] as Licenca[];
  });

  return (
    <GerenciarLicencas user={user} licencasIniciais={licencasIniciais} abaInicial={abaInicial} />
  );
}
