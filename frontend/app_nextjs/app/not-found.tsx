import { redirect } from "next/navigation";

// O app antigo tinha <Route path="*"> mandando qualquer URL desconhecida para
// a Home. Aqui igual: a Home exige login e o middleware leva ao /auth/login.
export default function NotFound() {
  redirect("/");
}
