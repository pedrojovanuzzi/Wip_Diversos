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
dotenv_1.default.config();
const homologacao = process.env.SERVIDOR_HOMOLOGACAO === 'true';
const url = `https://graph.facebook.com/v20.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;
const urlMedia = `https://graph.facebook.com/v20.0/${process.env.WA_PHONE_NUMBER_ID}/media`;
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
                uuid
            });
            if (cpf) {
                if (!PrefeituraLogin.validarCPF(cpf)) {
                    res.status(400).json({ error: 'CPF Inválido' });
                    return;
                }
                if (!PrefeituraLogin.validarNumeroCelular(celular)) {
                    res.status(400).json({ error: 'Número de Celular Inválido' });
                    return;
                }
                prefUserRepository.save(newLogin).then(() => {
                    res.status(201).json({ sucesso: "Sucesso Pode Fechar a Página" });
                    return;
                }).catch((err) => {
                    res.status(400).json({ error: err.message });
                    return;
                });
            }
            else {
                res.status(400).json({ error: 'CPF Não inserido' });
                return;
            }
        });
    }
    redirect(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { mac, ip, username, "link-login": linkLogin, "link-orig": linkOrig, error } = req.body;
            console.log("Dados recebidos do Hotspot:", { mac, ip, username, linkLogin, linkOrig, error });
            res.redirect(`https://wipdiversos.wiptelecomunicacoes.com.br/Prefeitura/Login?mac=${mac}&ip=${ip}&username=${username}&link-login=${linkLogin}&link-orig=${linkOrig}&error=${error}`);
        });
    }
    redirect_2(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { mac, ip, username, "link-login": linkLogin, "link-orig": linkOrig, error } = req.body;
            console.log("Dados recebidos do Hotspot 2:", { mac, ip, username, linkLogin, linkOrig, error });
            const redirectUrl = `https://wipdiversos.wiptelecomunicacoes.com.br/Prefeitura/CodeOtp?mac=${mac}&ip=${ip}&username=${username}&link-login=${linkLogin}&link-orig=${linkOrig}&error=${error}`;
            res.json({ redirectUrl }); // 🔹 Retorna a URL no JSON
        });
    }
    AuthCode(req, res) {
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
    SendOtp(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { otp, celular } = req.body;
            const msg = `Seu código de verificação é: ${otp}`;
            yield this.MensagensComuns(celular, msg);
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
    MensagensComuns(recipient_number, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("Número de TEST_PHONE:", process.env.TEST_PHONE);
                console.log("Número de recipient_number:", recipient_number);
                const response = yield axios_1.default.post(url, {
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: recipient_number,
                    type: "text",
                    text: {
                        preview_url: false,
                        body: String(msg),
                    },
                }, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });
                console.log(response.data);
            }
            catch (error) {
                console.error("Error sending message:", error);
            }
        });
    }
}
exports.default = new PrefeituraLogin();
