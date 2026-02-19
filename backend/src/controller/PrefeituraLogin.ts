import dotenv from "dotenv";
import { Request, Response } from "express";
import DataSource from "../database/DataSource";
import { PrefeituraUser } from "../entities/PrefeituraUser";
import axios from "axios";
import twilio from "twilio";
import AppDataSource from "../database/DataSource";

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const verifyServiceSid = process.env.TWILIO_SERVICE_SID;

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
    const {
      mac,
      ip,
      username,
      linkLogin,
      linkOrig,
      linkLoginOnly,
      error,
      celular,
    } = req.body;

    console.log("Dados recebidos do Hotspot 2:", {
      mac,
      ip,
      username,
      linkLogin,
      linkOrig,
      error,
      celular,
    });

    const redirectUrl = `${process.env.URL}/Prefeitura/CodeOtp?mac=${mac}&ip=${ip}&username=${username}&link-login=${linkLogin}&link-login-only=${linkLoginOnly}&link-orig=${linkOrig}&error=${error}&celular=${celular}`;

    res.json({ redirectUrl }); // 🔹 Retorna a URL no JSON
  }

  async debug(req: Request, res: Response) {
    console.log(req.body);
    res.json({ success: true });
  }

  async AuthCodeWithoutTwilio(req: Request, res: Response) {
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

  async AuthCode(req: Request, res: Response) {
    const { otp, celular } = req.body;

    if (!celular || !otp) {
      res.status(400).json({ error: "Celular ou código ausente" });
      return;
    }

    const phone = "+55" + celular.replace(/\D/g, "");

    try {
      const check = await client.verify.v2
        .services(String(verifyServiceSid))
        .verificationChecks.create({
          to: phone,
          code: otp,
        });

      console.log("🔍 Verificação Twilio:", check.status);

      if (check.status === "approved") {
        res.status(200).json({ sucesso: "Código verificado com sucesso" });
        return;
      } else {
        res.status(401).json({ error: "Código incorreto ou expirado" });
        return;
      }
    } catch (error: any) {
      console.error("❌ Erro ao verificar código:", error.message || error);
      res.status(500).json({ error: "Erro interno ao verificar código" });
      return;
    }
  }

  async AuthCodeFacilita(req: Request, res: Response) {
    const { otp, celular } = req.body;

    if (!celular || !otp) {
      res.status(400).json({ error: "Celular ou código ausente" });
      return;
    }
    try {
      const prefeituraRepository = AppDataSource.getRepository(PrefeituraUser);
      const prefeituraUUID = await prefeituraRepository.findBy({ uuid: otp });

      if (!prefeituraUUID || prefeituraUUID.length <= 0) {
        res.status(500).json({ error: "Código Invalido" });
      }

      res.status(200).json({ sucesso: "Sucesso" });
    } catch (error: any) {
      console.error("❌ Erro ao verificar código:", error.message || error);
      res.status(500).json({ error: "Erro interno ao verificar código" });
      return;
    }
  }

  async SendOtpWithoutVerify(req: Request, res: Response) {
    let { celular, otp, mac } = req.body;

    if (!celular) {
      res.status(400).json({ error: "Celular ausente" });
    }

    celular = "+55" + celular.replace(/\D/g, "");

    const msg = `${otp} é seu código de verificação`;
    await PrefeituraLogin.SMS(celular, msg);
    res.status(200).json({ sucesso: "Sucesso" });
  }

  async SendOtp(req: Request, res: Response) {
    let { celular, mac } = req.body;

    if (!celular) {
      res.status(400).json({ error: "Número de celular ausente" });
      return;
    }

    const phone = "+55" + celular.replace(/\D/g, "");

    try {
      const envio = await client.verify.v2
        .services(String(verifyServiceSid))
        .verifications.create({
          to: phone,
          channel: "sms",
        });

      console.log(
        `📲 OTP enviado para ${phone} (MAC: ${mac || "não informado"}) — SID: ${
          envio.sid
        }`,
      );

      res.status(200).json({ sucesso: "Código enviado com sucesso" });
      return;
    } catch (error: any) {
      console.error("❌ Erro ao enviar OTP:", error.message || error);
      res.status(500).json({ error: "Erro ao enviar o código de verificação" });
      return;
    }
  }

  async SendOtpFacilitaMovel(req: Request, res: Response) {
    let { celular, otp, mac } = req.body;

    if (!celular) {
      res.status(400).json({ error: "Celular ausente" });
    }

    const response = await axios.post(
      "http://api.facilitamovel.com.br/api/simpleSendJson.ft",
      {
        phone: celular,
        message: `Seu Código de Autenticação para a WipTelecom<br>${otp}`,
      },
      {
        headers: {
          password: process.env.FACILITA_PASS,
          user: process.env.FACILITA_USER,
          hashSeguranca: process.env.FACILITA_HASH,
        },
      },
    );

    console.log(response);

    res.status(200).json({ sucesso: "Sucesso" });
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
