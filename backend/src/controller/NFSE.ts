import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as https from "https";
import { execSync } from "child_process";
import axios from "axios";
import * as libxmljs from "libxmljs";
import * as dotenv from "dotenv";
import { Request, Response } from "express";
import { SignedXml } from "xml-crypto";
import * as xmlbuilder from "xmlbuilder";
import * as forge from "node-forge";
import * as xml2js from "xml2js";

dotenv.config();

const rpsData = {
  numero: '1',
  serie: '999',
  tipo: '1',
  dataEmissao: '2025-01-03',
  status: '1',
  competencia: '2025-01-03',
  valor: '100.00',
  aliquota: '2.00',
  issRetido: '2',
  responsavelRetencao: '1',
  itemLista: '01.05',
  descricao: 'descricao do servico',
  municipio: '3504800',
  cnpj: '01001001000113',
  senha: '123456'
};


class NFSE {
  private certPath = path.resolve(__dirname, "../files/certificado.pfx");
  private WSDL_URL = "https://homologacao.ginfes.com.br/ServiceGinfesImpl";
  private TEMP_DIR = path.resolve(__dirname, "../files");
  private DECRYPTED_CERT_PATH = path.resolve(
    this.TEMP_DIR,
    "decrypted_certificado.tmp"
  );
  private NEW_CERT_PATH = path.resolve(this.TEMP_DIR, "new_certificado.pfx");

  public createRPS = async (req: Request, res: Response) => {
    try {
      const { password } = req.body;

      if (!password) {
        throw new Error("Senha do certificado não fornecida.");
      }

      const result = await this.enviarLoteRps(password);
      res.status(200).json({ mensagem: "RPS criado com sucesso!", result });
    } catch (error) {
      console.error("Erro ao criar o RPS:", error);
      res.status(500).json({ erro: "Erro ao criar o RPS." });
    }
  };

  public async enviarLoteRps(password: string) {
    try {
      if (!fs.existsSync(this.TEMP_DIR)) {
        fs.mkdirSync(this.TEMP_DIR, { recursive: true });
      }

      const isLinux = os.platform() === "linux";
      const isWindows = os.platform() === "win32";

      if (isLinux) {
        execSync(
          `openssl pkcs12 -in "${this.certPath}" -nodes -legacy -passin pass:${password} -out "${this.DECRYPTED_CERT_PATH}"`,
          { stdio: "inherit" }
        );
        execSync(
          `openssl pkcs12 -in "${this.DECRYPTED_CERT_PATH}" -export -out "${this.NEW_CERT_PATH}" -passout pass:${password}`,
          { stdio: "inherit" }
        );
      } else if (isWindows) {
        const powershellCommand = `
          $certificado = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('${this.certPath}', '${password}', [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable);
          $bytes = $certificado.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, '${password}');
          [System.IO.File]::WriteAllBytes('${this.NEW_CERT_PATH}', $bytes)
        `;
        execSync(
          `powershell -Command "${powershellCommand.replace(/\n/g, " ")}"`,
          { stdio: "inherit" }
        );
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

      const xmlLoteRps = this.gerarXmlLote();
      const signedXml = this.assinarXml(xmlLoteRps, certPathToUse, password);

      const response = await axios.post(this.WSDL_URL, signedXml, {
        httpsAgent,
        headers: {
          "Content-Type": "text/xml;charset=utf-8",
          SOAPAction: "EnviarLoteRpsEnvio",
        },
      });

      console.log(signedXml);

      console.log("Resposta do servidor:", response.data);

      if (fs.existsSync(this.NEW_CERT_PATH)) fs.unlinkSync(this.NEW_CERT_PATH);
      if (fs.existsSync(this.DECRYPTED_CERT_PATH))
        fs.unlinkSync(this.DECRYPTED_CERT_PATH);
    } catch (error) {
      console.error("Erro ao enviar requisição:", error);
    }
  }

  

  private gerarXmlLote() {
    const builder = xmlbuilder;

    const xml = builder.create('soapenv:Envelope', {
        version: '1.0', encoding: 'UTF-8'
    })
        .att('xmlns:soapenv', 'http://schemas.xmlsoap.org/soap/envelope/')
        .att('xmlns:ws', 'http://ws.issweb.fiorilli.com.br/')
        .att('xmlns:xd', 'http://www.w3.org/2000/09/xmldsig#')
        .ele('soapenv:Header').up()
        .ele('soapenv:Body')
        .ele('ws:gerarNfse')
        .ele('GerarNfseEnvio', { xmlns: 'http://www.abrasf.org.br/nfse.xsd' })
        .ele('Rps')
        .ele('InfDeclaracaoPrestacaoServico', { Id: 'rps000000000000001999' })
        .ele('Rps')
        .ele('IdentificacaoRps')
        .ele('Numero').txt(rpsData.numero).up()
        .ele('Serie').txt(rpsData.serie).up()
        .ele('Tipo').txt(rpsData.tipo).up()
        .up()
        .ele('DataEmissao').txt(rpsData.dataEmissao).up()
        .ele('Status').txt(rpsData.status).up()
        .up()
        .ele('Competencia').txt(rpsData.competencia).up()
        .ele('Servico')
        .ele('Valores')
        .ele('ValorServicos').txt(rpsData.valor).up()
        .ele('Aliquota').txt(rpsData.aliquota).up()
        .up()
        .ele('IssRetido').txt(rpsData.issRetido).up()
        .ele('ResponsavelRetencao').txt(rpsData.responsavelRetencao).up()
        .ele('ItemListaServico').txt(rpsData.itemLista).up()
        .ele('Discriminacao').txt(rpsData.descricao).up()
        .ele('CodigoMunicipio').txt(rpsData.municipio).up()
        .up()
        .up()
        .ele('username').txt(rpsData.cnpj).up()
        .ele('password').txt(rpsData.senha).up()
        .end({ pretty: true });

    return xml;
  }

  private assinarXml(xml: string, certPath: string, password: string): string {
    const pfxBuffer = fs.readFileSync(certPath);
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString("binary"));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    let privateKeyPem = "";
    let certificatePem = "";

    p12.safeContents.forEach((content) => {
      content.safeBags.forEach((bag) => {
        if (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag && bag.key) {
          privateKeyPem = forge.pki.privateKeyToPem(bag.key);
        } else if (bag.type === forge.pki.oids.certBag && bag.cert) {
          certificatePem = forge.pki.certificateToPem(bag.cert);
        }
      });
    });

    if (!privateKeyPem || !certificatePem) {
      throw new Error("Falha ao extrair chave privada ou certificado.");
    }

    const signer = new SignedXml({
      privateKey: privateKeyPem,
      publicCert: certificatePem,
    });

    signer.addReference({
      xpath: "//*[local-name(.)='InfDeclaracaoPrestacaoServico']",
      transforms: ["http://www.w3.org/2001/10/xml-exc-c14n#"],
      digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    });

    signer.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
    signer.canonicalizationAlgorithm =
      "http://www.w3.org/2001/10/xml-exc-c14n#";

    signer.computeSignature(xml);

    const signedXml = signer.getSignedXml();
    const signedDoc = libxmljs.parseXml(signedXml);

    const rpsElement = signedDoc.get("//*[local-name(.)='InfDeclaracaoPrestacaoServico']") as Element | null;


    if (!rpsElement) {
      throw new Error("Elemento Rps não encontrado no XML.");
    }

    const signatureElement = signedDoc.get(
      "//*[local-name(.)='Signature']"
    ) as Element | null;

    if (!signatureElement) {
      throw new Error("Assinatura não encontrada.");
    }

    if (rpsElement && signatureElement) {
      const parent = rpsElement.parentNode;
      if (parent && signatureElement) {
        const next = rpsElement.nextSibling;
        if (next) {
          parent.insertBefore(signatureElement, next);
        } else {
          parent.appendChild(signatureElement);
        }
      }
    } else {
      throw new Error("Elemento Rps ou assinatura não encontrado no XML.");
    }

    const finalXml = signedDoc.toString();
    console.log("XML assinado:", finalXml);

    return finalXml;
  }

  public async uploadCertificado(req: Request, res: Response) {
    try {
      res.status(200).json({ mensagem: "Certificado enviado com sucesso." });
    } catch (error) {
      // console.error("Erro ao processar o upload:", error);
      res
        .status(500)
        .json({ erro: "Erro ao processar o upload do certificado." });
    }
  }
}

export default new NFSE();
