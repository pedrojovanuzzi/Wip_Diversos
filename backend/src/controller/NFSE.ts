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
  private XSD_PATH = path.resolve(__dirname, "../files/schema nfse v2-04.xsd");
  private TEMP_DIR = path.resolve(__dirname, "../files");
  private DECRYPTED_CERT_PATH = path.resolve(this.TEMP_DIR, "decrypted_certificado.tmp");
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
      // console.error("Erro ao criar o RPS:", error);
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
        execSync(`powershell -Command "${powershellCommand.replace(/\n/g, " ")}"`, { stdio: "inherit" });
      }

      const certPathToUse = fs.existsSync(this.NEW_CERT_PATH) ? this.NEW_CERT_PATH : this.certPath;
      const pfxBuffer = fs.readFileSync(certPathToUse);

      const httpsAgent = new https.Agent({
        pfx: pfxBuffer,
        passphrase: password,
        rejectUnauthorized: false,
      });

      const xmlLoteRps = this.gerarXmlLote();
      const signedXml = this.assinarXml(xmlLoteRps, certPathToUse, password);

      const soapEnvelope = xmlbuilder.create({
        'soapenv:Envelope': {
          '@xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
          'soapenv:Header': {},
          'soapenv:Body': {
            'tns:RecepcionarLoteRpsV3': {
              '@xmlns:tns': 'http://homologacao.ginfes.com.br',
              'tns:arg0': signedXml,
            },
          },
        },
      }).end({ pretty: true });
      

      const response = await axios.post(this.WSDL_URL, soapEnvelope, {
        httpsAgent,
        headers: {
          "Content-Type": "text/xml;charset=utf-8",
          SOAPAction: "RecepcionarLoteRpsV3",
        },
      });

      console.log("Resposta do servidor:", response.data);

      if (fs.existsSync(this.NEW_CERT_PATH)) fs.unlinkSync(this.NEW_CERT_PATH);
      if (fs.existsSync(this.DECRYPTED_CERT_PATH)) fs.unlinkSync(this.DECRYPTED_CERT_PATH);

    } catch (error) {
      // console.error("Erro ao enviar requisição:", error);
    }
  }

  private gerarXmlLote() {
    return `
    <?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.abrasf.org.br/nfse.xsd nfse.xsd">
    <LoteRps Id="Lote_12345" versao="1.00">
        <NumeroLote>12345</NumeroLote>
        <Prestador>
            <CpfCnpj>
                <Cnpj>12345678000195</Cnpj>
            </CpfCnpj>
            <InscricaoMunicipal>123456</InscricaoMunicipal>
        </Prestador>
        <QuantidadeRps>1</QuantidadeRps>
        <ListaRps>
            <Rps>
                <InfDeclaracaoPrestacaoServico Id="Rps_123">
                    <Rps>
                        <IdentificacaoRps>
                            <Numero>123</Numero>
                            <Serie>001</Serie>
                            <Tipo>1</Tipo>
                        </IdentificacaoRps>
                        <DataEmissao>2024-12-24</DataEmissao>
                        <Status>1</Status>
                    </Rps>
                    <Competencia>2024-12-01</Competencia>
                    <Servico>
                        <Valores>
                            <ValorServicos>1500.00</ValorServicos>
                            <ValorDeducoes>0.00</ValorDeducoes>
                            <ValorPis>10.00</ValorPis>
                            <ValorCofins>15.00</ValorCofins>
                            <ValorInss>20.00</ValorInss>
                            <ValorIr>25.00</ValorIr>
                            <ValorCsll>30.00</ValorCsll>
                            <OutrasRetencoes>5.00</OutrasRetencoes>
                            <ValTotTributos>100.00</ValTotTributos>
                            <ValorIss>60.00</ValorIss>
                            <Aliquota>3.00</Aliquota>
                            <DescontoIncondicionado>0.00</DescontoIncondicionado>
                            <DescontoCondicionado>0.00</DescontoCondicionado>
                        </Valores>
                        <IssRetido>2</IssRetido>
                        <ItemListaServico>07.02</ItemListaServico>
                        <CodigoCnae>6202100</CodigoCnae>
                        <CodigoTributacaoMunicipio>123456</CodigoTributacaoMunicipio>
                        <CodigoNbs>5345</CodigoNbs>
                        <Discriminacao>Desenvolvimento de software personalizado</Discriminacao>
                        <CodigoMunicipio>333</CodigoMunicipio>
                        <ExigibilidadeISS>1</ExigibilidadeISS>
                        <MunicipioIncidencia>3550308</MunicipioIncidencia>
                    </Servico>
                    <Prestador>
                        <CpfCnpj>
                            <Cnpj>12345678000195</Cnpj>
                        </CpfCnpj>
                        <InscricaoMunicipal>123456</InscricaoMunicipal>
                    </Prestador>
                    <TomadorServico>
                        <IdentificacaoTomador>
                            <CpfCnpj>
                                <Cpf>12345678901</Cpf>
                            </CpfCnpj>
                            <InscricaoMunicipal>654321</InscricaoMunicipal>
                        </IdentificacaoTomador>
                        <RazaoSocial>Cliente Exemplo LTDA</RazaoSocial>
                        <Endereco>
                            <Endereco>Rua Exemplo</Endereco>
                            <Numero>123</Numero>
                            <Bairro>Centro</Bairro>
                            <CodigoMunicipio>3550308</CodigoMunicipio>
                            <Uf>SP</Uf>
                            <Cep>01001000</Cep>
                        </Endereco>
                        <Contato>
                            <Telefone>11999999999</Telefone>
                            <Email>cliente@exemplo.com</Email>
                        </Contato>
                    </TomadorServico>
                    <RegimeEspecialTributacao>1</RegimeEspecialTributacao>
                    <OptanteSimplesNacional>1</OptanteSimplesNacional>
                    <IncentivoFiscal>2</IncentivoFiscal>
                </InfDeclaracaoPrestacaoServico>
            </Rps>
        </ListaRps>
    </LoteRps>
</EnviarLoteRpsEnvio>
`;
  }

  
  private assinarXml(xml: string, certPath: string, password: string): string {
    // Carregar o certificado PFX
    const pfxBuffer = fs.readFileSync(certPath);
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  
    let privateKeyPem = '';
    let certificatePem = '';
  
    // Extrair chave privada e certificado
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
      throw new Error('Falha ao extrair chave privada ou certificado.');
    }
  
    // Criar uma instância de SignedXml com a chave privada e o certificado
    const signer = new SignedXml({
      privateKey: privateKeyPem,
      publicCert: certificatePem,
    });
  
    // Adicionar referência ao elemento que será assinado
    signer.addReference({
      xpath: "//*[local-name(.)='EnviarLoteRpsEnvio']",
      transforms: ['http://www.w3.org/2001/10/xml-exc-c14n#'],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    });
  
    // Definir o algoritmo de assinatura
    signer.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';

    signer.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';

    // Computar a assinatura
    signer.computeSignature(xml);
  
    console.log('XML assinado:', signer.getSignedXml());
    
    // Retornar o XML assinado
    return signer.getSignedXml();
  }


  public async uploadCertificado(req: Request, res: Response) {
    try {
      res.status(200).json({ mensagem: "Certificado enviado com sucesso." });
    } catch (error) {
      // console.error("Erro ao processar o upload:", error);
      res.status(500).json({ erro: "Erro ao processar o upload do certificado." });
    }
  }


}



export default new NFSE();
