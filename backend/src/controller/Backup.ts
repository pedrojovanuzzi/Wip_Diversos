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
  // obter a data atual no formato YYYY-MM-DD
  const date = new Date().toISOString().slice(0,10);

  // array para armazenar os arquivos gerados (para enviar depois por e-mail)
  const attachments: { filename: string; path: string }[] = [];

  // para cada banco de dados listado
  for (const db of this.databases) {
    // definir o caminho onde o backup será salvo: ./backups/<nome do banco>/<data>
    const backupDir = path.resolve(__dirname, "..", "backups", db.name, date);
    // criar a pasta caso não exista
    fs.mkdirSync(backupDir, {recursive: true});
    // definir o caminho final do arquivo SQL
    const filePath = path.join(backupDir, `${db.name}.sql`);
    // montar o comando mysqldump para gerar o backup
    const dumpCommand = `mysqldump -h ${db.host} -u ${db.user} -p${db.pass} ${db.name} > "${filePath}"`;

    // mostrar no console que o backup está começando
   console.log(`Iniciando Backup do Banco ${db.name}`);
  
    // executar o comando e aguardar ele finalizar
    //Como nas existe await exec precisamos criar uma promisse e aplicar o await nela
    await new Promise<void>((resolve, reject) => {
      exec(dumpCommand, (error, stdout, stderr) => {
        if (error) {
          // se der erro, mostrar no console e rejeitar a promessa
          if(error){
            console.error(error.message);
            return reject(error);
          }
          //Retorna o throw error para o usuario
          return reject(error);
        }
        // se der certo, mostrar no console e adicionar o anexo ao array
        console.log(`Backup de ${db.name} salvo em ${filePath}`);
        attachments.push({filename: `${db.name}.sql`, path: filePath});
        resolve();
      });
    });
  }

  // (depois você pode usar o array `attachments` para enviar os backups por e-mail)
  await this.enviarEmailBackup(attachments, date);
}

private async enviarEmailBackup(
  attachments: { filename: string; path: string }[],
  date: string
) {
  // Criar o transporter com os dados do servidor SMTP
  const transporter = nodemailer.createTransport({
    host: "smpt.mailgun.org",
    port: 587,
    secure: false,
    auth:{
      user: process.env.MAILGUNNER_USER,
      pass: process.env.MAILGUNNER_PASS,
    }
  });

  // Montar os dados do e-mail (remetente, destinatário, título, corpo e anexos)
  const mailOptions = {
    from: `"Backup Servidor" <${process.env.MAILGUNNER_USER}>`,
    to: "suporte_wiptelecom@outlook.com",
    subject: `📦 Backups - ${date}`,
    html: `<p>Segue em anexo os backups do dia <strong>${date}</strong>.</p>`,
    attachments,
  };

  try {
    // Enviar o e-mail com os backups
    await transporter.sendMail(mailOptions);
    console.log("📧 Email com backups enviado com sucesso!");
  } catch (err) {
    // Se der erro, mostrar no console
    console.error("❌ Erro ao enviar email de backup:", err);
  }
}

}

export default new Backup();
