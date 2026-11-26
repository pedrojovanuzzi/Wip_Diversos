#!/usr/bin/env node
/**
 * Build de teste: o endereço do backend é gravado no código durante o build,
 * então os testes precisam de um build próprio apontando para o mock.
 * Fica em .next-teste e não mexe no .next normal.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

rmSync(".next-teste", { recursive: true, force: true });
const r = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: ".next-teste", REACT_APP_URL: "http://localhost:4010/api" },
});
process.exit(r.status ?? 1);
