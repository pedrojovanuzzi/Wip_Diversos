import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

interface DatabaseConfig {
  name: string;
  host: string;
  user: string;
  pass: string;
}

class Backup {
  private databases: DatabaseConfig[] = [
    {
      name: process.env.DATABASE!,
      host: process.env.DATABASE_HOST!,
      user: process.env.DATABASE_USERNAME!,
      pass: process.env.DATABASE_PASSWORD!,
    },
    {
      name: process.env.DATABASE_API_MK!,
      host: process.env.DATABASE_HOST_API_MK!,
      user: process.env.DATABASE_USERNAME_API_MK!,
      pass: process.env.DATABASE_PASSWORD_API_MK!,
    },
    {
      name: process.env.DATABASE_PAINEL!,
      host: process.env.DATABASE_HOST_PAINEL!,
      user: process.env.DATABASE_USERNAME_PAINEL!,
      pass: process.env.DATABASE_PASSWORD_PAINEL!,
    },
    {
      name: process.env.DATABASE_TVWIP!,
      host: process.env.DATABASE_HOST_TVWIP!,
      user: process.env.DATABASE_USERNAME_TVWIP!,
      pass: process.env.DATABASE_PASSWORD_TVWIP!,
    },
  ];

  public async gerarTodos() {
    const date = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

    for (const db of this.databases) {
      const backupDir = path.join("..", "backups", db.name, date);
      fs.mkdirSync(backupDir, { recursive: true });

      const filePath = path.join(backupDir, `${db.name}.sql`);

      const dumpCommand = `mysqldump -h ${db.host} -u ${db.user} -p${db.pass} ${db.name} > "${filePath}"`;

      console.log(`📦 Iniciando backup do banco "${db.name}"`);

      await new Promise<void>((resolve, reject) => {
        exec(dumpCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ Erro no backup do banco ${db.name}:`, error.message);
            return reject(error);
          }
          console.log(`✅ Backup de "${db.name}" salvo em ${filePath}`);
          resolve();
        });
      });
    }

    console.log("🎉 Todos os backups foram concluídos.");
  }
}

export default new Backup();
