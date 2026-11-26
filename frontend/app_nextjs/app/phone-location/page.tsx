import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import PhoneLocationClient from "./PhoneLocationClient";
import type { PhoneDevice } from "./_componentes/PhoneLocationMap";

export const metadata = {
  title: "Localização — Wip Diversos",
};

export default async function PhoneLocationPage() {
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  const iniciais = await apiFetch<PhoneDevice[]>("/phone-location").catch((e) => {
    console.error(e);
    return [] as PhoneDevice[];
  });

  return <PhoneLocationClient user={user} iniciais={iniciais} />;
}
