import { defineConfig } from "@playwright/test";

/**
 * Testes das páginas (npm run test:paginas). Sobe o backend de mentira na
 * porta 4010 e o Next (build de teste em .next-teste) na 3060.
 */
export default defineConfig({
  testDir: "./testes",
  testMatch: /.*\.spec\.ts$/,
  // Um teste por vez: o mock guarda a lista de rotas sem resposta da página atual.
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "testes/relatorio", open: "never" }]],
  use: {
    baseURL: "http://localhost:3060",
    // Usa o Google Chrome instalado: não precisa baixar navegador.
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: "testes/resultados",
  webServer: [
    {
      command: "node testes/mock/servidor.mjs",
      url: "http://localhost:4010/__mock/sem-resposta",
      reuseExistingServer: false,
    },
    {
      command: "npx next start -p 3060",
      url: "http://localhost:3060/auth/login",
      reuseExistingServer: false,
      env: { NEXT_DIST_DIR: ".next-teste", REACT_APP_URL: "http://localhost:4010/api" },
      timeout: 120_000,
    },
  ],
});
