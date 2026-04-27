import NavBar from "@/components/NavBar";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";
import OpnionList, { type Opnion } from "./OpnionList";

export const metadata = { title: "Opiniões" };

function convertToBrasiliaTime(utcTime: string) {
  const date = new Date(utcTime);
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default async function OpnionPage() {
  // Página pública: tentamos carregar, mas se a rota do backend exigir token,
  // o user (se logado) já entra no apiFetch via cookie.
  const user = await getUser();

  let feedback: Opnion[] = [];
  try {
    feedback = await apiFetch<Opnion[]>("/feedback/NoteFeedbackOpnion", {
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
      <OpnionList people={people} />
    </div>
  );
}
