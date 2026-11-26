import { apiFetch } from "@/lib/api";
import SolicitacaoServicoPublicaClient, { type LinkPublico } from "./SolicitacaoServicoPublicaClient";

export const metadata = {
  title: "Solicitar serviço — Wip Diversos",
};

/** Público: link de serviço enviado ao cliente (/s/:token). */
export default async function SolicitacaoServicoPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const token = decodeURIComponent((await params).token);

  const link: LinkPublico = await apiFetch<any>(
    `/service-links/publico/${encodeURIComponent(token)}`,
    { noAuth: true },
  )
    .then((dados): LinkPublico => ({ ok: true, dados }))
    .catch(
      (e): LinkPublico => ({
        ok: false,
        bloqueio:
          (e as { detail?: { errors?: { msg?: string }[] } }).detail?.errors?.[0]?.msg ||
          "Não foi possível abrir este link.",
      }),
    );

  return <SolicitacaoServicoPublicaClient token={token} link={link} />;
}
