import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import DDDOSClient, {
  type EventsPerHost,
  type EventsPerMinute,
  type Last10,
} from "./DDDOSClient";

export const metadata = {
  title: "Monitor DDoS — Wip Diversos",
};

/** Cada série que falha vira lista vazia, como na tela do React. */
async function serie<T>(rota: string, mapear: (d: any) => T): Promise<T[]> {
  try {
    const dados = await apiFetch<unknown>(`/DosProtect/${rota}`);
    return Array.isArray(dados) ? dados.map(mapear) : [];
  } catch (e) {
    console.log(e);
    return [];
  }
}

export default async function DDDOSPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  const [last10pppoe, eventsPerHost, eventsPerMinute] = await Promise.all([
    serie<Last10>("last10Pppoe", (d) => ({ pppoe: String(d.pppoe), total: Number(d.total) })),
    serie<EventsPerHost>("eventsPerHost", (d) => ({ host: String(d.host), total: Number(d.total) })),
    serie<EventsPerMinute>("eventsPerMinute", (d) => ({ minuto: String(d.minuto), total: Number(d.total) })),
  ]);

  return (
    <DDDOSClient
      last10pppoe={last10pppoe}
      eventsPerMinute={eventsPerMinute}
      eventsPerHost={eventsPerHost}
      errorMsg={null}
    />
  );
}
