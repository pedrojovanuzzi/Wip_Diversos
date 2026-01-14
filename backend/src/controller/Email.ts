import dotenv from "dotenv";
import nodemailer from "nodemailer";
dotenv.config();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const transporter = nodemailer.createTransport({
  host: "smtp.mailgun.org",
  port: 587, // Porta SMTP para envio de e-mails
  secure: false, // true para 465, false para outras portas como 587
  auth: {
    user: process.env.MAILGUNNER_USER,
    pass: process.env.MAILGUNNER_PASS,
  },
  pool: true, // Ativa o uso de pool de conexões
  maxConnections: 1, // Limita o número de conexões simultâneas
  tls: {
    ciphers: "SSLv3",
  },
});

class Email {
  async sendEmail(
    to: string,
    subject: string,
    text: string,
    attachments?: any[]
  ) {
    try {
      await transporter.sendMail({
        from: process.env.MAILGUNNER_USER,
        to,
        subject,
        text,
        attachments,
      });
      console.log("Email enviado com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar email:", error);
    }
  }
}

export default Email;
