# Instruções para continuar a migração React → Next.js

Você está continuando uma migração **incremental** do app React (CRA) em
[`../app`](../app) para Next.js 15 (App Router) em **`./`** (este diretório,
`frontend/app_nextjs`). O app React permanece intocado e em produção — você só
**adiciona** páginas no Next, página por página.

---

## 1. Stack do Next

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind v3**
- **React 19** com Server Components / Server Actions
- **npm** (não usar pnpm/yarn/bun)
- Porta dev/start: **3001** (já fixada no `package.json`)
- Variáveis de ambiente: usa as **mesmas do app antigo** (`REACT_APP_URL`,
  `REACT_APP_BASE_URL`, etc.) — `next.config.js` já expõe pra Client Components

## 2. O que JÁ foi migrado (não refazer)

| Rota | Arquivos |
|------|----------|
| `/auth/login` | `app/auth/login/{page.tsx, LoginForm.tsx, actions.ts}` |
| `/` | `app/{page.tsx, HomeBackupButton.tsx}` |
| `/licencas` | `app/licencas/{page.tsx, LicencasClient.tsx, actions.ts}` |
| `/feedback/Opnion` | `app/feedback/Opnion/{page.tsx, OpnionList.tsx}` |
| `/Onu` + `/Onu/AutorizarOnu` + `/Onu/DesautorizarOnu` + `/Onu/Settings` | `app/Onu/...` |
| `/PowerDns` | `app/PowerDns/{page.tsx, PowerDnsClient.tsx}` |
| `/Pm2Logs` | `app/Pm2Logs/{page.tsx, Pm2LogsClient.tsx}` |
| `/ServerLogs` (absorveu `/LogViewer`) | `app/ServerLogs/{page.tsx, ServerLogsClient.tsx}` |

**Infra já pronta:**
- `lib/auth.ts` — `getUser()`, `requireUser(N)`, `getTokenFromCookie()`, tipo `User`
- `lib/api.ts` — `apiFetch<T>(path, opts)` (server-side, injeta JWT do cookie)
- `lib/types.ts` — tipos compartilhados (`OnuData`, `WifiData`, `Folder`)
- `middleware.ts` — guard de rota (precisa adicionar prefixos novos)
- `components/NavBar.tsx` — NavBar completa adaptada (Client Component)
- `components/Message.tsx`

## 3. Padrão obrigatório de migração

Para **cada rota** do app antigo (ver `../app/src/App.tsx` pra ver todas):

### 3.1 Estrutura de arquivos

Crie sempre **dois** arquivos:

```
app/<RotaIgualAoAppAntigo>/page.tsx       # Server Component (auth + SSR fetch)
app/<RotaIgualAoAppAntigo>/<Nome>Client.tsx  # Client Component ("use client")
```

Para subcomponentes específicos da página: `app/<Rota>/components/Foo.tsx`.

### 3.2 Manter URLs idênticas ao app antigo

NÃO renomeie rotas. Se o app antigo usa `/NFSE`, crie `app/NFSE/page.tsx` (com
maiúsculas). Mesma case-sensitivity.

### 3.3 Template do `page.tsx` (Server Component)

```ts
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";  // só se for SSR-fetchar dados
import FooClient from "./FooClient";

export const metadata = { title: "Foo" };

export default async function FooPage() {
  // Permissão mínima: olhar como o app antigo gateia (ver App.tsx)
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  // Se a página puder fazer SSR de algum dado:
  // const data = await apiFetch<Foo[]>("/foo/listar");

  return <FooClient user={user} /* initialData={data} */ />;
}
```

**Rotas públicas** (sem login): use `getUser()` em vez de `requireUser()` e
NÃO faça `redirect`. Exemplo: `app/feedback/Opnion/page.tsx`.

### 3.4 Template do `<Nome>Client.tsx`

```tsx
"use client";

import { useState } from "react";
import axios from "axios";
import NavBar from "@/components/NavBar";
import type { User } from "@/lib/auth";

export default function FooClient({ user }: { user: User }) {
  const token = user.token;
  // estado, handlers, JSX iguais ao componente do app antigo

  return (
    <div>
      <NavBar user={user} />
      {/* ... */}
    </div>
  );
}
```

### 3.5 Server Actions (mutations)

Use Server Actions para CREATE/UPDATE/DELETE quando possível
(ver `app/licencas/actions.ts` como referência):

```ts
"use server";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";

export async function createFooAction(input: FooInput) {
  try {
    await apiFetch("/foo/criar", { method: "POST", body: input });
    revalidatePath("/foo");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "Erro ao criar foo." };
  }
}
```

No client, dispare com `useTransition` + `router.refresh()` após sucesso.

**Quando NÃO usar Server Action:** chamadas que precisam de progresso em tempo
real, upload de arquivos grandes, polling. Nesses casos use `axios` direto no
Client Component (ver `app/Onu/OnuHomeClient.tsx`).

## 4. Substituições obrigatórias

| Original (React/CRA) | Substituir por (Next) |
|----------------------|----------------------|
| `import { Link } from "react-router-dom"` | `import Link from "next/link"` |
| `<Link to="/x">` | `<Link href="/x">` |
| `import { useNavigate } from "react-router-dom"` | `import { useRouter } from "next/navigation"` |
| `const navigate = useNavigate(); navigate("/x")` | `const router = useRouter(); router.push("/x")` |
| `import { useLocation } from "react-router-dom"` | `import { usePathname, useSearchParams } from "next/navigation"` |
| `useParams()` | `useParams()` de `next/navigation` |
| `import { useAuth } from ".../AuthContext"` | Receber `user: User` como **prop** vinda do Server Component |
| `Cookies.set/get/remove` (js-cookie) | Para login/logout: usar `loginAction` / `logoutAction` em `app/auth/login/actions.ts`. Para ler no client: `document.cookie` cru (ver `app/HomeBackupButton.tsx`) |
| `process.env.REACT_APP_URL` | **Mantém** `process.env.REACT_APP_URL` (já exposta) |
| `useEffect` com `window.*` no body | OK, mas mover acesso a `window`/`document`/`localStorage` para **dentro** do `useEffect` (não no render inicial), senão quebra SSR |
| `react-router` state em `navigate("/x", { state: {...} })` | Não existe no Next. Use **URL search params** (`?foo=bar`) ou **unifique as telas** num único Client Component (ver como `/ServerLogs` absorveu `/LogViewer`) |

## 5. Bibliotecas DOM-only (SSR-incompatíveis)

Quando a página usa **leaflet, react-leaflet, react-webcam, react-signature-canvas,
chart.js, recharts, qrcode.react** (ou qualquer lib que toca `window`/`document` na
importação), faça **dynamic import com `ssr: false`** dentro de um Client Component:

```tsx
"use client";
import dynamic from "next/dynamic";
const Map = dynamic(() => import("./MapInner"), { ssr: false });
```

Onde `MapInner.tsx` é um Client Component que faz o `import "leaflet"` etc.

## 6. Hydration mismatch

Já configurado `suppressHydrationWarning` no `<body>` (extensões tipo ColorZilla).
Mas dentro dos seus componentes, **nunca** acesse no render inicial:
- `window.*`
- `document.*`
- `localStorage` / `sessionStorage`
- `Date.now()` / `Math.random()` que produzam markup diferente

Coloque tudo isso dentro de `useEffect(() => { ... }, [])`.

## 7. Ao terminar uma rota

1. **Adicione o prefixo** ao `middleware.ts` em `PROTECTED_PREFIXES` (ou
   `PUBLIC_EXACT` se for pública)
2. Rode `npm run build` para validar tipos e bundling
3. Se for trocar entre `dev` e `build`, **apague `.next`** primeiro
   (`rm -rf .next`) — Windows mistura artefatos

## 8. Instalação de novas dependências

Se a página antiga usa uma lib que não está no `package.json` daqui, adicione:

```bash
cd frontend/app_nextjs
npm install <pacote>
```

Pacotes que **NÃO** trazer: `react-router-dom`, `react-scripts`, `web-vitals`,
`@testing-library/*`. O resto do `../app/package.json` é geralmente seguro.

## 9. Próximas rotas a portar (ordem sugerida)

Lista completa em `../app/src/App.tsx`. Sugestão de batches:

**Batch 3 — TimeTracking (4 rotas)**
- `/TimeTracking/ClockIn` — `../app/src/pages/TimeTracking/TimeClock.tsx` (público, usa webcam → dynamic import com ssr:false)
- `/TimeTracking/Admin` — `EmployeeManager.tsx` (permission >= 5)
- `/TimeTracking/Map` — `TimeTrackingMap.tsx` (leaflet → dynamic)
- `/TimeTracking/Report` — `MonthlyReport.tsx`

**Batch 4 — NFe / NFSe / NFCom**
- `/NFSE` — `NFSE.tsx`
- `/BuscarNfseGerada` — `BuscarNFSEGerada.tsx`
- `/GerarNotaDeServicoIndependente`
- `/nfe/comodato` (criar `app/nfe/comodato/page.tsx`) — `Comodato.tsx`
- `/BuscarNfe` — `BuscarNfe.tsx`
- `/Nfcom` — `Nfcom.tsx`
- `/Nfcom/Buscar` — `SearchInterface.tsx`

**Batch 5 — Pix (7 rotas)** — ver `../app/src/pages/Pix/`
- `/Pix`, `/Pix/automatico`, `/Pix/automaticoAdmin`, `/Pix/Admin`, `/Pix/findPaid`,
  `/Pix/:tipo` (rota dinâmica → `app/Pix/[tipo]/page.tsx`), `/Pix/Cancelar/Cobranca`

**Batch 6 — WhatsApp**
- `/Whatsapp` — `WhatsappChat.tsx`
- `/Whatsapp/:id` — `userChat/userChat.tsx` (criar `app/Whatsapp/[id]/page.tsx`)
- `/whatsapp/broadcast` — `EnviarMensagem.tsx`

**Batch 7 — Diversos**
- `/Create` — criar usuário
- `/feedbackCreate`, `/feedback/:technician/:id` (rota dinâmica)
- `/Prefeitura/Login`, `/Prefeitura/CodeOtp`
- `/ClientAnalytics`, `/ClientAnalytics/Logs`
- `/DDDOS`
- `/solicitacoes-servico`
- `/phone-location` (leaflet)
- `/chamados/ficha-tecnica`, `/chamados/ficha-tecnica/nova`
- `/TokenAutoAtendimento` (4 rotas, **públicas**)
- `/doc/:fileName` (PdfViewer)
- `/ZapSignConfig`, `/zapsign-config`, `/grafico-instalacoes`

## 10. Regras finais

- **NUNCA** modifique nada em `../app` (app React antigo). Só adicione no Next.
- Mantenha permissões idênticas ao `App.tsx` antigo (`permission >= 1/2/5`).
- Se uma página tem **rota dinâmica** (`/x/:id`), no Next vira
  `app/x/[id]/page.tsx`, e os params chegam via:
  ```ts
  export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
  }
  ```
- Não invente abstrações. Copie a estrutura visual e a lógica do componente
  antigo o mais 1:1 possível. A migração é lift-and-shift; otimizações vêm
  depois.
- Quando uma página tem padrão **diferente** dos exemplos (ex.: usa Redux,
  websocket, MUI complexo), pare e descreva o problema antes de continuar —
  não chute.
- Ao terminar um batch, rode `npm run build` e reporte o resultado.

## 11. Como começar

1. Leia `../app/src/App.tsx` para entender as rotas e permissões.
2. Leia o componente antigo correspondente (ex.: `../app/src/pages/TimeTracking/TimeClock.tsx`).
3. Crie os 2 arquivos seguindo o template (`page.tsx` + `<Nome>Client.tsx`).
4. Atualize `middleware.ts` com a nova rota.
5. `npm run build` para validar.
6. Próxima rota.
