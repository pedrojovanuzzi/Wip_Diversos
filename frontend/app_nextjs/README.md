# Wip Diversos — Next.js (em migração)

App **Next.js 15 + App Router + TypeScript + Tailwind v3** rodando em paralelo
ao app React/CRA original em [`../app`](../app). A migração é incremental — o
app antigo continua sendo a fonte de verdade até cada rota ser portada e
validada aqui.

## Setup

```bash
cd frontend/app_nextjs
cp .env.example .env.local   # ajustar API_URL e NEXT_PUBLIC_API_URL
npm install
npm run dev                  # http://localhost:3000
```

## Compatibilidade com o app antigo

- **Cookie de sessão**: usa o mesmo nome (`user`) e mesmo formato
  (`JSON.stringify(token)`) que o app React + `js-cookie`. Os dois apps
  compartilham login enquanto a migração ocorrer.
- **Backend**: nenhuma mudança esperada. O Server Action de login chama
  `POST /auth/login` e a validação chama `POST /auth/validate` exatamente como
  o app antigo.
- **Variáveis de ambiente**: mantemos as mesmas do app antigo (`REACT_APP_*`),
  expostas a Client Components via `next.config.js > env`. Assim os dois apps
  podem compartilhar o `.env` durante a migração.

## Padrão de migração (referência pra portar mais páginas)

1. **Página pública sem dados**: criar `app/<rota>/page.tsx` como Server
   Component. Conteúdo interativo em arquivo irmão `*Client.tsx` com
   `"use client"`.
2. **Página privada com SSR**:
   ```ts
   const user = await requireUser(N);
   if (!user) redirect("/auth/login");
   const data = await apiFetch("/rota/do/backend");
   ```
   Passar `data` pro componente cliente como prop.
3. **Mutações**: criar `actions.ts` com `"use server"` no topo. Cada ação chama
   `apiFetch` (já injeta o JWT do cookie) e termina com `revalidatePath(...)`.
   No client, disparar com `useTransition` + `router.refresh()`.
4. **Adicionar a rota** em `middleware.ts` (`PROTECTED_PREFIXES` ou
   `PUBLIC_EXACT`) para o guard funcionar.
5. **Bibliotecas DOM-only** (`leaflet`, `react-webcam`, `chart.js`,
   `react-signature-canvas`, etc.): usar `next/dynamic` com `{ ssr: false }`.

## Já migrado nesta 1ª leva

| Rota                | Tipo                         |
|---------------------|------------------------------|
| `/auth/login`       | Server Action + form client  |
| `/`                 | SSR (HomePage com user)      |
| `/licencas`         | SSR fetch + Server Actions   |
| `/feedback/Opnion`  | SSR público                  |

## Pendente (próximas levas)

Tudo o resto do `../app/src/pages/`. Ver `App.tsx` do app antigo para a lista
completa de rotas.
