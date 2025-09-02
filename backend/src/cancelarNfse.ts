import dotenv from "dotenv";
import { readFileSync, writeFileSync } from "fs";
import forge from "node-forge";
import { create } from "xmlbuilder2";
import { SignedXml } from "xml-crypto";
import path from "path";
import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";


dotenv.config({ path: path.join(__dirname, "..", ".env") });




export function processarCertificado(certPath: string, password: string, tempDir: string) {
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const DECRYPTED_CERT_PATH = path.join(tempDir, "decrypted_certificado.tmp");
  const NEW_CERT_PATH = path.join(tempDir, "new_certificado.pfx");

  const isLinux = os.platform() === "linux";
  const isWindows = os.platform() === "win32";

  try {
    if (isLinux) {
      execSync(
        `openssl pkcs12 -in "${certPath}" -nodes -legacy -passin pass:${password} -out "${DECRYPTED_CERT_PATH}"`,
        { stdio: "inherit" }
      );
      execSync(
        `openssl pkcs12 -in "${DECRYPTED_CERT_PATH}" -export -out "${NEW_CERT_PATH}" -passout pass:${password}`,
        { stdio: "inherit" }
      );
    } else if (isWindows) {
      const powershellCommand = `
            try {
              $certificado = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('${certPath}', '${password}', [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable);
              $bytes = $certificado.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, '${password}');
              [System.IO.File]::WriteAllBytes('${NEW_CERT_PATH}', $bytes)
            } catch {
              Write-Error $_.Exception.Message
              exit 1
            }
          `;
      execSync(`powershell -Command "${powershellCommand.replace(/\n/g, " ")}"`, { stdio: ["ignore", "inherit", "pipe"] });
    }

    return NEW_CERT_PATH;
  } catch (error) {
    console.error("❌ Erro ao processar o certificado:", error);
    return certPath; // Retorna o original caso falhe
  }
}



const CERT_PATH = path.join(__dirname, '/files', 'certificado.pfx');
const CERT_PWD = process.env.CANCELAR_NFSE_SENHA;
const NFSE_NUMERO = "1146";
const ID_CANCEL = "CANCEL179";

console.log(CERT_PATH);


let pfx: forge.pkcs12.Pkcs12Pfx;
try {
  const pfxBuffer = readFileSync(CERT_PATH);
  const pfxDer = forge.util.createBuffer(
    pfxBuffer.toString("binary"),
    "binary" as any
  );
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, CERT_PWD);
} catch (error){
  throw new Error(
    error as string
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

cancelar.ele("username").txt(process.env.MUNICIPIO_LOGIN as string);
cancelar.ele("password").txt(process.env.MUNICIPIO_SENHA as string);

const finalXml = envelope.end({ prettyPrint: true });
writeFileSync("cancelamento-assinado.xml", finalXml);
console.log(finalXml);
