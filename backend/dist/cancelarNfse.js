"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const node_forge_1 = __importDefault(require("node-forge"));
const xmlbuilder2_1 = require("xmlbuilder2");
const xml_crypto_1 = require("xml-crypto");
const CERT_PATH = "certificado.pfx";
const CERT_PWD = "senha_do_certificado";
const NFSE_NUMERO = "1146";
const ID_CANCEL = "CANCEL179";
const pfxBuffer = (0, fs_1.readFileSync)(CERT_PATH);
const pfxAsn1 = node_forge_1.default.asn1.fromDer(pfxBuffer.toString("binary"), false);
const pfx = node_forge_1.default.pkcs12.pkcs12FromAsn1(pfxAsn1, CERT_PWD);
const certBags = pfx.getBags({ bagType: node_forge_1.default.pki.oids.certBag })[node_forge_1.default.pki.oids.certBag];
const keyBags = pfx.getBags({ bagType: node_forge_1.default.pki.oids.pkcs8ShroudedKeyBag })[node_forge_1.default.pki.oids.pkcs8ShroudedKeyBag];
const certPem = node_forge_1.default.pki.certificateToPem(certBags[0].cert);
const keyPem = node_forge_1.default.pki.privateKeyToPem(keyBags[0].key);
const cancelDoc = (0, xmlbuilder2_1.create)({ version: "1.0", encoding: "UTF-8" })
    .ele("CancelarNfseEnvio", { xmlns: "http://www.abrasf.org.br/nfse.xsd" })
    .ele("Pedido")
    .ele("InfPedidoCancelamento", { Id: ID_CANCEL })
    .ele("IdentificacaoNfse")
    .ele("Numero").txt(NFSE_NUMERO).up()
    .ele("CpfCnpj")
    .ele("Cnpj").txt("20843290000142").up().up()
    .ele("InscricaoMunicipal").txt("2195-00/14").up()
    .ele("CodigoMunicipio").txt("3503406").up()
    .up()
    .ele("CodigoCancelamento").txt("2").up()
    .up()
    .up()
    .up();
const cancelXml = cancelDoc.end();
const signer = new xml_crypto_1.SignedXml({
    privateKey: keyPem,
    publicCert: certPem,
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
});
signer.addReference({
    xpath: "//*[local-name(.)='InfPedidoCancelamento']",
    transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
});
signer.computeSignature(cancelXml, {
    location: { reference: "//*[local-name(.)='InfPedidoCancelamento']", action: "append" },
});
const signedCancel = signer.getSignedXml();
const signedBuilder = (0, xmlbuilder2_1.create)(signedCancel);
const envelope = (0, xmlbuilder2_1.create)({ version: "1.0", encoding: "UTF-8" })
    .ele("soapenv:Envelope", {
    "xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
    "xmlns:ws": "http://ws.issweb.fiorilli.com.br/",
});
envelope.ele("soapenv:Header");
const body = envelope.ele("soapenv:Body");
const cancelar = body.ele("ws:cancelarNfse");
cancelar.import(signedBuilder);
cancelar.ele("username").txt("20843290000142");
cancelar.ele("password").txt("32961608");
const finalXml = envelope.end({ prettyPrint: true });
(0, fs_1.writeFileSync)("cancelamento-assinado.xml", finalXml);
console.log(finalXml);
