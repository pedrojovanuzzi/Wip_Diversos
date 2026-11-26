# Testes das páginas

Abre todas as páginas do Next num Google Chrome de verdade, contra um backend
de mentira, e confere que cada uma funciona.

```bash
cd frontend/app_nextjs
npm run test:paginas          # faz o build de teste (~1,5 min) e testa tudo
npm run test:paginas:rapido   # só testa, usando o último build de teste
npx playwright test -g "/NFSE"   # uma página só (pelo nome do teste)
npx playwright show-report testes/relatorio   # relatório com print e trace das falhas
```

Use o `rapido` quando só mudou o mock ou o teste. Mudou código das telas →
`npm run test:paginas` (o build precisa ser refeito).

## O que cada teste confere

Para cada rota de `rotas.ts`, entrando com o **nível mínimo** dela:

- a página abre (status < 400) e não manda para o login;
- nenhum erro de JavaScript, nenhum erro de hydration/React no console;
- nada de "Application error" na tela;
- toda rota da API que a página chamou existe no mock, e o pedido veio no
  formato certo.

E a portaria: sem login, ou logado sem o nível, a página não abre.

## Peças

| Arquivo | Para quê |
|---|---|
| `rotas.ts` | páginas testadas e o nível de cada uma; `BARRADAS` = testes da portaria |
| `mock/respostas.mjs` | o que o backend de mentira responde, rota por rota |
| `mock/servidor.mjs` | o backend de mentira (porta 4010) |
| `paginas.spec.ts` | os testes |
| `preparar.mjs` | build de teste em `.next-teste`, apontando para o mock |
| `../playwright.config.ts` | sobe o mock e o Next (porta 3060) e roda os testes |

Usuários de teste: o cookie `user` leva o token `teste-n1`, `teste-n2` ou
`teste-n5`, e o mock responde o `/auth/validate` com o nível correspondente.

## Quando um teste falha

- **"rotas da API sem resposta no mock"**: a tela passou a chamar uma rota
  nova. Acrescente em `mock/respostas.mjs`, no formato que a API devolve.
- **"pedido inválido"**: a rota existe, mas a tela mandou o corpo errado (a
  resposta no mock é uma função que confere o corpo).
- **status 500 / erro de JavaScript**: a tela quebrou. Se o mock estiver
  incompleto (faltando um campo que a tela lê), complete o mock; senão é bug.
  O relatório (`show-report`) tem o print e o trace da falha.
- **"foi mandado para outra página"**: a tela exige nível maior do que o de
  `rotas.ts` (confira com o `App.tsx` antigo).

## Página nova

1. Acrescente a rota em `rotas.ts` com o nível mínimo.
2. Rode `npm run test:paginas`; o teste diz quais rotas da API faltam no mock.
3. Acrescente essas rotas em `mock/respostas.mjs`, com pelo menos um item de
   exemplo nas listas (assim o teste desenha a lista, não só a tela vazia).
