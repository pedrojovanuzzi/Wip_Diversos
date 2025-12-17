import axios from "axios";
import * as fs from "fs";
import * as https from "https";
import * as forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { processarCertificado } from "../../utils/certUtils";

export class FiorilliProvider {
  constructor(
    private certPath: string,
    private tempDir: string,
    private wsdlUrl: string
  ) {}

  private extrairChaveECertificado(password: string) {
    const pfxBuffer = fs.readFileSync(this.certPath);
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString("binary"));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    let privateKeyPem = "";
    let certificatePem = "";
    p12.safeContents.forEach((s) => {
      s.safeBags.forEach((b) => {
        if (b.type === forge.pki.oids.pkcs8ShroudedKeyBag && b.key) {
          privateKeyPem = forge.pki.privateKeyToPem(b.key);
        } else if (b.type === forge.pki.oids.certBag && b.cert) {
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

  assinarXml(xml: string, referenceId: string, password: string): string {
    const { privateKeyPem, x509Certificate } =
      this.extrairChaveECertificado(password);
    const keyInfoContent = `<X509Data><X509Certificate>${x509Certificate}</X509Certificate></X509Data>`;
    const signer = new SignedXml({
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

  async sendSoapRequest(
    soapXml: string,
    soapAction: string,
    password: string
  ): Promise<any> {
    const certPathToUse = processarCertificado(
      this.certPath,
      password,
      this.tempDir
    );
    const pfxBuffer = fs.readFileSync(certPathToUse);
    const httpsAgent = new https.Agent({
      pfx: pfxBuffer,
      passphrase: password,
      rejectUnauthorized: false,
    });

    console.log(soapXml);

    const response = await axios.post(this.wsdlUrl, soapXml, {
      httpsAgent,
      timeout: 600000, // 10 minutes
      headers: {
        "Content-Type": "text/xml; charset=UTF-8",
        SOAPAction: soapAction,
      },
    });

    // Clean up temporary cert file if needed, though processarCertificado logic typically handles its own lifecycle or reuse.
    // The original code was cleaning up explicitly in generateNFSE but reusing logic elsewhere.

    return response.data;
  }

  async sendSoapRequestSimple(
    soapXml: string,
    soapAction: string,
    password: string
  ): Promise<any> {
    // Similar to sendSoapRequest but meant for lighter calls if distinction needed,
    // currently reusing the same logic as the original 'verificaRps' etc also used full logic.
    return this.sendSoapRequest(soapXml, soapAction, password);
  }
}
