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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const https = __importStar(require("https"));
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
const xml_crypto_1 = require("xml-crypto");
const forge = __importStar(require("node-forge"));
const xmldom_1 = require("xmldom");
const MkauthSource_1 = __importDefault(require("../database/MkauthSource"));
const DataSource_1 = __importDefault(require("../database/DataSource"));
const NFSE_1 = require("../entities/NFSE");
const ClientesEntities_1 = require("../entities/ClientesEntities");
const Faturas_1 = require("../entities/Faturas");
const typeorm_1 = require("typeorm");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const certUtils_1 = require("../utils/certUtils");
const xml2js_1 = require("xml2js");
dotenv.config();
class NFSEController {
    constructor() {
        this.certPath = path.resolve(__dirname, "../files/certificado.pfx");
        this.homologacao = process.env.SERVIDOR_HOMOLOGACAO === "true";
        this.WSDL_URL = this.homologacao
            ? "http://fi1.fiorilli.com.br:5663/IssWeb-ejb/IssWebWS/IssWebWS?wsdl"
            : "https://wsnfe.arealva.sp.gov.br:8443/IssWeb-ejb/IssWebWS/IssWebWS?wsdl";
        this.TEMP_DIR = path.resolve(__dirname, "../files");
        this.PASSWORD = "";
        this.DECRYPTED_CERT_PATH = path.join(this.TEMP_DIR, "decrypted_certificado.tmp");
        this.NEW_CERT_PATH = path.join(this.TEMP_DIR, "new_certificado.pfx");
        this.uploadCertificado = this.uploadCertificado.bind(this);
        this.iniciar = this.iniciar.bind(this);
        this.gerarNFSE = this.gerarNFSE.bind(this);
        this.gerarRpsXml = this.gerarRpsXml.bind(this);
        this.extrairChaveECertificado = this.extrairChaveECertificado.bind(this);
        this.assinarXml = this.assinarXml.bind(this);
        this.imprimirNFSE = this.imprimirNFSE.bind(this);
        this.verificaRps = this.verificaRps.bind(this);
        this.cancelarNfse = this.cancelarNfse.bind(this);
        this.setPassword = this.setPassword.bind(this);
        this.setNfseNumber = this.setNfseNumber.bind(this);
        this.setNfseStatus = this.setNfseStatus.bind(this);
        this.BuscarNSFE = this.BuscarNSFE.bind(this);
        this.BuscarNSFEDetalhes = this.BuscarNSFEDetalhes.bind(this);
        this.BuscarClientes = this.BuscarClientes.bind(this);
        this.removerAcentos = this.removerAcentos.bind(this);
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
    iniciar(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let { password, clientesSelecionados, aliquota, service, reducao } = req.body;
                this.PASSWORD = password;
                aliquota = (aliquota === null || aliquota === void 0 ? void 0 : aliquota.trim()) ? aliquota : "5.0000";
                aliquota = aliquota.replace(",", ".").replace("%", "");
                if (!service)
                    service = "Servico de Suporte Tecnico";
                if (!reducao)
                    reducao = 40;
                reducao = Number(reducao) / 100;
                const result = yield this.gerarNFSE(password, clientesSelecionados, "EnviarLoteRpsSincronoEnvio", aliquota, service, reducao);
                if (Array.isArray(result)) {
                    const ok = result.every((r) => r.status === "200");
                    if (ok)
                        res.status(200).json({ mensagem: "RPS criado com sucesso!", result });
                    else
                        res.status(500).json({ erro: "Erro ao criar o RPS." });
                }
                else {
                    // if (result?.status === "200") res.status(200).json({ mensagem: "RPS criado com sucesso!", result });
                    // else res.status(500).json({ erro: "Erro ao criar o RPS." });
                }
            }
            catch (_a) {
                res.status(500).json({ erro: "Erro ao criar o RPS." });
            }
        });
    }
    gerarNFSE(password, ids, SOAPAction, aliquota, service, reducao) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const certPathToUse = (0, certUtils_1.processarCertificado)(this.certPath, password, this.TEMP_DIR);
                const pfxBuffer = fs.readFileSync(certPathToUse);
                const httpsAgent = new https.Agent({
                    pfx: pfxBuffer,
                    passphrase: password,
                    rejectUnauthorized: false,
                });
                const NsfeData = DataSource_1.default.getRepository(NFSE_1.NFSE);
                const nfseResponse = yield NsfeData.find({
                    order: { id: "DESC" },
                    take: 1,
                });
                let nfseNumber = ((_a = nfseResponse[0]) === null || _a === void 0 ? void 0 : _a.numeroRps)
                    ? nfseResponse[0].numeroRps + 1
                    : 1;
                console.log(nfseNumber);
                const respArr = [];
                if (!fs.existsSync("log"))
                    fs.mkdirSync("log", { recursive: true });
                const logPath = "./log/xml_log.txt";
                for (let i = 0; i < ids.length; i += 50) {
                    const batch = ids.slice(i, i + 50);
                    let rpsXmls = "";
                    for (const bid of batch) {
                        // Gerar o XML do RPS sem assinatura
                        let rps = yield this.gerarRpsXml(bid, Number(aliquota).toFixed(4), service, reducao, nfseNumber, nfseResponse[0]);
                        // Assinar cada RPS individualmente
                        let signedRps = this.assinarXml(rps, "InfDeclaracaoPrestacaoServico");
                        // Remove a tag <Signature> se estiver em homologação
                        // if (this.homologacao) {
                        //   signedRps = signedRps.replace(/<Signature[^>]*>[\s\S]*?<\/Signature>/g, "");
                        // }
                        // Adicionar o RPS assinado na lista
                        rpsXmls += signedRps;
                        // Incrementar o número do RPS
                        nfseNumber++;
                        const RPSQuery = MkauthSource_1.default.getRepository(Faturas_1.Faturas);
                        const rpsData = yield RPSQuery.findOne({
                            where: { id: Number(bid) },
                        });
                        const ClientRepository = MkauthSource_1.default.getRepository(ClientesEntities_1.ClientesEntities);
                        const FaturasRepository = MkauthSource_1.default.getRepository(Faturas_1.Faturas);
                        const FaturasData = yield FaturasRepository.findOne({
                            where: { id: Number(bid) },
                        });
                        const ClientData = yield ClientRepository.findOne({
                            where: { login: FaturasData === null || FaturasData === void 0 ? void 0 : FaturasData.login },
                        });
                        const resp = yield axios_1.default.get(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${ClientData === null || ClientData === void 0 ? void 0 : ClientData.cidade}`);
                        const municipio = resp.data.id;
                        let valorMenosDesconto = (ClientData === null || ClientData === void 0 ? void 0 : ClientData.desconto)
                            ? Number(rpsData === null || rpsData === void 0 ? void 0 : rpsData.valor) - Number(ClientData === null || ClientData === void 0 ? void 0 : ClientData.desconto)
                            : Number(rpsData === null || rpsData === void 0 ? void 0 : rpsData.valor);
                        let valorReduzido = Number(reducao) === 0
                            ? valorMenosDesconto
                            : Number(valorMenosDesconto) * Number(reducao);
                        valorReduzido = Number(valorReduzido.toFixed(2));
                        const novoRegistro = NsfeData.create({
                            login: (rpsData === null || rpsData === void 0 ? void 0 : rpsData.login) || "",
                            numeroRps: nfseNumber - 1,
                            serieRps: ((_b = nfseResponse[0]) === null || _b === void 0 ? void 0 : _b.serieRps) || "",
                            tipoRps: ((_c = nfseResponse[0]) === null || _c === void 0 ? void 0 : _c.tipoRps) || 0,
                            dataEmissao: (rpsData === null || rpsData === void 0 ? void 0 : rpsData.processamento)
                                ? new Date(rpsData.processamento)
                                : new Date(),
                            competencia: (rpsData === null || rpsData === void 0 ? void 0 : rpsData.datavenc)
                                ? new Date(rpsData.datavenc)
                                : new Date(),
                            valorServico: valorReduzido || 0,
                            aliquota: Number(Number(aliquota).toFixed(4)),
                            issRetido: ((_d = nfseResponse[0]) === null || _d === void 0 ? void 0 : _d.issRetido) || 0,
                            responsavelRetencao: ((_e = nfseResponse[0]) === null || _e === void 0 ? void 0 : _e.responsavelRetencao) || 0,
                            itemListaServico: ((_f = nfseResponse[0]) === null || _f === void 0 ? void 0 : _f.itemListaServico) || "",
                            discriminacao: service,
                            codigoMunicipio: ((_g = nfseResponse[0]) === null || _g === void 0 ? void 0 : _g.codigoMunicipio) || 0,
                            exigibilidadeIss: ((_h = nfseResponse[0]) === null || _h === void 0 ? void 0 : _h.exigibilidadeIss) || 0,
                            cnpjPrestador: ((_j = nfseResponse[0]) === null || _j === void 0 ? void 0 : _j.cnpjPrestador) || "",
                            inscricaoMunicipalPrestador: ((_k = nfseResponse[0]) === null || _k === void 0 ? void 0 : _k.inscricaoMunicipalPrestador) || "",
                            cpfTomador: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.cpf_cnpj.replace(/[^0-9]/g, "")) || "",
                            razaoSocialTomador: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.nome) || "",
                            enderecoTomador: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.endereco) || "",
                            numeroEndereco: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.numero) || "",
                            complemento: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.complemento) || undefined,
                            bairro: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.bairro) || "",
                            uf: ((_l = nfseResponse[0]) === null || _l === void 0 ? void 0 : _l.uf) || "",
                            cep: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.cep.replace(/[^0-9]/g, "")) || "",
                            telefoneTomador: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.celular.replace(/[^0-9]/g, "")) || undefined,
                            emailTomador: (ClientData === null || ClientData === void 0 ? void 0 : ClientData.email) || undefined,
                            optanteSimplesNacional: 1,
                            incentivoFiscal: 2,
                        });
                        if (yield this.verificaRps(nfseNumber)) {
                            yield NsfeData.save(novoRegistro);
                            respArr.push({ status: "200", response: `RPS ${nfseNumber - 1} salvo com sucesso.` });
                        }
                        else {
                            respArr.push({ status: "500", response: `Erro ao salvar RPS ${nfseNumber - 1}` });
                        }
                    }
                    // Criar o LoteRps contendo todos os RPS assinados
                    let lote = `
    <LoteRps versao="2.01" Id="lote${nfseNumber}">
      <NumeroLote>1</NumeroLote>
      <CpfCnpj><Cnpj>${this.homologacao
                        ? process.env.MUNICIPIO_CNPJ_TEST
                        : process.env.MUNICIPIO_LOGIN}</Cnpj></CpfCnpj>
      <InscricaoMunicipal>${this.homologacao
                        ? process.env.MUNICIPIO_INCRICAO_TEST
                        : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal>
      <QuantidadeRps>${batch.length}</QuantidadeRps>
      <ListaRps>${rpsXmls}</ListaRps>
    </LoteRps>
  `;
                    lote = lote
                        .replace(/[\r\n]+/g, "")
                        .replace(/>\s+</g, "><")
                        .trim();
                    let envio = `<EnviarLoteRpsSincronoEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${lote}</EnviarLoteRpsSincronoEnvio>`;
                    let soap = `<?xml version="1.0" encoding="UTF-8"?>
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
          <soapenv:Header/>
          <soapenv:Body>
              <ws:recepcionarLoteRpsSincrono>
                  ${envio}
                  <username>${process.env.MUNICIPIO_LOGIN}</username>
                  <password>${process.env.MUNICIPIO_SENHA}</password>
              </ws:recepcionarLoteRpsSincrono>
          </soapenv:Body>
      </soapenv:Envelope>`;
                    // Remove todas as quebras de linha e espaços desnecessários
                    soap = soap
                        .replace(/[\r\n]+/g, "")
                        .replace(/>\s+</g, "><")
                        .trim();
                    // Salva o lote inteiro como uma linha única no arquivo de log
                    fs.appendFileSync(logPath, soap + "\n", "utf8");
                    const response = yield axios_1.default.post(this.WSDL_URL, soap, {
                        httpsAgent,
                        timeout: 600000,
                        headers: { "Content-Type": "text/xml; charset=UTF-8", SOAPAction },
                    });
                    const xml = response.data;
                    const parsed = yield (0, xml2js_1.parseStringPromise)(xml, { explicitArray: false });
                    console.log(response.data);
                    // Caminho até a resposta SOAP
                    const resposta = (_p = (_o = (_m = parsed === null || parsed === void 0 ? void 0 : parsed["soap:Envelope"]) === null || _m === void 0 ? void 0 : _m["soap:Body"]) === null || _o === void 0 ? void 0 : _o["ns3:recepcionarLoteRpsSincronoResponse"]) === null || _p === void 0 ? void 0 : _p["ns2:EnviarLoteRpsSincronoResposta"];
                    // Verifica se existe mensagem de erro
                    const temErro = (_q = resposta === null || resposta === void 0 ? void 0 : resposta.ListaMensagemRetornoLote) === null || _q === void 0 ? void 0 : _q.MensagemRetorno;
                    if (temErro) {
                        console.log("Erro detectado na resposta SOAP:", temErro);
                        respArr.push({ status: "500", response: "Erro na geração da NFSe", detalhes: temErro });
                        continue; // pula este lote, não insere no banco
                    }
                    console.log(response);
                    respArr.push({ status: "200", response: "ok" });
                }
                if (fs.existsSync(this.NEW_CERT_PATH))
                    fs.unlinkSync(this.NEW_CERT_PATH);
                if (fs.existsSync(this.DECRYPTED_CERT_PATH))
                    fs.unlinkSync(this.DECRYPTED_CERT_PATH);
                return respArr;
            }
            catch (error) {
                console.log(error);
                return { status: "500", response: error || "Erro" };
            }
        });
    }
    gerarRpsXml(id, aliquota, service, reducao, nfseNumber, nfseBase) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const ibge = yield axios_1.default.get(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${ClientData === null || ClientData === void 0 ? void 0 : ClientData.cidade}`);
            let val = (ClientData === null || ClientData === void 0 ? void 0 : ClientData.desconto)
                ? Number(rpsData === null || rpsData === void 0 ? void 0 : rpsData.valor) - Number(ClientData === null || ClientData === void 0 ? void 0 : ClientData.desconto)
                : Number(rpsData === null || rpsData === void 0 ? void 0 : rpsData.valor);
            val = val * reducao;
            val = Number(val.toFixed(2));
            let xml = `
      <Rps xmlns="http://www.abrasf.org.br/nfse.xsd">
        <InfDeclaracaoPrestacaoServico Id="RPS${rpsData === null || rpsData === void 0 ? void 0 : rpsData.uuid_lanc}">
          <Rps>
            <IdentificacaoRps>
              <Numero>${nfseNumber}</Numero>
              <Serie>${nfseBase === null || nfseBase === void 0 ? void 0 : nfseBase.serieRps}</Serie>
              <Tipo>${nfseBase === null || nfseBase === void 0 ? void 0 : nfseBase.tipoRps}</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${new Date()
                .toISOString()
                .substring(0, 10)}</DataEmissao>
            <Status>1</Status>
          </Rps>
          <Competencia>${new Date()
                .toISOString()
                .substring(0, 10)}</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>${val}</ValorServicos>
              <Aliquota>${this.homologacao ? "2.00" : aliquota}</Aliquota>
            </Valores>
            <IssRetido>${nfseBase === null || nfseBase === void 0 ? void 0 : nfseBase.issRetido}</IssRetido>
            <ResponsavelRetencao>${nfseBase === null || nfseBase === void 0 ? void 0 : nfseBase.responsavelRetencao}</ResponsavelRetencao>
            <ItemListaServico>${this.homologacao ? "17.01" : nfseBase === null || nfseBase === void 0 ? void 0 : nfseBase.itemListaServico}</ItemListaServico>
            <Discriminacao>${service}</Discriminacao>
            <CodigoMunicipio>3503406</CodigoMunicipio>
            <ExigibilidadeISS>${nfseBase === null || nfseBase === void 0 ? void 0 : nfseBase.exigibilidadeIss}</ExigibilidadeISS>
          </Servico>
          <Prestador>
            <CpfCnpj><Cnpj>${this.homologacao
                ? process.env.MUNICIPIO_CNPJ_TEST
                : process.env.MUNICIPIO_LOGIN}</Cnpj></CpfCnpj>
            <InscricaoMunicipal>${this.homologacao
                ? process.env.MUNICIPIO_INCRICAO_TEST
                : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal>
          </Prestador>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>
                <${(ClientData === null || ClientData === void 0 ? void 0 : ClientData.cpf_cnpj.length) === 11 ? "Cpf" : "Cnpj"}>${ClientData === null || ClientData === void 0 ? void 0 : ClientData.cpf_cnpj.replace(/[^0-9]/g, "")}</${(ClientData === null || ClientData === void 0 ? void 0 : ClientData.cpf_cnpj.length) === 11 ? "Cpf" : "Cnpj"}>
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${ClientData === null || ClientData === void 0 ? void 0 : ClientData.nome}</RazaoSocial>
            <Endereco>
              <Endereco>${this.removerAcentos(ClientData === null || ClientData === void 0 ? void 0 : ClientData.endereco)}</Endereco>
              <Numero>${ClientData === null || ClientData === void 0 ? void 0 : ClientData.numero}</Numero>
              <Complemento>${ClientData === null || ClientData === void 0 ? void 0 : ClientData.complemento}</Complemento>
              <Bairro>${ClientData === null || ClientData === void 0 ? void 0 : ClientData.bairro}</Bairro>
              <CodigoMunicipio>${ibge.data.id}</CodigoMunicipio>
              <Uf>SP</Uf>
              <Cep>${ClientData === null || ClientData === void 0 ? void 0 : ClientData.cep.replace(/[^0-9]/g, "")}</Cep>
            </Endereco>
            <Contato>
              <Telefone>${ClientData === null || ClientData === void 0 ? void 0 : ClientData.celular.replace(/[^0-9]/g, "")}</Telefone>
              <Email>${this.homologacao ? "teste@gmail.com" : ClientData === null || ClientData === void 0 ? void 0 : ClientData.email}</Email>
            </Contato>
          </Tomador>
          ${this.homologacao
                ? ""
                : "<RegimeEspecialTributacao>6</RegimeEspecialTributacao>"}
          <OptanteSimplesNacional>${this.homologacao ? "2" : nfseBase === null || nfseBase === void 0 ? void 0 : nfseBase.optanteSimplesNacional}</OptanteSimplesNacional>
          <IncentivoFiscal>${nfseBase === null || nfseBase === void 0 ? void 0 : nfseBase.incentivoFiscal}</IncentivoFiscal>
        </InfDeclaracaoPrestacaoServico>
      </Rps>
    `;
            return xml
                .replace(/[\r\n]+/g, "")
                .replace(/>\s+</g, "><")
                .trim();
        });
    }
    extrairChaveECertificado() {
        const pfxBuffer = fs.readFileSync(this.certPath);
        const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString("binary"));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.PASSWORD);
        let privateKeyPem = "";
        let certificatePem = "";
        p12.safeContents.forEach((s) => {
            s.safeBags.forEach((b) => {
                if (b.type === forge.pki.oids.pkcs8ShroudedKeyBag && b.key) {
                    privateKeyPem = forge.pki.privateKeyToPem(b.key);
                }
                else if (b.type === forge.pki.oids.certBag && b.cert) {
                    certificatePem = forge.pki.certificateToPem(b.cert);
                }
            });
        });
        const x509Certificate = certificatePem
            .replace(/-----BEGIN CERTIFICATE-----/g, "")
            .replace(/-----END CERTIFICATE-----/g, "")
            .replace(/\s+/g, "");
        return { privateKeyPem, x509Certificate };
    }
    assinarXml(xml, referenceId) {
        const { privateKeyPem, x509Certificate } = this.extrairChaveECertificado();
        const keyInfoContent = `<X509Data><X509Certificate>${x509Certificate}</X509Certificate></X509Data>`;
        const signer = new xml_crypto_1.SignedXml({
            implicitTransforms: ["http://www.w3.org/TR/2001/REC-xml-c14n-20010315"],
            privateKey: privateKeyPem,
            publicCert: x509Certificate,
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
        signer.computeSignature(xml, {
            location: {
                reference: `//*[local-name(.)='${referenceId}']`,
                action: "after",
            },
        });
        return signer.getSignedXml();
    }
    imprimirNFSE(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { rpsNumber } = req.body;
            const result = yield Promise.all(rpsNumber.map((rps) => this.BuscarNSFEDetalhes(rps)));
            res.status(200).json(result);
        });
    }
    verificaRps(rpsNumber, serie = "1", tipo = "1") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const dados = `<IdentificacaoRps><Numero>${rpsNumber}</Numero><Serie>${serie}</Serie><Tipo>${tipo}</Tipo></IdentificacaoRps><Prestador><CpfCnpj><Cnpj>${this.homologacao
                    ? process.env.MUNICIPIO_CNPJ_TEST
                    : process.env.MUNICIPIO_LOGIN}</Cnpj></CpfCnpj><InscricaoMunicipal>${this.homologacao
                    ? process.env.MUNICIPIO_INCRICAO_TEST
                    : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal></Prestador>`;
                const envioXml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`;
                const soapFinal = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`
                    .replace(/[\r\n]+/g, "")
                    .replace(/\s{2,}/g, " ")
                    .replace(/>\s+</g, "><")
                    .trim();
                const certPathToUse = (0, certUtils_1.processarCertificado)(this.certPath, this.PASSWORD, this.TEMP_DIR);
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
                if (response.data.includes("<ns2:Codigo>E92</ns2:Codigo>"))
                    return true;
                return false;
            }
            catch (_a) {
                return false;
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
                const arr = yield Promise.all(rpsNumber.map((rps) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.setNfseNumber(rps);
                        const nfseNumber = yield this.setNfseNumber(rps);
                        const dados = `<Pedido><InfPedidoCancelamento Id="CANCEL${nfseNumber}"><IdentificacaoNfse><Numero>${nfseNumber}</Numero><CpfCnpj><Cnpj>${this.homologacao
                            ? process.env.MUNICIPIO_CNPJ_TEST
                            : process.env.MUNICIPIO_LOGIN}</Cnpj></CpfCnpj><InscricaoMunicipal>${this.homologacao
                            ? process.env.MUNICIPIO_INCRICAO_TEST
                            : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal><CodigoMunicipio>3503406</CodigoMunicipio></IdentificacaoNfse><CodigoCancelamento>2</CodigoCancelamento></InfPedidoCancelamento></Pedido>`;
                        const envioXml = `<CancelarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</CancelarNfseEnvio>`;
                        const envioXmlAssinado = this.assinarXml(envioXml, "InfPedidoCancelamento");
                        const soapFinal = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:cancelarNfse>${envioXmlAssinado}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:cancelarNfse></soapenv:Body></soapenv:Envelope>`
                            .replace(/[\r\n]+/g, "")
                            .replace(/\s{2,}/g, " ")
                            .replace(/>\s+</g, "><")
                            .trim();
                        const soapFinalHomologacao = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:cancelarNfse>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:cancelarNfse></soapenv:Body></soapenv:Envelope>`
                            .replace(/[\r\n]+/g, "")
                            .replace(/\s{2,}/g, " ")
                            .replace(/>\s+</g, "><")
                            .trim();
                        const certPathToUse = (0, certUtils_1.processarCertificado)(this.certPath, this.PASSWORD, this.TEMP_DIR);
                        const pfxBuffer = fs.readFileSync(certPathToUse);
                        const httpsAgent = new https.Agent({
                            pfx: pfxBuffer,
                            passphrase: this.PASSWORD,
                            rejectUnauthorized: false,
                        });
                        let response;
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
                        return { rps, success: true, response: response.data };
                    }
                    catch (error) {
                        return { rps, success: false, error };
                    }
                })));
                res.status(200).json(arr);
            }
            catch (_a) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
    }
    setPassword(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { password } = req.body;
            this.PASSWORD = password;
            res.status(200).json({ error: "Sucesso" });
        });
    }
    setNfseNumber(rpsNumber, serie = "1", tipo = "1") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const dados = `<IdentificacaoRps><Numero>${rpsNumber}</Numero><Serie>${serie}</Serie><Tipo>${tipo}</Tipo></IdentificacaoRps><Prestador><CpfCnpj><Cnpj>${this.homologacao
                    ? process.env.MUNICIPIO_CNPJ_TEST
                    : process.env.MUNICIPIO_LOGIN}</Cnpj></CpfCnpj><InscricaoMunicipal>${this.homologacao
                    ? process.env.MUNICIPIO_INCRICAO_TEST
                    : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal></Prestador>`;
                const envioXml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`;
                const soapFinal = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`;
                const certPathToUse = (0, certUtils_1.processarCertificado)(this.certPath, this.PASSWORD, this.TEMP_DIR);
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
                console.log("Setado Status NFSE: RPS: " + rpsNumber);
                const match = response.data.match(/<ns2:Numero>(\d+)<\/ns2:Numero>/);
                if (match && match[1])
                    return match[1];
                return null;
            }
            catch (error) {
                return error;
            }
        });
    }
    setNfseStatus(rpsNumber, serie = "1", tipo = "1") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const dados = `<IdentificacaoRps><Numero>${rpsNumber}</Numero><Serie>${serie}</Serie><Tipo>${tipo}</Tipo></IdentificacaoRps><Prestador><CpfCnpj><Cnpj>${this.homologacao
                    ? process.env.MUNICIPIO_CNPJ_TEST
                    : process.env.MUNICIPIO_LOGIN}</Cnpj></CpfCnpj><InscricaoMunicipal>${this.homologacao
                    ? process.env.MUNICIPIO_INCRICAO_TEST
                    : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal></Prestador>`;
                const envioXml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`;
                const soapFinal = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`
                    .replace(/[\r\n]+/g, "")
                    .replace(/\s{2,}/g, " ")
                    .replace(/>\s+</g, "><")
                    .trim();
                const certPathToUse = (0, certUtils_1.processarCertificado)(this.certPath, this.PASSWORD, this.TEMP_DIR);
                const pfxBuffer = fs.readFileSync(certPathToUse);
                const httpsAgent = new https.Agent({
                    pfx: pfxBuffer,
                    passphrase: this.PASSWORD,
                    rejectUnauthorized: false,
                });
                const response = yield axios_1.default.post(this.WSDL_URL, soapFinal, {
                    httpsAgent,
                    timeout: 600000,
                    headers: {
                        "Content-Type": "text/xml; charset=UTF-8",
                        SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
                    },
                });
                if (response.data.includes('<ns2:NfseCancelamento versao="2.0">'))
                    return true;
                return false;
            }
            catch (_a) {
                return false;
            }
        });
    }
    BuscarNSFE(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { cpf, filters, dateFilter } = req.body;
                const w = {};
                if (cpf)
                    w.cpf_cnpj = cpf;
                if (filters) {
                    const { plano, vencimento, cli_ativado, nova_nfe } = filters;
                    if (plano === null || plano === void 0 ? void 0 : plano.length)
                        w.plano = (0, typeorm_1.In)(plano);
                    if (vencimento === null || vencimento === void 0 ? void 0 : vencimento.length)
                        w.venc = (0, typeorm_1.In)(vencimento);
                    if (cli_ativado === null || cli_ativado === void 0 ? void 0 : cli_ativado.length)
                        w.cli_ativado = (0, typeorm_1.In)(["s"]);
                    if (nova_nfe === null || nova_nfe === void 0 ? void 0 : nova_nfe.length)
                        w.tags = (0, typeorm_1.In)(nova_nfe);
                }
                const ClientRepository = MkauthSource_1.default.getRepository(ClientesEntities_1.ClientesEntities);
                const clientesResponse = yield ClientRepository.find({
                    where: w,
                    select: { login: true, cpf_cnpj: true, cli_ativado: true },
                });
                const now = new Date();
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                const startDate = dateFilter
                    ? new Date(dateFilter.start)
                    : firstDayOfMonth;
                const endDate = dateFilter ? new Date(dateFilter.end) : lastDayOfMonth;
                startDate.setHours(startDate.getHours() + 3);
                endDate.setHours(endDate.getHours() + 3);
                const nfseData = DataSource_1.default.getRepository(NFSE_1.NFSE);
                const nfseResponse = yield nfseData.find({
                    where: {
                        login: (0, typeorm_1.In)(clientesResponse.map((c) => c.login)),
                        competencia: (0, typeorm_1.Between)(startDate, endDate),
                    },
                    order: { id: "DESC" },
                });
                const arr = yield Promise.all(clientesResponse.map((c) => __awaiter(this, void 0, void 0, function* () {
                    const nfseDoCliente = nfseResponse.filter((nf) => nf.login === c.login);
                    const nfseValidas = [];
                    const nfseNumberArray = [];
                    for (const nf of nfseDoCliente) {
                        const isCancelada = yield this.setNfseStatus(nf.numeroRps);
                        if (!isCancelada) {
                            nfseValidas.push(nf);
                            const numeroNfse = yield this.setNfseNumber(nf.numeroRps);
                            nfseNumberArray.push(numeroNfse);
                        }
                    }
                    if (!nfseValidas.length)
                        return null;
                    return Object.assign(Object.assign({}, c), { nfse: {
                            id: nfseValidas.map((nf) => nf.id).join(", ") || null,
                            login: nfseValidas.map((nf) => nf.login).join(", ") || null,
                            numero_rps: nfseValidas.map((nf) => nf.numeroRps).join(", ") || null,
                            serie_rps: nfseValidas.map((nf) => nf.serieRps).join(", ") || null,
                            tipo_rps: nfseValidas.map((nf) => nf.tipoRps).join(", ") || null,
                            data_emissao: nfseValidas
                                .map((nf) => moment_timezone_1.default
                                .tz(nf.dataEmissao, "America/Sao_Paulo")
                                .format("DD/MM/YYYY"))
                                .join(", ") || null,
                            competencia: nfseValidas
                                .map((nf) => moment_timezone_1.default
                                .tz(nf.competencia, "America/Sao_Paulo")
                                .format("DD/MM/YYYY"))
                                .join(", ") || null,
                            valor_servico: nfseValidas.map((nf) => nf.valorServico).join(", ") || null,
                            aliquota: nfseValidas.map((nf) => nf.aliquota).join(", ") || null,
                            iss_retido: nfseValidas.map((nf) => nf.issRetido).join(", ") || null,
                            responsavel_retecao: nfseValidas.map((nf) => nf.responsavelRetencao).join(", ") || null,
                            item_lista_servico: nfseValidas.map((nf) => nf.itemListaServico).join(", ") || null,
                            discriminacao: nfseValidas.map((nf) => nf.discriminacao).join(", ") || null,
                            codigo_municipio: nfseValidas.map((nf) => nf.codigoMunicipio).join(", ") || null,
                            exigibilidade_iss: nfseValidas.map((nf) => nf.exigibilidadeIss).join(", ") || null,
                            cnpj_prestador: nfseValidas.map((nf) => nf.cnpjPrestador).join(", ") || null,
                            inscricao_municipal_prestador: nfseValidas.map((nf) => nf.inscricaoMunicipalPrestador).join(", ") || null,
                            cpf_tomador: nfseValidas.map((nf) => nf.cpfTomador).join(", ") || null,
                            razao_social_tomador: nfseValidas.map((nf) => nf.razaoSocialTomador).join(", ") || null,
                            endereco_tomador: nfseValidas.map((nf) => nf.enderecoTomador).join(", ") || null,
                            numero_endereco: nfseValidas.map((nf) => nf.numeroEndereco).join(", ") || null,
                            complemento: nfseValidas.map((nf) => nf.complemento).join(", ") || null,
                            bairro: nfseValidas.map((nf) => nf.bairro).join(", ") || null,
                            uf: nfseValidas.map((nf) => nf.uf).join(", ") || null,
                            cep: nfseValidas.map((nf) => nf.cep).join(", ") || null,
                            telefone_tomador: nfseValidas.map((nf) => nf.telefoneTomador).join(", ") || null,
                            email_tomador: nfseValidas.map((nf) => nf.emailTomador).join(", ") || null,
                            optante_simples_nacional: nfseValidas.map((nf) => nf.optanteSimplesNacional).join(", ") || null,
                            incentivo_fiscal: nfseValidas.map((nf) => nf.incentivoFiscal).join(", ") || null,
                            status: "Ativa",
                            numeroNfse: nfseNumberArray.join(", ") || null,
                        } });
                })));
                const filtered = arr
                    .filter((i) => i !== null) // Remove nulls corretamente
                    .sort((a, b) => { var _a, _b; return (((_a = b === null || b === void 0 ? void 0 : b.nfse) === null || _a === void 0 ? void 0 : _a.id) || "").localeCompare(((_b = a === null || a === void 0 ? void 0 : a.nfse) === null || _b === void 0 ? void 0 : _b.id) || ""); });
                res.status(200).json(filtered);
            }
            catch (_a) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
    }
    BuscarNSFEDetalhes(rpsNumber, serie = "1", tipo = "1") {
        var _a, _b, _c, _d, _e, _f, _g;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const dados = `<IdentificacaoRps><Numero>${rpsNumber}</Numero><Serie>${serie}</Serie><Tipo>${tipo}</Tipo></IdentificacaoRps><Prestador><CpfCnpj><Cnpj>${this.homologacao
                    ? process.env.MUNICIPIO_CNPJ_TEST
                    : process.env.MUNICIPIO_LOGIN}</Cnpj></CpfCnpj><InscricaoMunicipal>${this.homologacao
                    ? process.env.MUNICIPIO_INCRICAO_TEST
                    : process.env.MUNICIPIO_INCRICAO}</InscricaoMunicipal></Prestador>`;
                const envioXml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`;
                const soapFinal = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`
                    .replace(/[\r\n]+/g, "")
                    .replace(/\s{2,}/g, " ")
                    .replace(/>\s+</g, "><")
                    .trim();
                const certPathToUse = (0, certUtils_1.processarCertificado)(this.certPath, this.PASSWORD, this.TEMP_DIR);
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
                        const r = {};
                        for (let i = 0; i < node.childNodes.length; i++) {
                            const c = node.childNodes[i];
                            if (c.nodeType === 1) {
                                const el = c;
                                const k = el.localName;
                                const txt = ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || "";
                                if (el.childNodes.length > 0 &&
                                    Array.from(el.childNodes).some((a) => a.nodeType === 1))
                                    r[k] = extractChildren(el);
                                else
                                    r[k] = txt;
                            }
                        }
                        return r;
                    };
                    extractedData[nfseNode.localName] = extractChildren(nfseNode);
                    const uf = (_g = (_f = (_e = (_d = (_c = (_b = (_a = extractedData.CompNfse) === null || _a === void 0 ? void 0 : _a.Nfse) === null || _b === void 0 ? void 0 : _b.InfNfse) === null || _c === void 0 ? void 0 : _c.DeclaracaoPrestacaoServico) === null || _d === void 0 ? void 0 : _d.InfDeclaracaoPrestacaoServico) === null || _e === void 0 ? void 0 : _e.Tomador) === null || _f === void 0 ? void 0 : _f.Endereco) === null || _g === void 0 ? void 0 : _g.CodigoMunicipio;
                    if (uf) {
                        const ibgeResponse = yield axios_1.default
                            .get(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${uf}`, { timeout: 1000 })
                            .catch(() => ({ data: { nome: "" } }));
                        extractedData.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Tomador.Endereco.Cidade =
                            ibgeResponse.data.nome;
                    }
                    return { status: "success", data: extractedData };
                }
                else {
                    return {
                        status: "error",
                        message: "InfNfse element not found in XML.",
                    };
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
    removerAcentos(texto) {
        return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    BuscarClientes(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { cpf, filters, dateFilter } = req.body;
            const ClientRepository = MkauthSource_1.default.getRepository(ClientesEntities_1.ClientesEntities);
            const w = {};
            let servicosFilter = ["mensalidade"];
            if (cpf)
                w.cpf_cnpj = cpf;
            if (filters) {
                let { plano, vencimento, cli_ativado, SCM, servicos } = filters;
                if (plano === null || plano === void 0 ? void 0 : plano.length)
                    w.plano = (0, typeorm_1.In)(plano);
                if (vencimento === null || vencimento === void 0 ? void 0 : vencimento.length)
                    w.venc = (0, typeorm_1.In)(vencimento);
                if (cli_ativado === null || cli_ativado === void 0 ? void 0 : cli_ativado.length)
                    w.cli_ativado = (0, typeorm_1.In)(["s"]);
                if (SCM === null || SCM === void 0 ? void 0 : SCM.length) {
                    w.vendedor = (0, typeorm_1.In)(SCM);
                }
                else {
                    w.vendedor = (0, typeorm_1.In)(["SVA"]);
                }
                if (servicos === null || servicos === void 0 ? void 0 : servicos.length)
                    servicosFilter = servicos;
            }
            try {
                const clientesResponse = yield ClientRepository.find({
                    where: w,
                    select: {
                        login: true,
                        cpf_cnpj: true,
                        cli_ativado: true,
                        desconto: true,
                    },
                    order: { id: "DESC" },
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
                        login: (0, typeorm_1.In)(clientesResponse.map((c) => c.login)),
                        datavenc: (0, typeorm_1.Between)(startDate, endDate),
                        datadel: (0, typeorm_1.IsNull)(),
                        tipo: (0, typeorm_1.In)(servicosFilter),
                    },
                    select: {
                        id: true,
                        login: true,
                        datavenc: true,
                        tipo: true,
                        valor: true,
                    },
                    order: { id: "DESC" },
                });
                const arr = clientesResponse
                    .map((cliente) => {
                    const fat = faturasResponse.filter((f) => f.login === cliente.login);
                    if (!fat.length)
                        return null;
                    return Object.assign(Object.assign({}, cliente), { fatura: {
                            titulo: fat.map((f) => f.id).join(", ") || null,
                            login: fat.map((f) => f.login).join(", ") || null,
                            datavenc: fat
                                .map((f) => new Date(f.datavenc).toLocaleDateString("pt-BR"))
                                .join(", ") || null,
                            tipo: fat.map((f) => f.tipo).join(", ") || null,
                            valor: fat
                                .map((f) => (Number(f.valor) - (cliente.desconto || 0)).toFixed(2))
                                .join(", ") || null,
                        } });
                })
                    .filter((i) => i !== null)
                    .sort((a, b) => { var _a, _b; return (((_a = b === null || b === void 0 ? void 0 : b.fatura) === null || _a === void 0 ? void 0 : _a.titulo) || "").localeCompare(((_b = a === null || a === void 0 ? void 0 : a.fatura) === null || _b === void 0 ? void 0 : _b.titulo) || ""); });
                res.status(200).json(arr);
            }
            catch (_a) {
                res.status(500).json({ message: "Erro ao buscar clientes" });
            }
        });
    }
}
exports.default = new NFSEController();
