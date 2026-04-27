import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import LicencasClient, { type Licenca } from "./LicencasClient";

export const metadata = { title: "Gerenciar Licenças" };

export default async function LicencasPage() {
  const user = await requireUser(5);
  if (!user) redirect("/auth/login");

  let licencas: Licenca[] = [];
  let loadError: string | null = null;
  try {
    licencas = await apiFetch<Licenca[]>("/licenca/listar");
  } catch (err) {
    console.error("[licencas] erro carregando lista:", err);
    loadError = "Erro ao carregar licenças.";
  }

  return (
    <div>
      <NavBar user={user} />
      <LicencasClient initialLicencas={licencas} initialError={loadError} />
    </div>
  );
}
