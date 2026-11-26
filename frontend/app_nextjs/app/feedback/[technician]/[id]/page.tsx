import { apiFetch } from "@/lib/api";
import FeedbackPageClient from "./FeedbackPageClient";

export const metadata = {
  title: "Pesquisa de Satisfação",
};

/** Público: link de pesquisa enviado ao cliente. */
export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ technician: string; id: string }>;
}) {
  const p = await params;
  const technician = decodeURIComponent(p.technician);
  const id = decodeURIComponent(p.id);

  // Mesma conferência que a tela fazia ao abrir.
  const { usado, erro } = await apiFetch<{ used: boolean }>(`/feedback/${encodeURIComponent(id)}`, {
    noAuth: true,
  })
    .then((d) => ({ usado: !!d.used, erro: null as string | null }))
    .catch((e) =>
      (e as { status?: number }).status === 400
        ? { usado: true, erro: "O link é inválido ou já foi utilizado." }
        : { usado: false, erro: "Erro ao verificar o status do link. Tente novamente." },
    );

  return <FeedbackPageClient technician={technician} id={id} usadoInicial={usado} erroInicial={erro} />;
}
