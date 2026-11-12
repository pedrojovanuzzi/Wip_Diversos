import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.mailgun.org",
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAILGUNNER_USER,
    pass: process.env.MAILGUNNER_PASS,
  },
  pool: true,
  maxConnections: 1,
  tls: {
    ciphers: "SSLv3",
  },
});

export function sendServiceEmail(msg: any) {
  const options = {
    from: process.env.MAILGUNNER_USER,
    to: process.env.EMAIL_FINANCEIRO,
    subject: `🛠️ Serviço Solicitado 🛠️`,
    html: msg,
    // Sem rastreamento de cliques do Mailgun (o domínio dele não tem DNS e
    // os links quebram). Ver controller/Email.ts.
    headers: { "X-Mailgun-Track-Clicks": "no" },
  };
  transporter.sendMail(options);
}
