import { apiFetch } from "@/lib/api";
import WatchTvContaClient, { type LinkWatch } from "./WatchTvContaClient";

export const metadata = {
  title: "Conta Watch TV — Wip Diversos",
};

/** Público: link enviado ao cliente. O servidor confere o link antes de abrir. */
export default async function WatchTvContaPage({ params }: { params: Promise<{ token: string }> }) {
  const token = decodeURIComponent((await params).token);

  const link: LinkWatch = await apiFetch<{ nome: string; substituiConta?: boolean }>(
    `/watchtv-conta/${encodeURIComponent(token)}`,
    { noAuth: true },
  )
    .then((d): LinkWatch => ({ ok: true, nome: d.nome, substituiConta: !!d.substituiConta }))
    .catch(
      (e): LinkWatch => ({
        ok: false,
        mensagem:
          (e as { detail?: { message?: string } }).detail?.message ||
          "Este link não existe ou já foi utilizado.",
      }),
    );

  return <WatchTvContaClient token={token} link={link} />;
}
