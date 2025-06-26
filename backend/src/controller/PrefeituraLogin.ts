import dotenv from "dotenv";
import { Request, Response } from "express";
import DataSource from "../database/DataSource";
import { PrefeituraUser } from "../entities/PrefeituraUser";
import axios from "axios";
import twilio from "twilio";

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const verifyServiceSid  = process.env.TWILIO_SERVICE_SID;


const client = twilio(accountSid, authToken);

const homologacao = process.env.SERVIDOR_HOMOLOGACAO === "true";
const url = `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;
const urlMedia = `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/media`;
const token = process.env.CLOUD_API_ACCESS_TOKEN;

class PrefeituraLogin {
  async login(req: Request, res: Response) {
    let { name, celular, cpf, ip, mac, uuid } = req.body;

    if (homologacao) {
      ip = "localhost";
      mac = "00:00:00:00:00:00";
    }

    const prefUserRepository = DataSource.getRepository(PrefeituraUser);

    const newLogin = prefUserRepository.create({
      name,
      celular,
      cpf,
      ip,
      mac,
      uuid,
    });

    if (cpf) {
      if (!PrefeituraLogin.validarCPF(cpf)) {
        res.status(400).json({ error: "CPF Inválido" });
        return;
      }

      if (!PrefeituraLogin.validarNumeroCelular(celular)) {
        res.status(400).json({ error: "Número de Celular Inválido" });
        return;
      }

      prefUserRepository
        .save(newLogin)
        .then(() => {
          res.status(201).json({ sucesso: "Sucesso Pode Fechar a Página" });
          return;
        })
        .catch((err) => {
          res.status(400).json({ error: err.message });
          return;
        });
    } else {
      res.status(400).json({ error: "CPF Não inserido" });
      return;
    }
  }

  async redirect(req: Request, res: Response) {
    const {
      mac,
      ip,
      username,
      "link-login": linkLogin,
      "link-login-only": linkLoginOnly,
      "link-orig": linkOrig,
      error,
    } = req.body;

    console.log("🔹 Dados recebidos do Hotspot:", {
      mac,
      ip,
      username,
      linkLogin,
      linkLoginOnly,
      linkOrig,
      error,
    });

    const redirectUrl = `${process.env.URL}/Prefeitura/Login?mac=${mac}&ip=${ip}&username=${username}&link-login=${linkLogin}&link-login-only=${linkLoginOnly}&link-orig=${linkOrig}&error=${error}`;

    res.redirect(redirectUrl);
  }

  async redirect_2(req: Request, res: Response) {
    const { mac, ip, username, linkLogin, linkOrig, linkLoginOnly, error } =
      req.body;

    console.log("Dados recebidos do Hotspot 2:", {
      mac,
      ip,
      username,
      linkLogin,
      linkOrig,
      error,
    });

    const redirectUrl = `${process.env.URL}/Prefeitura/CodeOtp?mac=${mac}&ip=${ip}&username=${username}&link-login=${linkLogin}&link-login-only=${linkLoginOnly}&link-orig=${linkOrig}&error=${error}`;

    res.json({ redirectUrl }); // 🔹 Retorna a URL no JSON
  }

  async debug(req: Request, res: Response) {
    console.log(req.body);
    res.json({ success: true });
  }

  async AuthCode(req: Request, res: Response) {
    const { uuid } = req.body;
    const prefUserRepository = DataSource.getRepository(PrefeituraUser);
    const user = await prefUserRepository.findOne({ where: { uuid } });
    if (user) {
      res.status(200).json({ sucesso: "Sucesso" });
      return;
    } else {
      res.status(400).json({ error: "Código de Verificação Inválido" });
      return;
    }
  }

async SendOtp(req: Request, res: Response) {
    const { celular, otp } = req.body;

    if (!celular) {
      return res.status(400).json({ error: "Celular ausente" });
    }

    const phone = "+55" + celular.replace(/\D/g, "");

    try {
      if (!otp) {
        // 🔹 Modo envio
        const envio = await client.verify.v2.services(String(verifyServiceSid))
          .verifications
          .create({ to: phone, channel: "sms" });

        console.log("✅ OTP enviado:", envio.sid);
        res.status(200).json({ sucesso: "Código enviado com sucesso" });
      } else {
        // 🔐 Modo verificação
        const check = await client.verify.v2.services(String(verifyServiceSid))
          .verificationChecks
          .create({ to: phone, code: otp });

        console.log("🔍 Verificação:", check);

        if (check.status === "approved") {
          res.status(200).json({ sucesso: "Código verificado com sucesso" });
        } else {
          res.status(401).json({ error: "Código incorreto ou expirado" });
        }
      }
    } catch (error: any) {
      console.error("❌ Erro:", error.message || error);
      return res.status(500).json({ error: "Erro ao processar solicitação" });
    }
  }


  static validarCPF(cpf: string): boolean {
    cpf = cpf.replace(/\D/g, ""); // Remove caracteres não numéricos

    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false; // Verifica se tem 11 dígitos e se não é repetido

    let soma = 0,
      resto;

    // Calcula o primeiro dígito verificador
    for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;

    soma = 0;
    // Calcula o segundo dígito verificador
    for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[10])) return false;

    return true;
  }

  static validarNumeroCelular(numero: string): boolean {
    const regexCelular = /^(\+55\s?)?\(?\d{2}\)?\s?(9\d{4})-?(\d{4})$/;
    return regexCelular.test(numero);
  }

  static async SMS(celular: string, msg: string) {
    try {
      const response = await client.messages.create({
        body: msg,
        from: twilioPhoneNumber,
        to: celular, // Número do destinatário com código do país, ex: "+5511987654321"
      });

      console.log("✅ SMS enviado com sucesso:", response.sid);
    } catch (error) {
      console.error("❌ Erro ao enviar SMS:", error);
    }
  }
}

export default new PrefeituraLogin();
