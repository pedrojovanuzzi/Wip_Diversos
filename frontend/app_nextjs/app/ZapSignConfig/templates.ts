import "server-only";
import { apiFetch } from "@/lib/api";
import type { Template } from "./ZapSignConfigClient";

/** Busca os modelos do ZapSign (usada também por /zapsign-config). */
export async function carregarTemplates(): Promise<Template[]> {
  return apiFetch<Template[]>("/zapsign-templates").catch((e) => {
    console.error("Erro ao buscar templates:", e);
    return [];
  });
}
