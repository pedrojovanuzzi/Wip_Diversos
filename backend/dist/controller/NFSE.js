"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const https = __importStar(require("https"));
const child_process_1 = require("child_process");
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
const xml_crypto_1 = require("xml-crypto");
const forge = __importStar(require("node-forge"));
const MkauthSource_1 = __importDefault(require("../database/MkauthSource"));
const DataSource_1 = __importDefault(require("../database/DataSource"));
const NFSE_1 = require("../entities/NFSE");
const ClientesEntities_1 = require("../entities/ClientesEntities");
const Faturas_1 = require("../entities/Faturas");
const xmldom_1 = require("xmldom");
const typeorm_1 = require("typeorm");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
dotenv.config();
class NFSEController {
    constructor() {
        this.certPath = path.resolve(__dirname, "../files/certificado.pfx");
        this.homologacao = process.env.SERVIDOR_HOMOLOGACAO === 'true';
        this.WSDL_URL = this.homologacao === true
            ? "http://fi1.fiorilli.com.br:5663/IssWeb-ejb/IssWebWS/IssWebWS"
            : "http://nfe.arealva.sp.gov.br:5661/IssWeb-ejb/IssWebWS/IssWebWS?wsdl";
        this.TEMP_DIR = path.resolve(__dirname, "../files");
        this.PASSWORD = "";
        this.DECRYPTED_CERT_PATH = path.resolve(this.TEMP_DIR, "decrypted_certificado.tmp");
        this.NEW_CERT_PATH = path.resolve(this.TEMP_DIR, "new_certificado.pfx");
        this.iniciar = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                let { password, clientesSelecionados, aliquota, service, reducao } = req.body;
                this.PASSWORD = password;
                aliquota = aliquota && aliquota.trim() !== "" ? aliquota : "4.4269";
                aliquota = aliquota.replace(",", ".");
                aliquota = aliquota.replace("%", "");
                if (service === "" || undefined || null) {
                    service = "Servico de Suporte Tecnico";
                }
                if (reducao === "" || undefined || null) {
                    reducao = 40;
                }
                reducao = reducao / 100;
                if (!password)
                    throw new Error("Senha do certificado não fornecida.");
                const result = yield this.gerarNFSE(password, clientesSelecionados, "EnviarLoteRpsSincronoEnvio", aliquota, service, reducao);
                if ((result === null || result === void 0 ? void 0 : result.status) === "200") {
                    res.status(200).json({ mensagem: "RPS criado com sucesso!", result });
                }
                else {
                    res.status(500).json({ erro: "Erro ao criar o RPS." });
                }
            }
            catch (error) {
                res.status(500).json({ erro: "Erro ao criar o RPS." });
            }
        });
        this.imprimirNFSE = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { rpsNumber } = req.body;
            const result = yield Promise.all(rpsNumber.map((rps) => this.BuscarNSFEDetalhes(rps)));
            res.status(200).json(result);
        });
        this.setNfseStatus = this.setNfseStatus.bind(this);
        this.setNfseNumber = this.setNfseNumber.bind(this);
        this.BuscarNSFE = this.BuscarNSFE.bind(this);
    }
    gerarNFSE(password_1, ids_1, SOAPAction_1, aliquota_1) {
        return __awaiter(this, arguments, void 0, function* (password, ids, SOAPAction, aliquota, service = "Servico de Suporte Tecnico", reducao = 40) {
            try {
                if (!fs.existsSync(this.TEMP_DIR))
                    fs.mkdirSync(this.TEMP_DIR, { recursive: true });
                const isLinux = os.platform() === "linux";
                const isWindows = os.platform() === "win32";
                if (isLinux) {
                    (0, child_process_1.execSync)(`openssl pkcs12 -in "${this.certPath}" -nodes -legacy -passin pass:${password} -out "${this.DECRYPTED_CERT_PATH}"`, { stdio: "inherit" });
                    (0, child_process_1.execSync)(`openssl pkcs12 -in "${this.DECRYPTED_CERT_PATH}" -export -out "${this.NEW_CERT_PATH}" -passout pass:${password}`, { stdio: "inherit" });
                }
                else if (isWindows) {
                    const powershellCommand = `
          try {
            $certificado = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('${this.certPath}', '${password}', [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable);
            $bytes = $certificado.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, '${password}');
            [System.IO.File]::WriteAllBytes('${this.NEW_CERT_PATH}', $bytes)
          } catch {
            Write-Error $_.Exception.Message
            exit 1
          }
        `;
                    try {
                        (0, child_process_1.execSync)(`powershell -Command "${powershellCommand.replace(/\n/g, " ")}"`, {
                            stdio: ["ignore", "inherit", "pipe"], // Captura stderr
                        });
                    }
                    catch (error) {
                        console.error("Erro no PowerShell:", error.stderr || error.message || error);
                        return { status: "500", response: error.stderr || "Erro desconhecido" };
                    }
                }
                const certPathToUse = fs.existsSync(this.NEW_CERT_PATH)
                    ? this.NEW_CERT_PATH
                    : this.certPath;
                const pfxBuffer = fs.readFileSync(certPathToUse);
                const httpsAgent = new https.Agent({
                    pfx: pfxBuffer,
                    passphrase: password,
                    rejectUnauthorized: false,
                });
                for (const id of ids) {
                    const xmlLoteRps = yield this.gerarXmlRecepcionarRps(id, Number(aliquota).toFixed(4), service, reducao);
                    const response = yield axios_1.default.post(this.WSDL_URL, xmlLoteRps, {
                        httpsAgent,
                        headers: {
                            "Content-Type": "text/xml; charset=UTF-8",
                            SOAPAction: SOAPAction,
                        },
                    });
                    console.log(response);
                    if (response.status === 200) {
                        return { status: "200", response: response.data };
                    }
                    else {
                        return { status: "500", response: "Error" };
                    }
                }
                if (fs.existsSync(this.NEW_CERT_PATH))
                    fs.unlinkSync(this.NEW_CERT_PATH);
                if (fs.existsSync(this.DECRYPTED_CERT_PATH))
                    fs.unlinkSync(this.DECRYPTED_CERT_PATH);
            }
            catch (error) {
                console.error("Erro geral no gerarNFSE:", error);
                return { status: "500", response: error.message || "Senha Inválida" };
            }
        });
    }
    gerarXmlRecepcionarRps(id, aliquota, service, reducao) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
            try {
                const RPSQuery = MkauthSource_1.default.getRepository(Faturas_1.Faturas);
                const rpsData = yield RPSQuery.findOne({ where: { id: Number(id) } });
                const ClientRepository = MkauthSource_1.default.getRepository(ClientesEntities_1.ClientesEntities);
                const FaturasRepository = MkauthSource_1.default.getRepository(Faturas_1.Faturas);
                const FaturasData = yield FaturasRepository.findOne({
                    where: { id: Number(id) },
                });
                const ClientData = yield ClientRepository.findOne({
                    where: { login: FaturasData === null || FaturasData === void 0 ? void 0 : FaturasData.login },
                });
                const response = yield axios_1.default.get(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${ClientData === null || ClientData === void 0 ? void 0 : ClientData.cidade}`);
                const municipio = response.data.id;
                const NsfeData = DataSource_1.default.getRepository(NFSE_1.NFSE);
                const nfseResponse = yield NsfeData.find({
                    order: { id: "DESC" },
                    take: 1,
                });
                let nfseNumber = nfseResponse && ((_a = nfseResponse[0]) === null || _a === void 0 ? void 0 : _a.numeroRps)
                    ? nfseResponse[0].numeroRps + 1
                    : 1;
                nfseNumber = nfseNumber === 9999999 ? 9999999 + 1 : nfseNumber; //Por causa de um Teste Realizado]
                let valorMenosDesconto = 0;
                (ClientData === null || ClientData === void 0 ? void 0 : ClientData.desconto) ? valorMenosDesconto = (Number(rpsData === null || rpsData === void 0 ? void 0 : rpsData.valor) - Number(ClientData === null || ClientData === void 0 ? void 0 : ClientData.desconto)) : valorMenosDesconto = Number(rpsData === null || rpsData === void 0 ? void 0 : rpsData.valor);
                let valorReduzido = Number(valorMenosDesconto) * Number(reducao);
                valorReduzido = Number(valorReduzido.toFixed(2));
                const rpsXmlSemAssinatura = `
    <Rps xmlns="http://www.abrasf.org.br/nfse.xsd">
      <InfDeclaracaoPrestacaoServico Id="RPS${String(rpsData === null || rpsData === void 0 ? void 0 : rpsData.uuid_lanc)}">
        <Rps>
          <IdentificacaoRps>
            <Numero>${String(nfseNumber)}</Numero>
            <Serie>${String((_b = nfseResponse[0]) === null || _b === void 0 ? void 0 : _b.serieRps)}</Serie>
            <Tipo>${String((_c = nfseResponse[0]) === null || _c === void 0 ? void 0 : _c.tipoRps)}</Tipo>
          </IdentificacaoRps>
          <DataEmissao>${new Date()
                    .toISOString()
                    .substring(0, 10)}</DataEmissao>
          <Status>1</Status>
        </Rps>
        <Competencia>${new Date().toISOString().substring(0, 10)}</Competencia>
        <Servico>
          <Valores>
            <ValorServicos>${String(valorReduzido)}</ValorServicos>
            <Aliquota>${this.homologacao === true ? "2.00" : aliquota || "4.4269"}</Aliquota>
          </Valores>
          <IssRetido>${String((_d = nfseResponse[0]) === null || _d === void 0 ? void 0 : _d.issRetido)}</IssRetido>
          <ResponsavelRetencao>${String((_e = nfseResponse[0]) === null || _e === void 0 ? void 0 : _e.responsavelRetencao)}</ResponsavelRetencao>
          <ItemListaServico>${this.homologacao === true ? "17.01" : String((_f = nfseResponse[0]) === null || _f === void 0 ? void 0 : _f.itemListaServico)}</ItemListaServico>
          <Discriminacao>${service}</Discriminacao>
          <CodigoMunicipio>3503406</CodigoMunicipio>
          <ExigibilidadeISS>${String((_g = nfseResponse[0]) === null || _g === void 0 ? void 0 : _g.exigibilidadeIss)}</ExigibilidadeISS>
        </Servico>
        <Prestador>
          <CpfCnpj><Cnpj>${this.homologacao === true
                    ? process.env.MUNICIPIO_CNPJ_TEST
                    : process.env.MUNICIPIO_LOGIN}</Cnpj></CpfCnpj>
          <InscricaoMunicipal>${this.homologacao === true
                    ? process.env.MUNICIPIO_INCRICAO_TEST
                    : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal>
        </Prestador>
        <Tomador>
          <IdentificacaoTomador>
            <CpfCnpj>
              <${(ClientData === null || ClientData === void 0 ? void 0 : ClientData.cpf_cnpj.length) === 11 ? "Cpf" : "Cnpj"}>${String(ClientData === null || ClientData === void 0 ? void 0 : ClientData.cpf_cnpj.replace(/[^0-9]/g, ""))}</${(ClientData === null || ClientData === void 0 ? void 0 : ClientData.cpf_cnpj.length) === 11 ? "Cpf" : "Cnpj"}>
            </CpfCnpj>
          </IdentificacaoTomador>
          <RazaoSocial>${String(ClientData === null || ClientData === void 0 ? void 0 : ClientData.nome)}</RazaoSocial>
          <Endereco>
            <Endereco>${String(ClientData === null || ClientData === void 0 ? void 0 : ClientData.endereco)}</Endereco>
            <Numero>${String(ClientData === null || ClientData === void 0 ? void 0 : ClientData.numero)}</Numero>
            <Complemento>${String(ClientData === null || ClientData === void 0 ? void 0 : ClientData.complemento)}</Complemento>
            <Bairro>${String(ClientData === null || ClientData === void 0 ? void 0 : ClientData.bairro)}</Bairro>
            <CodigoMunicipio>${municipio}</CodigoMunicipio>
            <Uf>SP</Uf>
            <Cep>${String(ClientData === null || ClientData === void 0 ? void 0 : ClientData.cep.replace(/[^0-9]/g, ""))}</Cep>
          </Endereco>
          <Contato>
            <Telefone>${String(ClientData === null || ClientData === void 0 ? void 0 : ClientData.celular.replace(/[^0-9]/g, ""))}</Telefone>
            <Email>${this.homologacao === true
                    ? "teste24542frsgwr@gmail.com"
                    : String(ClientData === null || ClientData === void 0 ? void 0 : ClientData.email)}</Email>
          </Contato>
        </Tomador>
        ${this.homologacao === true ? "" : "<RegimeEspecialTributacao>6</RegimeEspecialTributacao>"}
        <OptanteSimplesNacional>${this.homologacao === true ? "2" : ((_h = nfseResponse[0]) === null || _h === void 0 ? void 0 : _h.optanteSimplesNacional) || "1"}</OptanteSimplesNacional>
        <IncentivoFiscal>${((_j = nfseResponse[0]) === null || _j === void 0 ? void 0 : _j.incentivoFiscal) || "2"}</IncentivoFiscal>
      </InfDeclaracaoPrestacaoServico>
    </Rps>
    `
                    .replace(/[\r\n]+/g, "")
                    .replace(/\s{2,}/g, " ")
                    .replace(/>\s+</g, "><")
                    .replace(/<\s+/g, "<")
                    .replace(/\s+>/g, ">")
                    .trim();
                const loteXmlSemAssinatura = `
    <LoteRps versao="2.01" Id="lote${nfseNumber}">
      <NumeroLote>1</NumeroLote>
      <CpfCnpj><Cnpj>${this.homologacao === true
                    ? process.env.MUNICIPIO_CNPJ_TEST
                    : process.env.MUNICIPIO_LOGIN}</Cnpj></CpfCnpj>
      <InscricaoMunicipal>${this.homologacao === true
                    ? process.env.MUNICIPIO_INCRICAO_TEST
                    : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal>
      <QuantidadeRps>1</QuantidadeRps>
      <ListaRps>
        ${rpsXmlSemAssinatura}
      </ListaRps>
    </LoteRps>
    `
                    .replace(/[\r\n]+/g, "")
                    .replace(/\s{2,}/g, " ")
                    .replace(/>\s+</g, "><")
                    .replace(/<\s+/g, "<")
                    .replace(/\s+>/g, ">")
                    .trim();
                const GerarNfseHomologacao = `
        ${rpsXmlSemAssinatura}
    `
                    .replace(/[\r\n]+/g, "")
                    .replace(/\s{2,}/g, " ")
                    .replace(/>\s+</g, "><")
                    .replace(/<\s+/g, "<")
                    .replace(/\s+>/g, ">")
                    .trim();
                const SignatureRps = this.assinarXml(loteXmlSemAssinatura, `InfDeclaracaoPrestacaoServico`);
                const loteXmlComAssinatura = `
    ${SignatureRps}
  `.trim();
                let envioXml = "";
                if (this.homologacao) {
                    envioXml = `
    <GerarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
      ${GerarNfseHomologacao}
    </GerarNfseEnvio>
    `.trim();
                }
                else {
                    envioXml = `
    <EnviarLoteRpsSincronoEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
      ${loteXmlComAssinatura}
    </EnviarLoteRpsSincronoEnvio>
    `.trim();
                }
                const soapFinal = `
    <?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:ws="http://ws.issweb.fiorilli.com.br/"
    xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
      <soapenv:Header/>
      <soapenv:Body>
        <ws:recepcionarLoteRpsSincrono>
          ${envioXml}
          <username>${this.homologacao === true
                    ? process.env.MUNICIPIO_LOGIN_TEST
                    : process.env.MUNICIPIO_LOGIN}</username>
          <password>${this.homologacao === true
                    ? process.env.MUNICIPIO_SENHA_TEST
                    : process.env.MUNICIPIO_SENHA}</password>
        </ws:recepcionarLoteRpsSincrono>
      </soapenv:Body>
    </soapenv:Envelope>
    `.replace(/[\r\n]+/g, "") // Remove quebras de linha
                    .replace(/\s{2,}/g, " ") // Substitui múltiplos espaços por um único
                    .replace(/>\s+</g, "><") // Remove espaços entre tags
                    .replace(/<\s+/g, "<") // Remove espaços após '<'
                    .replace(/\s+>/g, ">") // Remove espaços antes de '>'
                    .trim(); // Remove espaços no início e fim
                const soapFinalHomologacao = `
    <?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:ws="http://ws.issweb.fiorilli.com.br/"
    xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
      <soapenv:Header/>
      <soapenv:Body>
        <ws:gerarNfse>
          ${envioXml}
          <username>${this.homologacao === true
                    ? process.env.MUNICIPIO_LOGIN_TEST
                    : process.env.MUNICIPIO_LOGIN}</username>
          <password>${this.homologacao === true
                    ? process.env.MUNICIPIO_SENHA_TEST
                    : process.env.MUNICIPIO_SENHA}</password>
        </ws:gerarNfse>
      </soapenv:Body>
    </soapenv:Envelope>
    `.replace(/[\r\n]+/g, "") // Remove quebras de linha
                    .replace(/\s{2,}/g, " ") // Substitui múltiplos espaços por um único
                    .replace(/>\s+</g, "><") // Remove espaços entre tags
                    .replace(/<\s+/g, "<") // Remove espaços após '<'
                    .replace(/\s+>/g, ">") // Remove espaços antes de '>'
                    .trim(); // Remove espaços no início e fim
                if (this.homologacao) {
                    aliquota = "2.00";
                }
                const NsfeRepository = DataSource_1.default.getRepository(NFSE_1.NFSE);
                const insertDatabase = NsfeRepository.create({
                    login: (rpsData === null || rpsData === void 0 ? void 0 : rpsData.login) || "",
                    numeroRps: nfseNumber || 0,
                    serieRps: ((_k = nfseResponse[0]) === null || _k === void 0 ? void 0 : _k.serieRps) || "",
                    tipoRps: ((_l = nfseResponse[0]) === null || _l === void 0 ? void 0 : _l.tipoRps) || 0,
                    dataEmissao: (rpsData === null || rpsData === void 0 ? void 0 : rpsData.processamento)
                        ? new Date(rpsData.processamento)
                        : new Date(),
                    competencia: (rpsData === null || rpsData === void 0 ? void 0 : rpsData.datavenc) ? new Date(rpsData.datavenc) : new Date(),
                    valorServico: valorReduzido || 0,
                    aliquota: Number(Number(aliquota).toFixed(4)),
                    issRetido: ((_m = nfseResponse[0]) === null || _m === void 0 ? void 0 : _m.issRetido) || 0,
                    responsavelRetencao: ((_o = nfseResponse[0]) === null || _o === void 0 ? void 0 : _o.responsavelRetencao) || 0,
                    itemListaServico: ((_p = nfseResponse[0]) === null || _p === void 0 ? void 0 : _p.itemListaServico) || "",
                    discriminacao: service,
                    codigoMunicipio: ((_q = nfseResponse[0]) === null || _q === void 0 ? void 0 : _q.codigoMunicipio) || 0,
                    exigibilidadeIss: ((_r = nfseResponse[0]) === null || _r === void 0 ? void 0 : _r.exigibilidadeIss) || 0,
                    cnpjPrestador: ((_s = nfseResponse[0]) === null || _s === void 0 ? void 0 : _s.cnpjPrestador) || "",
                    inscricaoMunicipalPrestador: ((_t = nfseResponse[0]) === null || _t === void 0 ? void 0 : _t.inscricaoMunicipalPrestador) || "",
                    cpfTomador: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.cpf_cnpj.replace(/[^0-9]/g, "")) || "",
                    razaoSocialTomador: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.nome) || "",
                    enderecoTomador: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.endereco) || "",
                    numeroEndereco: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.numero) || "",
                    complemento: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.complemento) || undefined,
                    bairro: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.bairro) || "",
                    uf: ((_u = nfseResponse[0]) === null || _u === void 0 ? void 0 : _u.uf) || "",
                    cep: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.cep.replace(/[^0-9]/g, "")) || "",
                    telefoneTomador: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.celular.replace(/[^0-9]/g, "")) || undefined,
                    emailTomador: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.email) || undefined,
                    optanteSimplesNacional: 1,
                    incentivoFiscal: 2,
                });
                if (yield this.verificaRps(nfseNumber)) {
                    yield NsfeData.save(insertDatabase);
                    if (this.homologacao) {
                        return soapFinalHomologacao;
                    }
                    return soapFinal;
                }
                else {
                    return "ERRO NA CONSULTA DE RPS";
                }
            }
            catch (error) {
                return "Error " + error;
            }
        });
    }
    extrairChaveECertificado() {
        const pfxBuffer = fs.readFileSync(this.certPath);
        const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString("binary"));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.PASSWORD);
        let privateKeyPem = "";
        let certificatePem = "";
        p12.safeContents.forEach((content) => {
            content.safeBags.forEach((bag) => {
                if (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag && bag.key) {
                    privateKeyPem = forge.pki.privateKeyToPem(bag.key);
                }
                else if (bag.type === forge.pki.oids.certBag && bag.cert) {
                    certificatePem = forge.pki.certificateToPem(bag.cert);
                }
            });
        });
        if (!privateKeyPem || !certificatePem) {
            throw new Error("Falha ao extrair chave privada ou certificado.");
        }
        const x509Certificate = certificatePem
            .replace(/-----BEGIN CERTIFICATE-----/g, "")
            .replace(/-----END CERTIFICATE-----/g, "")
            .replace(/\s+/g, "");
        return { privateKeyPem, x509Certificate };
    }
    verificaRps(rpsNumber_1) {
        return __awaiter(this, arguments, void 0, function* (rpsNumber, serie = "1", tipo = "1") {
            try {
                const dados = `<IdentificacaoRps>
                    <Numero>${rpsNumber}</Numero>
                    <Serie>${serie}</Serie>
                    <Tipo>${tipo}</Tipo>
                    </IdentificacaoRps>
                    <Prestador>
                    <CpfCnpj>
                        <Cnpj>${this.homologacao === true
                    ? process.env.MUNICIPIO_CNPJ_TEST
                    : process.env.MUNICIPIO_LOGIN}</Cnpj>
                    </CpfCnpj>
                    <InscricaoMunicipal>${this.homologacao === true
                    ? process.env.MUNICIPIO_INCRICAO_TEST
                    : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal>
                    </Prestador>`.trim();
                const envioXml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`.trim();
                const soapFinal = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`
                    .replace(/[\r\n]+/g, "")
                    .replace(/\s{2,}/g, " ")
                    .replace(/>\s+</g, "><")
                    .replace(/<\s+/g, "<")
                    .replace(/\s+>/g, ">")
                    .trim();
                const certPathToUse = fs.existsSync(this.NEW_CERT_PATH)
                    ? this.NEW_CERT_PATH
                    : this.certPath;
                const pfxBuffer = fs.readFileSync(certPathToUse);
                const httpsAgent = new https.Agent({
                    pfx: pfxBuffer,
                    passphrase: this.PASSWORD,
                    rejectUnauthorized: false,
                });
                const response = yield axios_1.default.post(this.WSDL_URL, soapFinal, {
                    httpsAgent,
                    headers: {
                        "Content-Type": "text/xml; charset=UTF-8",
                        SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
                    },
                });
                // console.log(response.data);
                if (response.data.includes("<ns2:Codigo>E92</ns2:Codigo>"))
                    return true;
                return false;
            }
            catch (error) {
                return error;
            }
        });
    }
    cancelarNfse(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { rpsNumber, password } = req.body;
                if (!Array.isArray(rpsNumber)) {
                    res.status(400).json({ error: "rpsNumber must be an array" });
                    return;
                }
                this.PASSWORD = password;
                const responses = yield Promise.all(rpsNumber.map((rps) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        console.log(yield this.setNfseNumber(rps));
                        const nfseNumber = yield this.setNfseNumber(rps);
                        const dados = `<Pedido><InfPedidoCancelamento Id="CANCEL${nfseNumber}"><IdentificacaoNfse><Numero>${nfseNumber}</Numero><CpfCnpj><Cnpj>${this.homologacao === true
                            ? process.env.MUNICIPIO_CNPJ_TEST
                            : process.env.MUNICIPIO_LOGIN}</Cnpj></CpfCnpj><InscricaoMunicipal>${this.homologacao === true
                            ? process.env.MUNICIPIO_INCRICAO_TEST
                            : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal><CodigoMunicipio>3503406</CodigoMunicipio></IdentificacaoNfse><CodigoCancelamento>2</CodigoCancelamento></InfPedidoCancelamento></Pedido>`.trim();
                        const envioXml = `<CancelarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</CancelarNfseEnvio>`.trim();
                        const envioXmlAssinado = this.assinarXml(envioXml, "InfPedidoCancelamento");
                        const soapFinal = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:cancelarNfse>${envioXmlAssinado}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:cancelarNfse></soapenv:Body></soapenv:Envelope>`
                            .replace(/[\r\n]+/g, "")
                            .replace(/\s{2,}/g, " ")
                            .replace(/>\s+</g, "><")
                            .replace(/<\s+/g, "<")
                            .replace(/\s+>/g, ">")
                            .trim();
                        const soapFinalHomologacao = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:cancelarNfse>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:cancelarNfse></soapenv:Body></soapenv:Envelope>`
                            .replace(/[\r\n]+/g, "")
                            .replace(/\s{2,}/g, " ")
                            .replace(/>\s+</g, "><")
                            .replace(/<\s+/g, "<")
                            .replace(/\s+>/g, ">")
                            .trim();
                        const certPathToUse = fs.existsSync(this.NEW_CERT_PATH)
                            ? this.NEW_CERT_PATH
                            : this.certPath;
                        const pfxBuffer = fs.readFileSync(certPathToUse);
                        const httpsAgent = new https.Agent({
                            pfx: pfxBuffer,
                            passphrase: this.PASSWORD,
                            rejectUnauthorized: false,
                        });
                        let response = null;
                        if (this.homologacao) {
                            response = yield axios_1.default.post(this.WSDL_URL, soapFinalHomologacao, {
                                httpsAgent,
                                headers: {
                                    "Content-Type": "text/xml; charset=UTF-8",
                                    SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
                                },
                            });
                        }
                        else {
                            response = yield axios_1.default.post(this.WSDL_URL, soapFinal, {
                                httpsAgent,
                                headers: {
                                    "Content-Type": "text/xml; charset=UTF-8",
                                    SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
                                },
                            });
                        }
                        console.log(response);
                        setTimeout(() => {
                        }, 5000);
                        res.status(200).json({ rps, success: true, response: response.data });
                        return;
                    }
                    catch (error) {
                        console.error(`Error processing RPS ${rps}:`, error);
                        res.status(500).json({ rps, success: false, error: error });
                        return;
                    }
                })));
            }
            catch (error) {
                console.error(error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
    }
    setNfseNumber(rpsNumber_1) {
        return __awaiter(this, arguments, void 0, function* (rpsNumber, serie = "1", tipo = "1") {
            try {
                const dados = `<IdentificacaoRps>
                    <Numero>${rpsNumber}</Numero>
                    <Serie>${serie}</Serie>
                    <Tipo>${tipo}</Tipo>
                    </IdentificacaoRps>
                    <Prestador>
                    <CpfCnpj>
                        <Cnpj>${this.homologacao === true
                    ? process.env.MUNICIPIO_CNPJ_TEST
                    : process.env.MUNICIPIO_LOGIN}</Cnpj>
                    </CpfCnpj>
                    <InscricaoMunicipal>${this.homologacao === true
                    ? process.env.MUNICIPIO_INCRICAO_TEST
                    : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal>
                    </Prestador>`.trim();
                const envioXml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`.trim();
                const soapFinal = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`
                    .replace(/[\r\n]+/g, "")
                    .replace(/\s{2,}/g, " ")
                    .replace(/>\s+</g, "><")
                    .replace(/<\s+/g, "<")
                    .replace(/\s+>/g, ">")
                    .trim();
                const certPathToUse = fs.existsSync(this.NEW_CERT_PATH)
                    ? this.NEW_CERT_PATH
                    : this.certPath;
                const pfxBuffer = fs.readFileSync(certPathToUse);
                const httpsAgent = new https.Agent({
                    pfx: pfxBuffer,
                    passphrase: this.PASSWORD,
                    rejectUnauthorized: false,
                });
                const response = yield axios_1.default.post(this.WSDL_URL, soapFinal, {
                    httpsAgent,
                    headers: {
                        "Content-Type": "text/xml; charset=UTF-8",
                        SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
                    },
                });
                const match = response.data.match(/<ns2:Numero>(\d+)<\/ns2:Numero>/);
                if (match && match[1]) {
                    return match[1]; // Retorna o valor do número
                }
                else {
                    console.log("Número não encontrado no XML.");
                    return null; // Retorna null caso o número não seja encontrado
                }
            }
            catch (error) {
                return error;
            }
        });
    }
    assinarXml(xml, referenceId) {
        const { privateKeyPem, x509Certificate } = this.extrairChaveECertificado();
        const keyInfoContent = `<X509Data><X509Certificate>${x509Certificate}</X509Certificate></X509Data>`;
        const signer = new xml_crypto_1.SignedXml({
            implicitTransforms: ["http://www.w3.org/TR/2001/REC-xml-c14n-20010315"],
            privateKey: privateKeyPem,
            publicCert: `${x509Certificate}`,
            signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
            canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
            getKeyInfoContent: () => keyInfoContent,
        });
        signer.addReference({
            xpath: `//*[local-name(.)='${referenceId}']`,
            digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
            transforms: [
                "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
                "http://www.w3.org/2001/10/xml-exc-c14n#",
            ],
        });
        try {
            signer.computeSignature(xml, {
                location: {
                    reference: `//*[local-name(.)='${referenceId}']`,
                    action: "after",
                },
            });
            const isValid = true;
            if (!isValid) {
                throw new Error(`Signature validation failed`);
            }
            // console.log("Signature is valid:", isValid);
            return signer.getSignedXml();
        }
        catch (error) {
            console.error("An error occurred during XML signing:", error);
            return String(error);
        }
    }
    setNfseStatus(rpsNumber_1) {
        return __awaiter(this, arguments, void 0, function* (rpsNumber, serie = "1", tipo = "1") {
            try {
                const dados = `<IdentificacaoRps>
                    <Numero>${rpsNumber}</Numero>
                    <Serie>${serie}</Serie>
                    <Tipo>${tipo}</Tipo>
                    </IdentificacaoRps>
                    <Prestador>
                    <CpfCnpj>
                        <Cnpj>${this.homologacao === true
                    ? process.env.MUNICIPIO_CNPJ_TEST
                    : process.env.MUNICIPIO_LOGIN}</Cnpj>
                    </CpfCnpj>
                    <InscricaoMunicipal>${this.homologacao === true
                    ? process.env.MUNICIPIO_INCRICAO_TEST
                    : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal>
                    </Prestador>`.trim();
                const envioXml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`.trim();
                const soapFinal = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`
                    .replace(/[\r\n]+/g, "")
                    .replace(/\s{2,}/g, " ")
                    .replace(/>\s+</g, "><")
                    .replace(/<\s+/g, "<")
                    .replace(/\s+>/g, ">")
                    .trim();
                const certPathToUse = fs.existsSync(this.NEW_CERT_PATH)
                    ? this.NEW_CERT_PATH
                    : this.certPath;
                const pfxBuffer = fs.readFileSync(certPathToUse);
                const httpsAgent = new https.Agent({
                    pfx: pfxBuffer,
                    passphrase: this.PASSWORD,
                    rejectUnauthorized: false,
                });
                const response = yield axios_1.default.post(this.WSDL_URL, soapFinal, {
                    httpsAgent,
                    headers: {
                        "Content-Type": "text/xml; charset=UTF-8",
                        SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
                    },
                });
                if (response.data.includes('<ns2:NfseCancelamento versao="2.0">')) {
                    return true; // Encontrado NfseCancelamento
                }
                else {
                    return false; // Não encontrado NfseCancelamento
                }
            }
            catch (error) {
                console.log(error);
                return false; // Em caso de erro, retorna false
            }
        });
    }
    BuscarNSFE(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { cpf, filters, dateFilter } = req.body;
                const whereConditions = {};
                if (cpf)
                    whereConditions.cpf_cnpj = cpf;
                if (filters) {
                    const { plano, vencimento, cli_ativado, nova_nfe } = filters;
                    if (plano === null || plano === void 0 ? void 0 : plano.length)
                        whereConditions.plano = (0, typeorm_1.In)(plano);
                    if (vencimento === null || vencimento === void 0 ? void 0 : vencimento.length)
                        whereConditions.venc = (0, typeorm_1.In)(vencimento);
                    if (cli_ativado === null || cli_ativado === void 0 ? void 0 : cli_ativado.length)
                        whereConditions.cli_ativado = (0, typeorm_1.In)(["s"]);
                    if (nova_nfe === null || nova_nfe === void 0 ? void 0 : nova_nfe.length)
                        whereConditions.tags = (0, typeorm_1.In)(nova_nfe);
                }
                const ClientRepository = MkauthSource_1.default.getRepository(ClientesEntities_1.ClientesEntities);
                const clientesResponse = yield ClientRepository.find({
                    where: whereConditions,
                    select: { login: true, cpf_cnpj: true, cli_ativado: true },
                });
                const now = new Date();
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                const startDate = dateFilter ? new Date(dateFilter.start) : firstDayOfMonth;
                const endDate = dateFilter ? new Date(dateFilter.end) : lastDayOfMonth;
                startDate.setHours(startDate.getHours() + 3);
                endDate.setHours(endDate.getHours() + 3);
                const nfseData = DataSource_1.default.getRepository(NFSE_1.NFSE);
                const nfseResponse = yield nfseData.find({
                    where: { login: (0, typeorm_1.In)(clientesResponse.map((c) => c.login)),
                        competencia: (0, typeorm_1.Between)(startDate, endDate), },
                    order: { id: "DESC" },
                });
                const clientesComNfse = yield Promise.all(clientesResponse.map((cliente) => __awaiter(this, void 0, void 0, function* () {
                    const nfseDoCliente = nfseResponse.filter((nf) => nf.login === cliente.login);
                    if (!nfseDoCliente.length)
                        return null;
                    const statusArray = yield Promise.all(nfseDoCliente.map((nf) => __awaiter(this, void 0, void 0, function* () {
                        const cancelada = yield this.setNfseStatus(nf.numeroRps);
                        return cancelada ? "Cancelada" : "Ativa";
                    })));
                    const nfseNumberArray = yield Promise.all(nfseDoCliente.map((nf) => __awaiter(this, void 0, void 0, function* () {
                        const cancelada = yield this.setNfseNumber(nf.numeroRps);
                        return cancelada;
                    })));
                    return Object.assign(Object.assign({}, cliente), { nfse: {
                            id: nfseDoCliente.map((nf) => nf.id).join(", ") || null,
                            login: nfseDoCliente.map((nf) => nf.login).join(", ") || null,
                            numero_rps: nfseDoCliente.map((nf) => nf.numeroRps).join(", ") || null,
                            serie_rps: nfseDoCliente.map((nf) => nf.serieRps).join(", ") || null,
                            tipo_rps: nfseDoCliente.map((nf) => nf.tipoRps).join(", ") || null,
                            data_emissao: nfseDoCliente.map((nf) => moment_timezone_1.default.tz(nf.dataEmissao, "America/Sao_Paulo").format("DD/MM/YYYY")).join(", ") || null,
                            competencia: nfseDoCliente.map((nf) => moment_timezone_1.default.tz(nf.competencia, "America/Sao_Paulo").format("DD/MM/YYYY")).join(", ") || null,
                            valor_servico: nfseDoCliente.map((nf) => nf.valorServico).join(", ") || null,
                            aliquota: nfseDoCliente.map((nf) => nf.aliquota).join(", ") || null,
                            iss_retido: nfseDoCliente.map((nf) => nf.issRetido).join(", ") || null,
                            responsavel_retecao: nfseDoCliente.map((nf) => nf.responsavelRetencao).join(", ") || null,
                            item_lista_servico: nfseDoCliente.map((nf) => nf.itemListaServico).join(", ") || null,
                            discriminacao: nfseDoCliente.map((nf) => nf.discriminacao).join(", ") || null,
                            codigo_municipio: nfseDoCliente.map((nf) => nf.codigoMunicipio).join(", ") || null,
                            exigibilidade_iss: nfseDoCliente.map((nf) => nf.exigibilidadeIss).join(", ") || null,
                            cnpj_prestador: nfseDoCliente.map((nf) => nf.cnpjPrestador).join(", ") || null,
                            inscricao_municipal_prestador: nfseDoCliente.map((nf) => nf.inscricaoMunicipalPrestador).join(", ") || null,
                            cpf_tomador: nfseDoCliente.map((nf) => nf.cpfTomador).join(", ") || null,
                            razao_social_tomador: nfseDoCliente.map((nf) => nf.razaoSocialTomador).join(", ") || null,
                            endereco_tomador: nfseDoCliente.map((nf) => nf.enderecoTomador).join(", ") || null,
                            numero_endereco: nfseDoCliente.map((nf) => nf.numeroEndereco).join(", ") || null,
                            complemento: nfseDoCliente.map((nf) => nf.complemento).join(", ") || null,
                            bairro: nfseDoCliente.map((nf) => nf.bairro).join(", ") || null,
                            uf: nfseDoCliente.map((nf) => nf.uf).join(", ") || null,
                            cep: nfseDoCliente.map((nf) => nf.cep).join(", ") || null,
                            telefone_tomador: nfseDoCliente.map((nf) => nf.telefoneTomador).join(", ") || null,
                            email_tomador: nfseDoCliente.map((nf) => nf.emailTomador).join(", ") || null,
                            optante_simples_nacional: nfseDoCliente.map((nf) => nf.optanteSimplesNacional).join(", ") || null,
                            incentivo_fiscal: nfseDoCliente.map((nf) => nf.incentivoFiscal).join(", ") || null,
                            status: statusArray.join(", ") || null,
                            numeroNfse: nfseNumberArray.join(", ") || null,
                        } });
                })));
                const resolvedClientesComNfse = clientesComNfse
                    .filter((item) => item !== null)
                    .sort((a, b) => (b.nfse.id || "").localeCompare(a.nfse.id || ""));
                res.status(200).json(resolvedClientesComNfse);
            }
            catch (_a) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
    }
    BuscarNSFEDetalhes(rpsNumber_1) {
        return __awaiter(this, arguments, void 0, function* (rpsNumber, serie = "1", tipo = "1") {
            var _a, _b, _c, _d, _e, _f, _g;
            try {
                const dados = `<IdentificacaoRps>
                       <Numero>${rpsNumber}</Numero>
                       <Serie>${serie}</Serie>
                       <Tipo>${tipo}</Tipo>
                     </IdentificacaoRps>
                     <Prestador>
                       <CpfCnpj>
                         <Cnpj>${this.homologacao
                    ? process.env.MUNICIPIO_CNPJ_TEST
                    : process.env.MUNICIPIO_LOGIN}</Cnpj>
                       </CpfCnpj>
                       <InscricaoMunicipal>${this.homologacao
                    ? process.env.MUNICIPIO_INCRICAO_TEST
                    : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal>
                     </Prestador>`.trim();
                const envioXml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`.trim();
                const soapFinal = `<?xml version="1.0" encoding="UTF-8"?>
        <soapenv:Envelope 
          xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
          xmlns:ws="http://ws.issweb.fiorilli.com.br/" 
          xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
          <soapenv:Header/>
          <soapenv:Body>
            <ws:consultarNfsePorRps>
              ${envioXml}
              <username>${process.env.MUNICIPIO_LOGIN}</username>
              <password>${process.env.MUNICIPIO_SENHA}</password>
            </ws:consultarNfsePorRps>
          </soapenv:Body>
        </soapenv:Envelope>`
                    .replace(/[\r\n]+/g, "")
                    .replace(/\s{2,}/g, " ")
                    .replace(/>\s+</g, "><")
                    .replace(/<\s+/g, "<")
                    .replace(/\s+>/g, ">")
                    .trim();
                const certPathToUse = fs.existsSync(this.NEW_CERT_PATH) ? this.NEW_CERT_PATH : this.certPath;
                const pfxBuffer = fs.readFileSync(certPathToUse);
                const httpsAgent = new https.Agent({
                    pfx: pfxBuffer,
                    passphrase: this.PASSWORD,
                    rejectUnauthorized: false,
                });
                const response = yield axios_1.default.post(this.WSDL_URL, soapFinal, {
                    httpsAgent,
                    headers: {
                        "Content-Type": "text/xml; charset=UTF-8",
                        SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
                    },
                });
                const parser = new xmldom_1.DOMParser();
                const xmlDoc = parser.parseFromString(response.data, "text/xml");
                const nfseNodes = xmlDoc.getElementsByTagName("ns2:CompNfse");
                if (nfseNodes.length > 0) {
                    const nfseNode = nfseNodes[0];
                    const extractedData = {};
                    const extractChildren = (node) => {
                        var _a;
                        const result = {};
                        for (let i = 0; i < node.childNodes.length; i++) {
                            const child = node.childNodes[i];
                            if (child.nodeType === 1) {
                                const element = child;
                                const key = element.localName;
                                const text = ((_a = element.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || "";
                                if (element.childNodes.length > 0 &&
                                    Array.from(element.childNodes).some((c) => c.nodeType === 1)) {
                                    result[key] = extractChildren(element);
                                }
                                else {
                                    result[key] = text;
                                }
                            }
                        }
                        return result;
                    };
                    extractedData[nfseNode.localName] = extractChildren(nfseNode);
                    const uf = (_g = (_f = (_e = (_d = (_c = (_b = (_a = extractedData.CompNfse) === null || _a === void 0 ? void 0 : _a.Nfse) === null || _b === void 0 ? void 0 : _b.InfNfse) === null || _c === void 0 ? void 0 : _c.DeclaracaoPrestacaoServico) === null || _d === void 0 ? void 0 : _d.InfDeclaracaoPrestacaoServico) === null || _e === void 0 ? void 0 : _e.Tomador) === null || _f === void 0 ? void 0 : _f.Endereco) === null || _g === void 0 ? void 0 : _g.CodigoMunicipio;
                    if (uf) {
                        const ibgeResponse = yield axios_1.default.get(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${uf}`, { timeout: 1000 }).catch(() => ({ data: { nome: "" } }));
                        extractedData.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico
                            .Tomador.Endereco.Cidade = ibgeResponse.data.nome;
                    }
                    return { status: "success", data: extractedData };
                }
                else {
                    return { status: "error", message: "InfNfse element not found in XML." };
                }
            }
            catch (error) {
                return {
                    status: "error",
                    message: "Erro ao buscar detalhes da NFSE.",
                    error,
                };
            }
        });
    }
    uploadCertificado(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                res.status(200).json({ mensagem: "Certificado enviado com sucesso." });
            }
            catch (error) {
                res
                    .status(500)
                    .json({ erro: "Erro ao processar o upload do certificado." });
            }
        });
    }
    BuscarClientes(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { cpf, filters, dateFilter } = req.body;
            const ClientRepository = MkauthSource_1.default.getRepository(ClientesEntities_1.ClientesEntities);
            const whereConditions = {};
            if (cpf)
                whereConditions.cpf_cnpj = cpf;
            if (filters) {
                const { plano, vencimento, cli_ativado, nova_nfe } = filters;
                if (plano === null || plano === void 0 ? void 0 : plano.length)
                    whereConditions.plano = (0, typeorm_1.In)(plano);
                if (vencimento === null || vencimento === void 0 ? void 0 : vencimento.length)
                    whereConditions.venc = (0, typeorm_1.In)(vencimento);
                if (cli_ativado === null || cli_ativado === void 0 ? void 0 : cli_ativado.length)
                    whereConditions.cli_ativado = (0, typeorm_1.In)(["s"]);
                if (nova_nfe === null || nova_nfe === void 0 ? void 0 : nova_nfe.length)
                    whereConditions.tags = (0, typeorm_1.In)(nova_nfe);
            }
            try {
                const clientesResponse = yield ClientRepository.find({
                    where: whereConditions,
                    select: { login: true, cpf_cnpj: true, cli_ativado: true, desconto: true },
                    order: { id: "DESC" }
                });
                const faturasData = MkauthSource_1.default.getRepository(Faturas_1.Faturas);
                const now = new Date();
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                const startDate = dateFilter
                    ? new Date(dateFilter.start)
                    : firstDayOfMonth;
                const endDate = dateFilter ? new Date(dateFilter.end) : lastDayOfMonth;
                startDate.setHours(startDate.getHours() + 3);
                endDate.setHours(endDate.getHours() + 3);
                const faturasResponse = yield faturasData.find({
                    where: {
                        login: (0, typeorm_1.In)(clientesResponse.map((cliente) => cliente.login)),
                        datavenc: (0, typeorm_1.Between)(startDate, endDate),
                        datadel: (0, typeorm_1.IsNull)(),
                    },
                    select: {
                        id: true,
                        login: true,
                        datavenc: true,
                        tipo: true,
                        valor: true,
                    },
                    order: { id: "DESC" }
                });
                const clientesComFaturas = clientesResponse
                    .map((cliente) => {
                    const fatura = faturasResponse.filter((f) => f.login === cliente.login);
                    if (fatura.length === 0)
                        return null;
                    return Object.assign(Object.assign({}, cliente), { fatura: {
                            titulo: fatura.map((f) => f.id).join(", ") || null,
                            login: fatura.map((f) => f.login).join(", ") || null,
                            datavenc: fatura
                                .map((f) => new Date(f.datavenc).toLocaleDateString("pt-BR"))
                                .join(", ") || null,
                            tipo: fatura.map((f) => f.tipo).join(", ") || null,
                            valor: fatura.map((f) => (Number(f.valor) - (cliente.desconto || 0)).toFixed(2)).join(", ") || null,
                        } });
                })
                    .filter((cliente) => cliente !== null)
                    .sort((a, b) => (b.fatura.titulo || "").localeCompare(a.fatura.titulo || "")); // Ordenação por título
                ;
                res.status(200).json(clientesComFaturas);
            }
            catch (error) {
                res.status(500).json({ message: "Erro ao buscar clientes" });
            }
        });
    }
}
exports.default = new NFSEController();
