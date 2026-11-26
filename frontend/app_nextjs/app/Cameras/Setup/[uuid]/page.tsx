import { apiFetch } from "@/lib/api";
import CameraSetupClient from "./CameraSetupClient";

export const metadata = {
  title: "Configurar câmera — Wip Diversos",
};

/** Público: o cliente abre pelo link. O servidor confere o link antes de abrir. */
export default async function CameraSetupPage({ params }: { params: Promise<{ uuid: string }> }) {
  const uuid = decodeURIComponent((await params).uuid);

  const loginInicial = await apiFetch<{ login: string }>(
    `/cameras/setup/${encodeURIComponent(uuid)}`,
    { noAuth: true },
  )
    .then((d) => d.login)
    .catch(() => null);

  return <CameraSetupClient uuid={uuid} loginInicial={loginInicial} />;
}
