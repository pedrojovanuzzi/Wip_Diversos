# Migração React → Next.js

O app React (CRA) em [`../app`](../app) foi migrado para Next.js 15 (App
Router) neste diretório, `frontend/app_nextjs`. **As 79 rotas do `App.tsx`
antigo existem aqui com a mesma URL e o mesmo nível de permissão**, mais o
curinga `*` (`app/not-found.tsx` manda para a Home). O app React continua no ar
até ser desligado. Não mexa em `../app`.

---

## 1. Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind v3**
- **React 19** com Server Components / Server Actions
- **npm** (não usar pnpm/yarn/bun)
- Porta dev/start: **3001** (já fixada no `package.json`)
- Variáveis de ambiente: as **mesmas do app antigo** (`REACT_APP_URL`,
  `REACT_APP_BASE_URL`, etc.), expostas aos Client Components pelo `next.config.js`
- MUI (`@mui/material` 6) com `AppRouterCacheProvider` no `app/layout.tsx`,
  para os estilos saírem no SSR

## 2. Dois tipos de tela

### 2.1 Telas nativas (portadas à mão)

`page.tsx` (Server Component) + `<Nome>Client.tsx` (Client Component) na
própria pasta da rota. O usuário chega por prop. São estas:

| Rota | Pasta |
|------|-------|
| `/auth/login` | `app/auth/login/` |
| `/` | `app/page.tsx`, `app/HomeBackupButton.tsx` |
| `/feedback/Opnion` | `app/feedback/Opnion/` |
| `/PowerDns`, `/Pm2Logs` | `app/PowerDns/`, `app/Pm2Logs/` |
| `/nfe/comodato`, `/NfeComodato`, `/BuscarNfe` | `app/nfe/comodato/` (o `/NfeComodato` reusa o `ComodatoClient`), `app/BuscarNfe/` |
| `/Pix` e subrotas (`/Pix/:tipo`, `/Admin`, `/automatico`, `/automaticoAdmin`, `/findPaid`, `/Cancelar/Cobranca`) | `app/Pix/` |
| `/Whatsapp`, `/Whatsapp/:id` | `app/Whatsapp/` |
| `/whatsapp/broadcast` | `app/(marketing)/whatsapp/broadcast/` (ver 7.1) |

**Telas nativas que ficaram para trás.** Licenças, ONU (4 telas), ServerLogs,
TimeTracking (4), NFS-e (3) e NFCom (2) tinham sido portadas em abril e o app
antigo seguiu mudando (alertas de licença, seleção em lote da ONU, último RPS,
exportação ZIP, hora extra manual, token no mapa do ponto...). Essas rotas
passaram a usar a cópia atual em `_telas` (seção 2.2), e o `/LogViewer` voltou
a ser a tela própria. Os arquivos nativos antigos dessas rotas **ficaram no
disco sem uso** e podem ser apagados:

```
app/licencas/{LicencasClient.tsx, actions.ts}
app/Onu/{OnuHomeClient.tsx, components/}, app/Onu/{AutorizarOnu,DesautorizarOnu,Settings}/*Client.tsx
app/ServerLogs/ServerLogsClient.tsx
app/TimeTracking/{ClockIn,Admin,Map,Report}/*Client.tsx, app/TimeTracking/Map/MapInner.tsx
app/NFSE/{NFSEClient.tsx, components/}
app/BuscarNfseGerada/BuscarNfseGeradaClient.tsx
app/GerarNotaDeServicoIndependente/GerarNotaIndependenteClient.tsx
app/Nfcom/{NfcomClient.tsx, components/}, app/Nfcom/Buscar/BuscarNfcomClient.tsx
```

Para saber se uma tela nativa ficou para trás: compare a data do último
commit dela com a do arquivo de origem em `../app/src/pages`.

### 2.2 Telas copiadas (`app/_telas`)

As demais telas foram copiadas do app antigo **sem mudar a lógica nem o JSX**,
só os imports. Ficam em `app/_telas/<pasta do app antigo>/` (o `_` impede o
Next de criar rota ali). Cada rota tem dois arquivos curtos:

```
app/mensalidades/page.tsx   Server Component: requireUser(N) e metadata
app/mensalidades/Tela.tsx   "use client" + dynamic(() => import("@/app/_telas/..."), { ssr: false })
```

A tela roda **só no navegador**, como no CRA: pode usar `window`,
`localStorage` e libs DOM-only sem quebrar o servidor nem dar erro de
hydration. A permissão continua conferida no servidor pelo `page.tsx`.

Rotas assim: `/licencas`, `/Onu` (+ `/AutorizarOnu`, `/DesautorizarOnu`,
`/Settings`), `/ServerLogs`, `/LogViewer`, `/TimeTracking/ClockIn` (+ `/Admin`,
`/Map`, `/Report`), `/NFSE`, `/BuscarNfseGerada`,
`/GerarNotaDeServicoIndependente`, `/Nfcom`, `/Nfcom/Buscar`, `/Create`, `/feedbackCreate`, `/feedback/:technician/:id`,
`/arquivos`, `/servicos/links`, `/s/:token`, `/NFSE/ServicosAdicionais`,
`/Nfcom/DeclaracaoQuitacao`, `/Nfcom/DeclaracoesQuitacao`, `/Prefeitura/Login`,
`/Prefeitura/CodeOtp`, `/ClientAnalytics` (+ `/Logs`, `/Servidores`,
`/SemQueue`, `/Consumo`, `/Monitor/:id`), `/DDDOS`, `/ClientLogsSearch`,
`/mensalidades` (+ `/relatorio`, `/:login`), `/calculadora-debitos`,
`/auditoria`, `/codef`, `/tv-wip`, `/solicitacoes-servico`, `/phone-location`,
`/chamados/ficha-tecnica` (+ `/nova`), `/grafico-instalacoes`,
`/TokenAutoAtendimento` (+ `/pagar-fatura`, `/criar-chamado`,
`/fazer-cadastro`), `/doc/:fileName`, `/SerContratos`, `/Streaming`,
`/Cameras/Admin`, `/Cameras/Setup/:uuid`, `/WatchTv/Conta/:token`,
`/ZapSignConfig`, `/zapsign-config`, `/zapsign-teste`, `/whatsapp-teste`.

`/zapsign-teste` e `/whatsapp-teste` dão 404 fora de `localhost`, como no app
antigo (o `page.tsx` confere o header `host`).

O que mudou na cópia:

| App antigo | Em `_telas` |
|------------|-------------|
| `import { NavBar } from ".../navbar/NavBar"` | `import NavBar from "@/components/NavBar"` (sem prop: pega o usuário do `useAuth`) |
| `useAuth` de `.../context/AuthContext` | `useAuth` de `@/lib/AuthContext` |
| `useNotification` de `.../context/NotificationContext` | `@/lib/NotificationContext` |
| `useNavigate`, `useParams`, `useSearchParams`, `useLocation`, `<Navigate>` | mesmos nomes, de `@/lib/navigation` |
| `<Link to>` | `next/link` com `href`; `<Link state>` usa o `Link` de `@/lib/navigation` |
| `import icon from ".../assets/icon.png"` | `const icon = "/assets/icon.png"` (arquivo em `public/assets`) |
| `<Helmet><title>` | `metadata` do `page.tsx` |
| `../../types`, `../../hooks/useIdleTimeout`, `../../components/{LinkContaWatchTv,SignatureModal,CpfVerificationModal,ErrorModal,Message}` | `@/lib/types`, `@/lib/useIdleTimeout`, `@/components/...` |

### 2.3 Infra

- `lib/auth.ts`: `getUser()`, `requireUser(N)`, `getTokenFromCookie()`, tipo `User`
- `lib/AuthContext.tsx`: `useAuth()` no client. O `app/layout.tsx` preenche
  com o `getUser()` do servidor
- `lib/navigation.tsx`: compatibilidade com o react-router (seção 2.2). O
  `state` do `navigate`/`Link` vai para o sessionStorage, preso ao caminho de
  destino, e o `useLocation` da tela lê uma vez
- `lib/api.ts`: `apiFetch<T>(path, opts)` (server-side, com o JWT do cookie)
- `lib/types.ts`: tipos compartilhados
- `lib/NotificationContext.tsx`: `useNotification()` (`showSuccess`,
  `showError`, `addJob`), provider no layout
- `components/NavBar.tsx` + `components/SinoPagamentos.tsx`: cópia da NavBar
  atual do app antigo (menu por seções, busca, sino de pagamentos). A prop
  `user` é opcional
- `middleware.ts`: só confere se o cookie existe; o nível fica no `page.tsx`

## 3. Mudança numa tela

- **Mudou uma tela no app antigo?** Se ela está em `_telas`, copie de novo o
  arquivo e refaça as trocas da tabela 2.2. Se é nativa, porte a mudança à mão.
- **Tela nova** (que nunca existiu no app antigo): faça nativa, no padrão da
  seção 4, com `next/navigation` direto (não use `lib/navigation`).
- **Quer tirar uma tela de `_telas`** (SSR, Server Actions): faça a versão
  nativa na pasta da rota, apague o `Tela.tsx` e o arquivo em `_telas` que
  ficou sem uso.

## 4. Padrão das telas nativas

### 4.1 `page.tsx` (Server Component)

```ts
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import FooClient from "./FooClient";

export const metadata = { title: "Foo — Wip Diversos" };

export default async function FooPage() {
  // mesmo nível do App.tsx antigo
  const user = await requireUser(2);
  if (!user) redirect("/auth/login");

  return <FooClient user={user} />;
}
```

**Rota pública:** sem `requireUser`/`redirect`. **Só logado, qualquer nível**
(`user?.token` no app antigo): `requireUser(0)`.

### 4.2 `<Nome>Client.tsx`

```tsx
"use client";

import NavBar from "@/components/NavBar";
import type { User } from "@/lib/auth";

export default function FooClient({ user }: { user: User }) {
  const token = user.token;
  return (
    <div>
      <NavBar user={user} />
      {/* ... */}
    </div>
  );
}
```

### 4.3 Server Actions

Use para CREATE/UPDATE/DELETE quando der (ver `app/licencas/actions.ts`). Não
use quando há progresso em tempo real, upload grande ou polling: aí `axios`
direto no client (ver `app/Onu/OnuHomeClient.tsx`).

### 4.4 Trocas do react-router (telas nativas)

| React/CRA | Next |
|-----------|------|
| `<Link to="/x">` | `import Link from "next/link"`; `<Link href="/x">` |
| `useNavigate()` + `navigate("/x")` | `useRouter()` + `router.push("/x")` |
| `useLocation()` | `usePathname()` / `useSearchParams()` de `next/navigation` |
| `useParams()` | `params` do `page.tsx` (`await params`) ou `useParams()` de `next/navigation` |
| `navigate("/x", { state })` | search params (`?foo=bar`) |
| `Cookies.set/remove` | `loginAction` / `logoutAction` em `app/auth/login/actions.ts` |

### 4.5 SSR e hydration

Nas telas nativas, **nunca** acesse no render inicial `window`, `document`,
`localStorage`/`sessionStorage` ou `Date.now()`/`Math.random()` que mudem o
markup. Ponha dentro de `useEffect`. Libs que tocam o DOM ao importar
(leaflet, react-webcam, react-signature-canvas) entram com
`dynamic(() => import("./X"), { ssr: false })`.

## 5. Ao terminar

1. Prefixo novo no `middleware.ts` (`PROTECTED_PREFIXES`). Rota pública não
   precisa entrar em lista nenhuma.
2. `npm run build`.
3. Ao trocar entre `dev` e `build`, apague `.next` antes (`rm -rf .next`):
   no Windows os artefatos se misturam.

## 6. Dependências

Já instaladas: `axios`, `@headlessui/react`, `@heroicons/react`, `react-icons`,
`@mui/material`, `@mui/material-nextjs`, `@emotion/*`, `@mui/x-charts`,
`recharts`, `leaflet`, `moment`, `date-fns`, `xlsx`, `qrcode.react`,
`react-webcam`, `react-signature-canvas`, `react-to-print`, `file-saver`,
`js-cookie` (o `TimeTrackingMap` lê o token do cookie, que o `loginAction`
grava sem `httpOnly`), `html2canvas`, `jspdf`, `jszip`.

Ao copiar tela nova, procure também `import("...")` dinâmico: o ZIP da busca
de NFS-e só carrega `jszip`/`jspdf`/`html2canvas` ao clicar.

Não trazer: `react-router-dom`, `react-scripts`, `react-helmet-async`,
`web-vitals`, `@testing-library/*`.

## 7. Regras

- **NUNCA** modifique nada em `../app`.
- Permissões iguais ao `App.tsx` antigo. Na migração, `/Nfcom` e
  `/nfe/comodato` tinham ficado com nível 5 (o certo é 2) e `/Nfcom/Buscar`
  com 5 (o certo é 1, é a tela de quem tem nível 1). Já corrigido.
- Rota que no app antigo não tinha guard, mas cuja API exige nível (ex.:
  `/Pix/findPaid`, `/Pix/:tipo`, `/Pix/Cancelar/Cobranca`,
  `/GerarNotaDeServicoIndependente`): no Next ficou com o nível da API (2).
- Tela com dois níveis (ex.: `/ZapSignConfig` N2 e `/zapsign-config` N5): dois
  `page.tsx`, cada um com seu `requireUser(N)`, mesma tela.
- As páginas de `../app` estão em CRLF. Ao copiar, não misture CRLF e LF no
  mesmo arquivo (um `\r` solto já colou duas linhas numa migração).

### 7.1 Rotas que só diferem em maiúsculas

O Windows não diferencia maiúsculas de minúsculas nos nomes de pasta:
`app/whatsapp` e `app/Whatsapp` são a **mesma pasta**, e a rota sai com a
grafia errada. Ponha uma delas num **route group**, que não entra na URL:

```
app/Whatsapp/page.tsx                          → /Whatsapp
app/(marketing)/whatsapp/broadcast/page.tsx    → /whatsapp/broadcast
```

Pelo mesmo motivo as cópias ficam em `app/_telas/Mensalidades` e a rota em
`app/mensalidades`. Confira no resumo do `npm run build` se a rota saiu com a
grafia certa.

## 8. Próximos passos

- Testar as telas logado, nos dois níveis (2 e 5), contra o backend real.
- Trocar o app React pelo Next no deploy (porta 3001) e desligar o antigo.
- Aos poucos, tornar nativas as telas de `_telas` que ganhem com SSR ou Server
  Actions (seção 3).
