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
    attachments?: any[],
    /** Versão HTML; o `text` vai junto para quem não lê HTML. */
    html?: string,
  ) {
    try {
      const info = await transporter.sendMail({
        from: process.env.MAILGUNNER_USER,
        to,
        subject,
        text,
        ...(html ? { html } : {}),
        attachments,
        // Sem rastreamento de cliques do Mailgun: ele troca cada link por um
        // do domínio email.noreply... (que não tem DNS, então o link quebra) e
        // ainda reescreve o pedaço "qrcodespix.sejaefi.com/..." do meio do
        // Pix copia e cola, inutilizando o código.
        headers: { "X-Mailgun-Track-Clicks": "no" },
      });

      // O Mailgun pode aceitar a conexão mas rejeitar o destinatário.
      // Sem checar o `rejected`, o envio parece ter dado certo e nunca chega.
      if (info.rejected?.length) {
        throw new Error(
          `Destinatário rejeitado pelo servidor SMTP: ${info.rejected.join(", ")}`,
        );
      }

      console.log(`Email enviado com sucesso para ${to} (${info.messageId})`);
      return info;
    } catch (error) {
      console.error("Erro ao enviar email:", error);
      throw error;
    }
  }
}

export default Email;
