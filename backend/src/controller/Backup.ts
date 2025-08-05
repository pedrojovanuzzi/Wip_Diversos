import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import nodemailer from 'nodemailer';

dotenv.config();

interface DatabaseConfig {
  name: string;
  host: string;
  user: string;
  pass: string;
}

const transporter = nodemailer.createTransport({
    host: 'smtp.mailgun.org',
    port: 587, // Porta SMTP para envio de e-mails
    secure: false, // true para 465, false para outras portas como 587
    auth: {
        user: process.env.MAILGUNNER_USER,
        pass: process.env.MAILGUNNER_PASS, 
    },
    pool: true, // Ativa o uso de pool de conexões
    maxConnections: 1, // Limita o número de conexões simultâneas
    tls: {
        ciphers: 'SSLv3'
    }
});

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
  const date = new Date().toISOString().slice(0, 10);
  const attachments: { filename: string; path: string }[] = [];

  for (const db of this.databases) {
    const backupDir = path.resolve(__dirname, "..", "backups", db.name, date);
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
        attachments.push({ filename: `${db.name}.sql`, path: filePath });
        resolve();
      });
    });
  }

  console.log("🎉 Todos os backups foram concluídos.");

  // Agora envia o email com os anexos
  await this.enviarEmailBackup(attachments, date);
}

private async enviarEmailBackup(
  attachments: { filename: string; path: string }[],
  date: string
) {
  const transporter = nodemailer.createTransport({
    host: "smtp.mailgun.org", // Ou outro SMTP se não estiver usando Mailgun
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAILGUNNER_USER,
      pass: process.env.MAILGUNNER_PASS,
    },
  });

  const mailOptions = {
    from: `"Backup Servidor" <${process.env.MAILGUNNER_USER}>`,
    to: "suporte_wiptelecom@outlook.com",
    subject: `📦 Backups - ${date}`,
    html: `<p>Segue em anexo os backups do dia <strong>${date}</strong>.</p>`,
    attachments,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📧 Email com backups enviado com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao enviar email de backup:", err);
  }
}

}

export default new Backup();
