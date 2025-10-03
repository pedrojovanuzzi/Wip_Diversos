"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const DataSource_1 = __importDefault(require("../database/DataSource"));
const PrefeituraUser_1 = require("../entities/PrefeituraUser");
const axios_1 = __importDefault(require("axios"));
const twilio_1 = __importDefault(require("twilio"));
const DataSource_2 = __importDefault(require("../database/DataSource"));
dotenv_1.default.config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const verifyServiceSid = process.env.TWILIO_SERVICE_SID;
const client = (0, twilio_1.default)(accountSid, authToken);
const homologacao = process.env.SERVIDOR_HOMOLOGACAO === "true";
const url = `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;
const urlMedia = `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/media`;
const token = process.env.CLOUD_API_ACCESS_TOKEN;
class PrefeituraLogin {
    login(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            let { name, celular, cpf, ip, mac, uuid } = req.body;
            if (homologacao) {
                ip = "localhost";
                mac = "00:00:00:00:00:00";
            }
            const prefUserRepository = DataSource_1.default.getRepository(PrefeituraUser_1.PrefeituraUser);
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
            }
            else {
                res.status(400).json({ error: "CPF Não inserido" });
                return;
            }
        });
    }
    redirect(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { mac, ip, username, "link-login": linkLogin, "link-login-only": linkLoginOnly, "link-orig": linkOrig, error, } = req.body;
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
        });
    }
    redirect_2(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { mac, ip, username, linkLogin, linkOrig, linkLoginOnly, error, celular, } = req.body;
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
        });
    }
    debug(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(req.body);
            res.json({ success: true });
        });
    }
    AuthCodeWithoutTwilio(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { uuid } = req.body;
            const prefUserRepository = DataSource_1.default.getRepository(PrefeituraUser_1.PrefeituraUser);
            const user = yield prefUserRepository.findOne({ where: { uuid } });
            if (user) {
                res.status(200).json({ sucesso: "Sucesso" });
                return;
            }
            else {
                res.status(400).json({ error: "Código de Verificação Inválido" });
                return;
            }
        });
    }
    AuthCode(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { otp, celular } = req.body;
            if (!celular || !otp) {
                res.status(400).json({ error: "Celular ou código ausente" });
                return;
            }
            const phone = "+55" + celular.replace(/\D/g, "");
            try {
                const check = yield client.verify.v2
                    .services(String(verifyServiceSid))
                    .verificationChecks.create({
                    to: phone,
                    code: otp,
                });
                console.log("🔍 Verificação Twilio:", check.status);
                if (check.status === "approved") {
                    res.status(200).json({ sucesso: "Código verificado com sucesso" });
                    return;
                }
                else {
                    res.status(401).json({ error: "Código incorreto ou expirado" });
                    return;
                }
            }
            catch (error) {
                console.error("❌ Erro ao verificar código:", error.message || error);
                res.status(500).json({ error: "Erro interno ao verificar código" });
                return;
            }
        });
    }
    AuthCodeFacilita(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { otp, celular } = req.body;
            if (!celular || !otp) {
                res.status(400).json({ error: "Celular ou código ausente" });
                return;
            }
            try {
                const prefeituraRepository = DataSource_2.default.getRepository(PrefeituraUser_1.PrefeituraUser);
                const prefeituraUUID = yield prefeituraRepository.findBy({ uuid: otp });
                if (!prefeituraUUID || prefeituraUUID.length <= 0) {
                    res.status(500).json({ error: "Código Invalido" });
                }
                res.status(200).json({ sucesso: "Sucesso" });
            }
            catch (error) {
                console.error("❌ Erro ao verificar código:", error.message || error);
                res.status(500).json({ error: "Erro interno ao verificar código" });
                return;
            }
        });
    }
    SendOtpWithoutVerify(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            let { celular, otp, mac } = req.body;
            if (!celular) {
                res.status(400).json({ error: "Celular ausente" });
            }
            celular = "+55" + celular.replace(/\D/g, "");
            const msg = `${otp} é seu código de verificação`;
            yield PrefeituraLogin.SMS(celular, msg);
            res.status(200).json({ sucesso: "Sucesso" });
        });
    }
    SendOtp(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            let { celular, mac } = req.body;
            if (!celular) {
                res.status(400).json({ error: "Número de celular ausente" });
                return;
            }
            const phone = "+55" + celular.replace(/\D/g, "");
            try {
                const envio = yield client.verify.v2
                    .services(String(verifyServiceSid))
                    .verifications.create({
                    to: phone,
                    channel: "sms",
                });
                console.log(`📲 OTP enviado para ${phone} (MAC: ${mac || "não informado"}) — SID: ${envio.sid}`);
                res.status(200).json({ sucesso: "Código enviado com sucesso" });
                return;
            }
            catch (error) {
                console.error("❌ Erro ao enviar OTP:", error.message || error);
                res.status(500).json({ error: "Erro ao enviar o código de verificação" });
                return;
            }
        });
    }
    SendOtpFacilitaMovel(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            let { celular, otp, mac } = req.body;
            if (!celular) {
                res.status(400).json({ error: "Celular ausente" });
            }
            const response = yield axios_1.default.post("http://api.facilitamovel.com.br/api/simpleSendJson.ft", {
                phone: celular,
                message: `Seu Código de Autenticação para a WipTelecom<br>${otp}`,
            }, {
                headers: {
                    password: process.env.FACILITA_PASS,
                    user: process.env.FACILITA_USER,
                    hashSeguranca: process.env.FACILITA_HASH,
                },
            });
            console.log(response);
            res.status(200).json({ sucesso: "Sucesso" });
        });
    }
    static validarCPF(cpf) {
        cpf = cpf.replace(/\D/g, ""); // Remove caracteres não numéricos
        if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf))
            return false; // Verifica se tem 11 dígitos e se não é repetido
        let soma = 0, resto;
        // Calcula o primeiro dígito verificador
        for (let i = 0; i < 9; i++)
            soma += parseInt(cpf[i]) * (10 - i);
        resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11)
            resto = 0;
        if (resto !== parseInt(cpf[9]))
            return false;
        soma = 0;
        // Calcula o segundo dígito verificador
        for (let i = 0; i < 10; i++)
            soma += parseInt(cpf[i]) * (11 - i);
        resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11)
            resto = 0;
        if (resto !== parseInt(cpf[10]))
            return false;
        return true;
    }
    static validarNumeroCelular(numero) {
        const regexCelular = /^(\+55\s?)?\(?\d{2}\)?\s?(9\d{4})-?(\d{4})$/;
        return regexCelular.test(numero);
    }
    static SMS(celular, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield client.messages.create({
                    body: msg,
                    from: twilioPhoneNumber,
                    to: celular, // Número do destinatário com código do país, ex: "+5511987654321"
                });
                console.log("✅ SMS enviado com sucesso:", response.sid);
            }
            catch (error) {
                console.error("❌ Erro ao enviar SMS:", error);
            }
        });
    }
}
exports.default = new PrefeituraLogin();
