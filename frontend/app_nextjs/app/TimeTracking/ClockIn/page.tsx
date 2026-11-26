import { getUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { agoraLocal } from "@/lib/hora";
import ClockInClient, { type Funcionario } from "./ClockInClient";

export const metadata = {
  title: "Registrar ponto — Wip Diversos",
};

/**
 * Bater ponto. Rota pública (o funcionário confirma com o CPF), mas quem está
 * logado com nível 5 dispensa o CPF e pode mudar a data.
 */
export default async function ClockInPage() {
  const user = await getUser();

  // Sem token de propósito (noAuth): para administrador a API devolve o CPF de
  // cada funcionário, e o CPF é a "senha" do ponto. Ele não pode ir parar no
  // HTML da página. A tela só precisa de id e nome.
  const funcionarios = await apiFetch<Funcionario[]>("/time-tracking/employee", {
    noAuth: true,
  })
    .then((lista) =>
      lista
        .map(({ id, name }) => ({ id, name }))
        // mesma ordenação da tela do React
        .sort((a, b) => {
          const nomeA = a.name ? a.name.trim().toUpperCase() : "";
          const nomeB = b.name ? b.name.trim().toUpperCase() : "";
          return nomeA < nomeB ? -1 : nomeA > nomeB ? 1 : 0;
        }),
    )
    .catch(() => [] as Funcionario[]);

  return (
    <ClockInClient
      user={user}
      funcionarios={funcionarios}
      agoraInicial={agoraLocal()}
    />
  );
}
