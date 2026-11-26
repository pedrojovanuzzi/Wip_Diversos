#!/usr/bin/env node
// Avisa quais telas reescritas no Next ficaram para trás do app React.
//
// Para cada tela de scripts/origem-telas.json, procura commits nos arquivos de
// origem (frontend/app/src/...) depois do commit registrado, e também mudanças
// ainda não commitadas. Se achar, a mudança precisa ser refeita na tela do Next
// e o "commit" do registro atualizado.
//
// uso (de frontend/app_nextjs):  node scripts/checar-origem.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: aqui, encoding: "utf8" }).trim();
const { telas } = JSON.parse(readFileSync(path.join(aqui, "origem-telas.json"), "utf8"));

const git = (...args) => execFileSync("git", args, { cwd: raiz, encoding: "utf8" }).trim();

let atrasadas = 0;
for (const [rota, t] of Object.entries(telas)) {
  const arquivos = t.origem.map((f) => `frontend/app/src/${f}`);
  const commits = git("log", "--format=%h %cs %s", `${t.commit}..HEAD`, "--", ...arquivos);
  const pendentes = git("status", "--porcelain", "--", ...arquivos);
  if (!commits && !pendentes) continue;

  atrasadas++;
  console.log(`\n✗ ${rota}  (reescrita a partir de ${t.commit})`);
  if (commits) console.log(commits.split("\n").map((l) => `    ${l}`).join("\n"));
  if (pendentes) console.log(`    + mudanças não commitadas:\n${pendentes.split("\n").map((l) => `      ${l}`).join("\n")}`);
}

const total = Object.keys(telas).length;
console.log(
  atrasadas
    ? `\n${atrasadas} de ${total} telas reescritas têm mudanças no React que faltam no Next.`
    : `Todas as ${total} telas reescritas estão em dia com o React.`,
);
process.exitCode = atrasadas ? 1 : 0;
