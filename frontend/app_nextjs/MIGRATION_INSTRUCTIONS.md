# Migração React → Next.js

O app React (CRA) em [`../app`](../app) foi migrado para Next.js 15 (App
Router) neste diretório, `frontend/app_nextjs`. **As 79 rotas do `App.tsx`
antigo existem aqui, com a mesma URL e o mesmo nível de permissão, todas
escritas do jeito do Next** (sem cópias do React e sem camada de
compatibilidade com o react-router). O curinga `*` virou `app/not-found.tsx`,
que manda para a Home.

O app React continua no ar até o Next ser validado. Não mexa em `../app`.

---

## 1. Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind v3**
- **React 19** com Server Components
- **npm** (não usar pnpm/yarn/bun)
- Porta dev/start: **3001**
- Variáveis de ambiente: as **mesmas do app antigo** (`REACT_APP_URL`,
  `REACT_APP_BASE_URL`, etc.), expostas aos Client Components pelo `next.config.js`
- `next.config.js` fixa `process.env.TZ = "America/Sao_Paulo"`: o servidor monta
  a primeira versão das telas, e datas formatadas com `moment`/`toLocaleString`
  precisam sair iguais às do navegador
- MUI (`@mui/material` 6) com `AppRouterCacheProvider` no `app/layout.tsx`

## 2. Como cada tela é feita

Cada rota tem:

```
app/<rota>/page.tsx            Server Component: confere a permissão e busca no
                               servidor o que a tela mostra ao abrir
app/<rota>/<Nome>Client.tsx    Client Component ("use client"): recebe os dados
                               e o `user` por props e cuida da interação
```

Telas que dividem componentes guardam tudo numa pasta privada da rota
(`_componentes/`, o `_` impede o Next de criar rota): `app/mensalidades/_componentes`,
`app/NFSE/_componentes`, `app/Nfcom/_componentes`, `app/ClientAnalytics/_componentes`,
`app/Onu/_componentes`, `app/tv-wip/_componentes`, `app/licencas/_componentes`,
`app/ServerLogs/_componentes`, `app/TokenAutoAtendimento/_componentes`, etc.

### 2.1 Regras do padrão

- **Primeira carga no servidor.** O `page.tsx` faz com `apiFetch` (de
  `lib/api.ts`, que põe o token do cookie) a mesma busca que a tela do React
  fazia ao abrir, e passa o resultado por props. O Client começa o `useState`
  com esse valor e não busca de novo ao montar (veja o `primeiraCarga` com
  `useRef` nas telas que rebuscam quando um filtro muda).
- **Ações continuam no navegador.** Salvar, excluir, enviar e recarregar depois
  de uma ação seguem com `axios` no Client, como no React.
- **Filtros na URL quando a tela já era guiada por ela.** Auditoria,
  Mensalidades, relatório de mensalidades, feedback (período/técnico): mudar o
  filtro faz `router.push`/`router.replace`, e o `page.tsx` busca de novo.
  F5 e o botão voltar mantêm o filtro.
- **O que ficou no navegador de propósito:**
  - consultas lentas aos roteadores (lista do ClientAnalytics, Sem Queue,
    Consumo): no servidor a página ficaria em branco até 60–120 s;
  - o log do ClientAnalytics (~1 MB) e o arquivo aberto no LogViewer: por
    props iriam duas vezes na página (HTML + dados);
  - mapas (Leaflet) e "há X minutos": `dynamic(..., { ssr: false })` num
    Client pequeno (`TimeTracking/Map/MapClient.tsx`, `phone-location/PhoneLocationClient.tsx`);
  - câmera e assinatura (`react-webcam`, `react-signature-canvas`): também com
    `dynamic(..., { ssr: false })`.
- **Nada de `state` do react-router.** O que ia no `state` virou URL:
  `/ClientAnalytics?pppoe=...` (vindo do Sem Queue),
  `/LogViewer?arquivo=...&pasta=...`, `/ServerLogs?pasta=...`,
  `/TokenAutoAtendimento?ocioso=true|false` (totem).
- **Telas públicas com token no link** (`/s/:token`, `/Cameras/Setup/:uuid`,
  `/WatchTv/Conta/:token`, `/feedback/:technician/:id`): o `page.tsx` confere o
  link no servidor com `apiFetch(..., { noAuth: true })` antes de abrir.
- **Hora.** Valores que dependem do relógio (mês/ano iniciais, "agora" do
  ponto, data de hoje) são calculados no `page.tsx` e passados por props, ou
  vêm de `lib/hora.ts` (`agoraLocal()`, `hojeLocal()`).
- **`window`, `localStorage`, `document`** só dentro de `useEffect` ou de
  handlers.

### 2.2 Cuidado: tudo que vai por props aparece no HTML

O que o `page.tsx` passa para um Client Component fica dentro da página. A
lista de funcionários, para nível 5, traz o **CPF** (a "senha" do ponto): nas
telas públicas ou de nível baixo (`/TimeTracking/ClockIn`, `/feedbackCreate`)
ela é buscada com `noAuth: true` e reduzida a id e nome. Nas telas de nível 5
que já mostram o CPF (gestão e relatório de ponto) ela vai inteira.

### 2.3 Infra

- `lib/auth.ts`: `getUser()`, `requireUser(N)`, `getTokenFromCookie()`, tipo `User`
- `lib/api.ts`: `apiFetch<T>(path, opts)` só no servidor; `noAuth: true` não manda o token
- `lib/hora.ts`: `agoraLocal()` e `hojeLocal()` no fuso de Brasília
- `lib/types.ts`: tipos compartilhados
- `lib/NotificationContext.tsx`: `useNotification()`, provider no layout
- `lib/useIdleTimeout.ts`: inatividade do totem
- `components/NavBar.tsx` + `components/SinoPagamentos.tsx`: menu atual do app
  antigo (seções, busca, sino). Recebe `user` por prop
- `middleware.ts`: só confere se o cookie existe; o nível fica no `page.tsx`
- `public/`: os mesmos arquivos do `public/` do React (PDFs de `/doc`, imagens
  do totem, favicon, manifest, arquivos do app de câmeras)

## 3. Enquanto o React continuar recebendo mudanças

`scripts/origem-telas.json` registra, para cada tela, os arquivos do React de
onde ela saiu e o último commit deles naquele momento. Rode:

```bash
node scripts/checar-origem.mjs
```

Ele lista as telas cujo arquivo de origem mudou depois (commits novos ou
alterações não commitadas). Refaça a mudança na tela do Next e atualize o
`commit` no JSON.

## 3.1 Testes automáticos das páginas

```bash
npm run test:paginas
```

Abre todas as páginas num Chrome de verdade contra um backend de mentira
(`testes/mock`) e reprova página que quebra, dá erro de hydration, manda para
o login sem motivo ou chama rota da API que o mock não conhece. Também testa a
portaria. Detalhes em [testes/LEIAME.md](testes/LEIAME.md). Rode depois de
qualquer mudança em tela, e ao criar uma (acrescente a rota em `testes/rotas.ts`).

Um cuidado que o teste pegou e o `npm run build` não pega: o `page.tsx` não
pode **executar** nada importado de um arquivo `"use client"` (função ou
constante). Componentes e tipos podem; o resto vai num arquivo comum (ex.:
`app/ServerLogs/_componentes/raiz.ts`).

## 4. Tela nova

```ts
// app/foo/page.tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import FooClient, { type Item } from "./FooClient";

export const metadata = { title: "Foo — Wip Diversos" };

export default async function FooPage() {
  const user = await requireUser(2);          // nível mínimo
  if (!user) redirect("/auth/login");

  const itens = await apiFetch<Item[]>("/foo").catch(() => [] as Item[]);
  return <FooClient user={user} itens={itens} />;
}
```

```tsx
// app/foo/FooClient.tsx
"use client";

import { useState } from "react";
import NavBar from "@/components/NavBar";
import type { User } from "@/lib/auth";

export interface Item { id: number; nome: string }

export default function FooClient({ user, itens }: { user: User; itens: Item[] }) {
  const [lista, setLista] = useState(itens);
  return (
    <div>
      <NavBar user={user} />
      {/* ... */}
    </div>
  );
}
```

- **Rota pública:** sem `requireUser`/`redirect`.
- **Só logado, qualquer nível:** `requireUser(0)`.
- **Navegação:** `useRouter`, `usePathname`, `useSearchParams` de `next/navigation`;
  `<Link href>` de `next/link`.
- **Login/logout:** `loginAction` / `logoutAction` em `app/auth/login/actions.ts`.
- **Exportar algo de um `page.tsx`** além do componente e do `metadata` quebra o
  build: helpers vão num arquivo à parte (ex.: `app/ZapSignConfig/templates.ts`).

## 5. Ao terminar

1. Prefixo novo no `middleware.ts` (`PROTECTED_PREFIXES`). Rota pública não
   precisa entrar em lista nenhuma.
2. Registre a tela em `scripts/origem-telas.json` se ela veio do React.
3. `npm run build`.
4. Ao trocar entre `dev` e `build`, apague `.next` antes (`rm -rf .next`).

## 6. Dependências

Instaladas: `axios`, `@headlessui/react`, `@heroicons/react`, `react-icons`,
`@mui/material`, `@mui/material-nextjs`, `@emotion/*`, `@mui/x-charts`,
`recharts`, `leaflet`, `moment`, `date-fns`, `xlsx`, `qrcode.react`,
`react-webcam`, `react-signature-canvas`, `react-to-print`, `file-saver`,
`js-cookie`, `html2canvas`, `jspdf`, `jszip`.

Ao trazer uma tela, procure também `import("...")` dinâmico (o ZIP da busca de
NFS-e só carrega `jszip`/`jspdf`/`html2canvas` ao clicar).

Não trazer: `react-router-dom`, `react-scripts`, `react-helmet-async`,
`web-vitals`, `@testing-library/*`.

## 7. Regras

- **NUNCA** modifique nada em `../app`.
- Permissões iguais ao `App.tsx` antigo. Exceção: rota sem guard no React cuja
  API exige nível (ex.: `/Pix/findPaid`, `/Pix/:tipo`, `/Pix/Cancelar/Cobranca`,
  `/GerarNotaDeServicoIndependente`) ficou com o nível da API (2).
- Tela com dois níveis (`/ZapSignConfig` N2 e `/zapsign-config` N5): dois
  `page.tsx`, mesmo Client.
- As páginas de `../app` estão em CRLF. Não misture CRLF e LF no mesmo arquivo.

### 7.1 Rotas que só diferem em maiúsculas

O Windows não diferencia maiúsculas de minúsculas nos nomes de pasta:
`app/whatsapp` e `app/Whatsapp` são a **mesma pasta**. Ponha uma delas num
**route group**, que não entra na URL:

```
app/Whatsapp/page.tsx                          → /Whatsapp
app/(marketing)/whatsapp/broadcast/page.tsx    → /whatsapp/broadcast
```

Confira no resumo do `npm run build` se a rota saiu com a grafia certa.

## 8. Próximos passos

- Testar as telas logado, nos níveis 1, 2 e 5, contra o backend real
  (principalmente as ações: emitir nota, gerar cobrança, salvar).
- Trocar o app React pelo Next no deploy (porta 3001) e desligar o antigo.
- Server Actions no lugar do `axios` nas ações, aos poucos, onde valer a pena.
