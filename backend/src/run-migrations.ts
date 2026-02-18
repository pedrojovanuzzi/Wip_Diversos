import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// npm run migration:run

async function runMigrations() {
  try {
    console.log("🚀 Executando migrations...");

    const { stdout, stderr } = await execAsync(
      "npx ts-node ./node_modules/typeorm/cli.js migration:run -d src/database/DataSource.ts",
      // npx ts-node ./node_modules/typeorm/cli.js migration:create .\src\migration\CPF_CPNJType
    );

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log("✅ Migrations executadas com sucesso!");
  } catch (error: any) {
    console.error("❌ Erro ao executar migrations:", error.message);
    process.exit(1);
  }
}

runMigrations();
