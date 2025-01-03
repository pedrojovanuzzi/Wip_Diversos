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

dotenv.config();

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
    return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
<soapenv:Header/>
<soapenv:Body>
<ws:gerarNfse>
<GerarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
<Rps xmlns="http://www.abrasf.org.br/nfse.xsd">
<InfDeclaracaoPrestacaoServico Id="rps000000000000001999">
<Rps>
<IdentificacaoRps>
<Numero>1</Numero>
<Serie>999</Serie>
<Tipo>1</Tipo>
</IdentificacaoRps>
<DataEmissao>2013-05-13</DataEmissao>
<Status>1</Status>
</Rps>
<Competencia>2013-05-13</Competencia>
<Servico>
<Valores>
<ValorServicos>100.00</ValorServicos>
<Aliquota>2.0000</Aliquota>
</Valores>
<IssRetido>2</IssRetido>
<ResponsavelRetencao>1</ResponsavelRetencao>
<ItemListaServico>01.05</ItemListaServico>
<Discriminacao>descricao do servico</Discriminacao>
<CodigoMunicipio>3504800</CodigoMunicipio>
<CodigoPais>1058</CodigoPais>
<ExigibilidadeISS>1</ExigibilidadeISS>
<MunicipioIncidencia>3504800</MunicipioIncidencia>
</Servico>
<Prestador>
<CpfCnpj>
<Cnpj>01001001000113</Cnpj>
</CpfCnpj>
<InscricaoMunicipal>1.000.10</InscricaoMunicipal>
</Prestador>
<Tomador>
<IdentificacaoTomador>
<CpfCnpj>
<Cpf>27600930854</Cpf>
</CpfCnpj>
</IdentificacaoTomador>
<RazaoSocial>Ivan Moraes</RazaoSocial>
<Endereco>
<Endereco>Av Jose Goncalves</Endereco>
<Numero>93</Numero>
<Complemento>Casa</Complemento>
<Bairro>Santa Rosa</Bairro>
<CodigoMunicipio>3505203</CodigoMunicipio>
<Uf>SP</Uf>
<CodigoPais>1058</CodigoPais>
<Cep>17250000</Cep>
</Endereco>
<Contato>
<Telefone>36620000</Telefone>
<Email>ivantgm@gmail.com</Email>
</Contato>
</Tomador>
<OptanteSimplesNacional>2</OptanteSimplesNacional>
<IncentivoFiscal>2</IncentivoFiscal>
</InfDeclaracaoPrestacaoServico>
</Rps>
</GerarNfseEnvio>
<username>01001001000113</username>
<password>123456</password>
</ws:gerarNfse>
</soapenv:Body>
</soapenv:Envelope>`;
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
