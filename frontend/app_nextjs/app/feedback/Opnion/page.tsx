import Link from "next/link";
import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";
import OpnionList, { type Opnion } from "./OpnionList";

export const metadata = { title: "Opiniões" };

function convertToBrasiliaTime(utcTime: string) {
  const date = new Date(utcTime);
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function somarMes(mes: string, delta: number) {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(ano, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function OpnionPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesParam } = await searchParams;
  const atual = mesAtual();
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : atual;

  // Página pública: tentamos carregar, mas se a rota do backend exigir token,
  // o user (se logado) já entra no apiFetch via cookie.
  const user = await getUser();

  let feedback: Opnion[] = [];
  try {
    feedback = await apiFetch<Opnion[]>(`/feedback/NoteFeedbackOpnion?mes=${mes}`, {
      noAuth: !user,
    });
  } catch (err) {
    console.error("[opnion] erro:", err);
  }

  const people = feedback.map((c) => ({
    login: c.login,
    opnion: c.opnion,
    time: convertToBrasiliaTime(c.time),
  }));

  return (
    <div>
      <NavBar user={user} />
      <header className="p-5 sm:bg-slate-700 text-gray-200 text-xl font-Park"></header>
      <nav className="flex items-center gap-3 px-4 sm:px-10 pt-6 text-sm">
        <Link href={`?mes=${somarMes(mes, -1)}`} className="text-indigo-700">
          ← Mês anterior
        </Link>
        <span className="font-semibold text-gray-900">{mes}</span>
        {mes < atual && (
          <Link href={`?mes=${somarMes(mes, 1)}`} className="text-indigo-700">
            Próximo mês →
          </Link>
        )}
      </nav>
      <OpnionList people={people} />
    </div>
  );
}
