import { readFileSync, writeFileSync } from "fs";
import forge from "node-forge";
import { create } from "xmlbuilder2";
import { SignedXml } from "xml-crypto";

const CERT_PATH = "certificado.pfx";
const CERT_PWD = "senha_do_certificado";
const NFSE_NUMERO = "1146";
const ID_CANCEL = "CANCEL179";

let pfx: forge.pkcs12.Pkcs12Pfx;
try {
  const pfxBuffer = readFileSync(CERT_PATH);
  const pfxDer = forge.util.createBuffer(
    pfxBuffer.toString("binary"),
    "binary" as any
  );
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, CERT_PWD);
} catch {
  throw new Error(
    "Não foi possível carregar o certificado PFX. Verifique se o arquivo existe e se a senha está correta."
  );
}

const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]!;
const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]!;
const certPem = forge.pki.certificateToPem(certBags[0]!.cert!);
const keyPem = forge.pki.privateKeyToPem(keyBags[0]!.key!);

const cancelDoc = create({ version: "1.0", encoding: "UTF-8" })
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

const signer = new SignedXml({
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
const signedBuilder = create(signedCancel);

const envelope = create({ version: "1.0", encoding: "UTF-8" })
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
writeFileSync("cancelamento-assinado.xml", finalXml);
console.log(finalXml);
