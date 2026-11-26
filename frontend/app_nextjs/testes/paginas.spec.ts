/**
 * Abre cada página num Chrome de verdade, contra o backend de mentira
 * (testes/mock), e confere que ela funciona:
 *
 *  - não foi mandada para o login (o nível mínimo da rota basta);
 *  - nenhum erro de JavaScript na página (pageerror);
 *  - nenhum erro de hydration / erro do React no console;
 *  - nada de "Application error" na tela;
 *  - toda rota da API que a página chamou tem resposta no mock.
 *
 * E a portaria: sem login ou com nível baixo, a página manda para o login.
 */
import { test, expect, type Page } from "@playwright/test";
import { ROTAS, BARRADAS, type Nivel } from "./rotas";

const MOCK = "http://localhost:4010";

const TOKEN: Record<Exclude<Nivel, "pub">, string> = {
  0: "teste-n1",
  1: "teste-n1",
  2: "teste-n2",
  5: "teste-n5",
};

// Erros do console que indicam tela quebrada (o resto, como "Failed to load
// resource" de imagem, não reprova).
const ERRO_GRAVE = /hydrat|did not match|Minified React error|Uncaught|is not a function|Cannot read propert|undefined is not/i;

async function entrarCom(page: Page, token: string | null) {
  await page.context().clearCookies();
  if (!token) return;
  // Igual ao app: o cookie "user" guarda JSON.stringify(token).
  await page.context().addCookies([
    { name: "user", value: encodeURIComponent(JSON.stringify(token)), url: "http://localhost:3060" },
  ]);
}

async function rotasSemMock(): Promise<string[]> {
  const r = await fetch(`${MOCK}/__mock/sem-resposta`);
  return ((await r.json()) as { rota: string }[]).map((x) => x.rota);
}

test.describe("páginas abrem sem erro", () => {
  for (const [rota, nivel] of ROTAS) {
    test(`${rota} (${nivel === "pub" ? "público" : `nível ${nivel}`})`, async ({ page }) => {
      await fetch(`${MOCK}/__mock/limpar`, { method: "POST" });
      await entrarCom(page, nivel === "pub" ? null : TOKEN[nivel]);

      const errosJs: string[] = [];
      const errosConsole: string[] = [];
      page.on("pageerror", (e) => errosJs.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error" && ERRO_GRAVE.test(m.text())) errosConsole.push(m.text());
      });

      const resposta = await page.goto(rota, { waitUntil: "load" });
      // Dá tempo para os useEffect e as buscas do navegador.
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

      expect(resposta?.status(), "status HTTP").toBeLessThan(400);

      const caminhoFinal = new URL(page.url()).pathname;
      expect(caminhoFinal, "foi mandado para outra página (login?)").toBe(rota.split("?")[0]);

      const texto = await page.locator("body").innerText();
      expect(texto, "tela de erro do Next").not.toMatch(/Application error|client-side exception/i);

      expect(errosJs, "erros de JavaScript").toEqual([]);
      expect(errosConsole, "erros do React no console").toEqual([]);
      expect(await rotasSemMock(), "rotas da API sem resposta no mock, ou pedidos inválidos (testes/mock/respostas.mjs)").toEqual([]);
    });
  }
});

test.describe("portaria", () => {
  for (const [rota, token] of BARRADAS) {
    test(`${rota} barra ${token ?? "quem não está logado"}`, async ({ page }) => {
      await entrarCom(page, token);
      await page.goto(rota);
      // Sem login cai no /auth/login; logado sem o nível, o login devolve
      // para a Home (quem já tem cookie não fica na tela de login).
      expect(["/auth/login", "/"]).toContain(new URL(page.url()).pathname);
    });
  }
});
