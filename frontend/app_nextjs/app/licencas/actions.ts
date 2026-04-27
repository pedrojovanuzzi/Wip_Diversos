"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface CreateLicencaInput {
  cliente_nome: string;
  software: string;
  chave: string;
  observacao: string;
}

export async function createLicencaAction(
  input: CreateLicencaInput,
): Promise<ActionResult> {
  if (!input.cliente_nome || !input.chave) {
    return { ok: false, error: "Cliente e Chave são obrigatórios." };
  }
  try {
    await apiFetch("/licenca/criar", {
      method: "POST",
      body: input,
    });
    revalidatePath("/licencas");
    return { ok: true };
  } catch (err) {
    const detail = (err as { detail?: { message?: string } } | null)?.detail;
    return { ok: false, error: detail?.message ?? "Erro ao criar licença." };
  }
}

export async function toggleLicencaStatusAction(
  id: number,
  novoStatus: "ativo" | "bloqueado",
): Promise<ActionResult> {
  try {
    await apiFetch(`/licenca/status/${id}`, {
      method: "PUT",
      body: { status: novoStatus },
    });
    revalidatePath("/licencas");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao alterar status." };
  }
}

export async function deleteLicencaAction(id: number): Promise<ActionResult> {
  try {
    await apiFetch(`/licenca/${id}`, { method: "DELETE" });
    revalidatePath("/licencas");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao excluir licença." };
  }
}
