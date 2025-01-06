import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as https from "https";
import { execSync } from "child_process";
import axios from "axios";
import * as dotenv from "dotenv";
import { Request, Response } from "express";
import { SignedXml } from "xml-crypto";
import * as xmlbuilder from "xmlbuilder";
import * as forge from "node-forge";
import * as xml2js from "xml2js";
import * as libxmljs from "libxmljs";
import MkauthSource from "../database/MkauthSource";
import { ClientesEntities } from '../entities/ClientesEntities';
import { Faturas } from '../entities/Faturas';
import { Between, In } from "typeorm";

dotenv.config();

// const rpsData = {
//   numero: "1",
//   serie: "999",
//   tipo: "1",
//   dataEmissao: "2025-01-03",
//   status: "1",
//   competencia: "2025-01-03",
//   valor: "100.00",
//   aliquota: "2.00",
//   issRetido: "2",
//   responsavelRetencao: "1",
//   itemLista: "01.05",
//   descricao: "descricao do servico",
//   municipio: "3504800",
//   cnpj: "01001001000113",
//   senha: "123456",
// };

class NFSE {
  private certPath = path.resolve(__dirname, "../files/certificado.pfx");
  private WSDL_URL =
    "http://fi1.fiorilli.com.br:5663/IssWeb-ejb/IssWebWS/IssWebWS";
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

  private async gerarXmlLote(id : string) {
    const builder = xmlbuilder;

    const RPSQuery = MkauthSource.getRepository(Faturas);
    const rpsData = await RPSQuery.findOne({ where: { id: Number(id) } });

    const ClientRepository = MkauthSource.getRepository(ClientesEntities);

    const ClientData = await ClientRepository.findOne({ where: { id: rpsData?.id } });

    const xml = builder
      .create("soapenv:Envelope", {
        version: "1.0",
        encoding: "UTF-8",
      })
      .att("xmlns:soapenv", "http://schemas.xmlsoap.org/soap/envelope/")
      .att("xmlns:ws", "http://ws.issweb.fiorilli.com.br/")
      .att("xmlns:xd", "http://www.w3.org/2000/09/xmldsig#")
      .ele("soapenv:Header")
      .up()
      .ele("soapenv:Body")
      .ele("ws:gerarNfse")
      .ele("GerarNfseEnvio", { xmlns: "http://www.abrasf.org.br/nfse.xsd" })
      .ele("Rps", { xmlns: "http://www.abrasf.org.br/nfse.xsd" })
      .ele("InfDeclaracaoPrestacaoServico", { Id: "rps000000000000001999" })
      .ele("Rps")
      .ele("IdentificacaoRps")
      .ele("Numero")
      .txt(rpsData?.numero)
      .up()
      .ele("Serie")
      .txt(rpsData?.serie)
      .up()
      .ele("Tipo")
      .txt(rpsData?.tipo)
      .up()
      .up()
      .ele("DataEmissao")
      .txt(rpsData?.processamento ? rpsData.processamento.toISOString().substring(0, 10) : '')
      .up()
      .ele("Status")
      .txt("1")
      .up()
      .up()
      .ele("Competencia")
      .txt(rpsData?.datavenc ? rpsData.datavenc.toISOString().substring(0, 10) : '')
      .up()
      .ele("Servico")
      .ele("Valores")
      .ele("ValorServicos")
      .txt(String(rpsData?.valor))
      .up()
      .ele("Aliquota")
      .txt(rpsData?.aliquota)
      .up()
      .up()
      .ele("IssRetido")
      .txt(rpsData?.issRetido)
      .up()
      .ele("ResponsavelRetencao")
      .txt(rpsData?.responsavelRetencao)
      .up()
      .ele("ItemListaServico")
      .txt(rpsData?.itemLista)
      .up()
      .ele("Discriminacao")
      .txt(rpsData?.descricao)
      .up()
      .ele("CodigoMunicipio")
      .txt(rpsData?.municipio)
      .up()
      .ele("ExigibilidadeISS")
      .txt("1")
      .up()
      .up()
      .ele("Prestador")
      .ele("CpfCnpj")
      .ele("Cnpj")
      .txt("20843290000142")
      .up()
      .up()
      .ele("InscricaoMunicipal")
      .txt("21950014")
      .up()
      .up()
      .ele("Tomador")
      .ele("IdentificacaoTomador")
      .ele("CpfCnpj")
      .ele(ClientData?.cpf_cnpj.length === 11 ? "Cpf" : "Cnpj")
      .txt(String(ClientData?.cpf_cnpj))
      .up()
      .up()
      .up()
      .ele("RazaoSocial")
      .txt(String(ClientData?.nome))
      .up()
      .ele("Endereco")
      .ele("Endereco")
      .txt(String(ClientData?.endereco))
      .up()
      .ele("Numero")
      .txt(String(ClientData?.numero))
      .up()
      .ele("Complemento")
      .txt(String(ClientData?.complemento))
      .up()
      .ele("Bairro")
      .txt(String(ClientData?.bairro))
      .up()
      .ele("CodigoMunicipio")
      .txt("3503406")
      .up()
      .ele("Uf")
      .txt("SP")
      .up()
      // .ele("CodigoPais").txt("1058").up()
      .ele("Cep")
      .txt(String(ClientData?.cep))
      .up()
      .up()
      .ele("Contato")
      .ele("Telefone")
      .txt(String(ClientData?.celular))
      .up()
      .ele("Email")
      .txt(String(ClientData?.email))
      .up()
      .up()
      .up()
      .ele("OptanteSimplesNacional")
      .txt("2")
      .up()
      .ele("IncentivoFiscal")
      .txt("2")
      .up()
      .up()
      .up()
      .up()
      // .ele("username")
      // .txt(rpsData?.cnpj)
      // .up()
      // .ele("password")
      // .txt(rpsData?.senha)
      // .up()
      .up()
      .end({ pretty: false });

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

    const rpsElement = signedDoc.get(
      "//*[local-name(.)='InfDeclaracaoPrestacaoServico']"
    ) as libxmljs.XMLElement | null;

    if (!rpsElement) {
      throw new Error("Elemento Rps não encontrado no XML.");
    }

    const signatureElement = signedDoc.get(
      "//*[local-name(.)='Signature']"
    ) as libxmljs.XMLElement | null;

    // Move a assinatura existente, em vez de clonar ou criar uma nova
    if (signatureElement) {
      signatureElement.remove(); // Remove a assinatura duplicada do local errado
      rpsElement.addChild(signatureElement); // Move para dentro de InfDeclaracaoPrestacaoServico
    }

    if (!signatureElement) {
      throw new Error("Assinatura não encontrada.");
    }

    rpsElement.addNextSibling(signatureElement);

    const finalXml = signedDoc.toString();

    console.log(finalXml);

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

  public async BuscarClientes(req: Request, res: Response) {
    const { cpf, filters, dateFilter } = req.body;

    console.log("Filtros recebidos:", { cpf, filters, dateFilter });
    
    
    const ClientRepository = MkauthSource.getRepository(ClientesEntities);
  
    const whereConditions: any = {};

    // Adiciona CPF se existir
    if (cpf) {
        whereConditions.cpf_cnpj = cpf;
    }

    // Adiciona filtro por intervalo de datas (usando Between)
    if (dateFilter && dateFilter.start && dateFilter.end) {
        whereConditions.data_desativacao = Between(dateFilter.start, dateFilter.end);
    }
  
    // Processa outros filtros
    if (filters) {
        const { plano, vencimento, cli_ativado, nova_nfe } = filters;

        if (plano?.length) {
            whereConditions.plano = In(plano);
        }
        if (vencimento?.length) {
            whereConditions.venc = In(vencimento);
        }
        if (cli_ativado?.length) {
            whereConditions.cli_ativado = In(["s"]);
        }
        if (nova_nfe?.length) {
            whereConditions.tags = In(nova_nfe);
        }
    }

    try {
        const clientesResponse = await ClientRepository.find({
            where: whereConditions,
            select: {
                id: true,
                nome: true,
                cpf_cnpj: true,
                plano: true,
                venc: true,
                cli_ativado: true,
                tags: true,
            }
        });
  
        res.status(200).json(clientesResponse);
    } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        res.status(500).json({ message: "Erro ao buscar clientes" });
    }
}

}

export default new NFSE();
