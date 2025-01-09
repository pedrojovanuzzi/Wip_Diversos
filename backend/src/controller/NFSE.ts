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
import AppDataSource from "../database/DataSource";
import { NFSE } from "../entities/NFSE";
import { ClientesEntities } from "../entities/ClientesEntities";
import { Faturas } from "../entities/Faturas";
import { Between, Equal, FindOptionsOrder, In, IsNull, MoreThanOrEqual } from "typeorm";

dotenv.config();


class NFSEController {
  private certPath = path.resolve(__dirname, "../files/certificado.pfx");
  // private WSDL_URL =
  //   "http://fi1.fiorilli.com.br:5663/IssWeb-ejb/IssWebWS/IssWebWS"; //HOMOLOGAÇÃO
  private WSDL_URL = "http://nfe.arealva.sp.gov.br:5661/IssWeb-ejb/IssWebWS/IssWebWS?wsdl"; //PRODUÇÃO
  private TEMP_DIR = path.resolve(__dirname, "../files");
  private DECRYPTED_CERT_PATH = path.resolve(
    this.TEMP_DIR,
    "decrypted_certificado.tmp"
  );
  private NEW_CERT_PATH = path.resolve(this.TEMP_DIR, "new_certificado.pfx");

  public iniciar = async (req: Request, res: Response) => {
    try {
      const { password, clientesSelecionados, aliquota } = req.body;

      console.log(clientesSelecionados);

      if (!password) {
        throw new Error("Senha do certificado não fornecida.");
      }

      
      

      const result = await this.gerarNFSE(
        password,
        clientesSelecionados,
        "EnviarLoteRpsSincronoEnvio",
        aliquota
      );


      res.status(200).json({ mensagem: "RPS criado com sucesso!", result });
    } catch (error) {
      console.error("Erro ao criar o RPS:", error);
      res.status(500).json({ erro: "Erro ao criar o RPS." });
    }
  };

  public async gerarNFSE(password: string, ids: string[], SOAPAction: string, aliquota: string) {
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

      for (const id of ids) {
        const xmlLoteRps = await this.gerarXmlRecepcionarRps(id, aliquota);
        const signedXml = this.assinarXml(
          xmlLoteRps,
          certPathToUse,
          password,
          "InfDeclaracaoPrestacaoServico"
        );

        const response = await axios.post(this.WSDL_URL, signedXml, {
          httpsAgent,
          headers: {
            "Content-Type": "text/xml; charset=UTF-8",
            SOAPAction: SOAPAction,
          },
        });

        
        console.log("Resposta do servidor para ID", id, ":", response.data);
      }

      if (fs.existsSync(this.NEW_CERT_PATH)) fs.unlinkSync(this.NEW_CERT_PATH);
      if (fs.existsSync(this.DECRYPTED_CERT_PATH))
        fs.unlinkSync(this.DECRYPTED_CERT_PATH);
      
    } catch (error) {
      console.error("Erro ao enviar requisição:", error);
    }
  }

  private removeBOM(xml: string): string {
    return xml.charCodeAt(0) === 0xFEFF ? xml.slice(1) : xml;
  }
  



  private async gerarXmlRecepcionarRps(id: string, aliquota: string = "5") {
    const builder = xmlbuilder;

    const RPSQuery = MkauthSource.getRepository(Faturas);
    const rpsData = await RPSQuery.findOne({ where: { id: Number(id) } });

    const ClientRepository = MkauthSource.getRepository(ClientesEntities);
    const FaturasRepository = MkauthSource.getRepository(Faturas);
    
    const FaturasData = await FaturasRepository.findOne({ where: { id: Number(id) } });

    const ClientData = await ClientRepository.findOne({
      where: { login: FaturasData?.login },
    });

    ClientData?.cidade;

    const response = await axios.get(
      `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${ClientData?.cidade}`
    );    

    const municipio = response.data.id;

    const NsfeData = AppDataSource.getRepository(NFSE);

    const nfseResponse = await NsfeData.find({
      order: { id: "DESC" },  
      take: 1,  
    });

    
    console.log("ALIQUOTA " + aliquota);
    

    const nfseNumber = nfseResponse && nfseResponse[0].numeroRps ? nfseResponse[0].numeroRps + 1 : 1;

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
      .ele("ws:recepcionarLoteRpsSincrono")
      .ele("EnviarLoteRpsSincronoEnvio", { xmlns: "http://www.abrasf.org.br/nfse.xsd" })
      .ele("LoteRps", { versao:"2.01", Id:"lote1" })
      .ele("NumeroLote")
      .txt("1")
      .up()
      .ele("CpfCnpj")
      .ele("Cnpj")
      .txt("20843290000142")
      .up()
      .up()
      .ele("InscricaoMunicipal")
      .txt("2195-00/14")
      .up()
      .ele("QuantidadeRps")
      .txt("1")
      .up()
      .ele("ListaRps")
      .ele("Rps", {xmlns:"http://www.abrasf.org.br/nfse.xsd"})
      .ele("InfDeclaracaoPrestacaoServico", { Id:String(rpsData?.uuid_lanc)})
      .ele("Rps")
      .ele("IdentificacaoRps")
      .ele("Numero")
      .txt(String(nfseNumber))
      .up()
      .ele("Serie")
      .txt(String(nfseResponse[0]?.serieRps))
      .up()
      .ele("Tipo")
      .txt(String(nfseResponse[0]?.tipoRps))
      .up()
      .up()
      .ele("DataEmissao")
      .txt(
        new Date().toISOString().substring(0, 10)
      )
      .up()
      .ele("Status")
      .txt("1")
      .up()
      .up()
      .ele("Competencia")
      .txt(
        new Date().toISOString().substring(0, 10)
      )
      .up()
      .ele("Servico")
      .ele("Valores")
      .ele("ValorServicos")
      .txt(String(rpsData?.valor))
      .up()
      .ele("Aliquota")
      .txt(aliquota)
      .up()
      .up()
      .ele("IssRetido")
      .txt(String(nfseResponse[0]?.issRetido))
      .up()
      .ele("ResponsavelRetencao")
      .txt(String(nfseResponse[0]?.responsavelRetencao))
      .up()
      .ele("ItemListaServico")
      .txt(String(nfseResponse[0]?.itemListaServico))
      .up()
      .ele("Discriminacao")
      .txt("Servicos de Manutencao, e Suporte Tecnico")
      .up()
      .ele("CodigoMunicipio")
      .txt("3503406")
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
      .txt("2195-00/14")
      .up()
      .up()
      .ele("Tomador")
      .ele("IdentificacaoTomador")
      .ele("CpfCnpj")
      .ele(ClientData?.cpf_cnpj.length === 11 ? "Cpf" : "Cnpj")
      .txt(String(ClientData?.cpf_cnpj.replace(/[^0-9]/g, "")))
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
      .txt(municipio)
      .up()
      .ele("Uf")
      .txt("SP")
      .up()
      // .ele("CodigoPais").txt("1058").up()
      .ele("Cep")
      .txt(String(ClientData?.cep.replace(/[^0-9]/g, "")))
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
      .ele("RegimeEspecialTributacao")
      .txt("06")
      .up()
      .ele("OptanteSimplesNacional")
      .txt(String(nfseResponse[0].optanteSimplesNacional))
      .up()
      .ele("IncentivoFiscal")
      .txt(String(nfseResponse[0].incentivoFiscal))
      .up()
      .up()
      .up()
      .up()
      .up()
      .up()
      .ele("username")
      .txt(process.env.MUNICIPIO_LOGIN || "")
      .up()
      .ele("password")
      .txt(process.env.MUNICIPIO_SENHA || "")
      .up()
      .up()
      .end({ pretty: false });
      const xmlBuffer = Buffer.from(xml, 'utf8');

      const insertDatabase = NsfeData.create({
        login: rpsData?.login || "",
        numeroRps: nfseNumber || 0,
        serieRps: nfseResponse[0]?.serieRps || "",
        tipoRps: nfseResponse[0]?.tipoRps || 0,
        dataEmissao: rpsData?.processamento ? new Date(rpsData.processamento) : new Date(),
        competencia: rpsData?.datavenc ? new Date(rpsData.datavenc) : new Date(),
        valorServico: Number(rpsData?.valor) || 0,
        aliquota: nfseResponse[0]?.aliquota || 0,
        issRetido: nfseResponse[0]?.issRetido || 0,
        responsavelRetencao: nfseResponse[0]?.responsavelRetencao || 0,
        itemListaServico: nfseResponse[0]?.itemListaServico || "",
        discriminacao: "Serviços de Manutenção, e Suporte Técnico",
        codigoMunicipio: nfseResponse[0]?.codigoMunicipio || 0,
        exigibilidadeIss: nfseResponse[0]?.exigibilidadeIss || 0,
        cnpjPrestador: nfseResponse[0]?.cnpjPrestador || "",
        inscricaoMunicipalPrestador: nfseResponse[0]?.inscricaoMunicipalPrestador || "",
        cpfTomador: ClientData?.cpf_cnpj.replace(/[^0-9]/g, "") || "",
        razaoSocialTomador: ClientData?.nome || "",
        enderecoTomador: ClientData?.endereco || "",
        numeroEndereco: ClientData?.numero || "",
        complemento: ClientData?.complemento || undefined,
        bairro: ClientData?.bairro || "",
        uf: nfseResponse[0]?.uf || "",
        cep: ClientData?.cep.replace(/[^0-9]/g, "") || "",
        telefoneTomador: ClientData?.celular || undefined,
        emailTomador: ClientData?.email || undefined,
        optanteSimplesNacional: 2,
        incentivoFiscal: 2,
    });
    
    await NsfeData.save(insertDatabase);

    return this.removeBOM(xmlBuffer.toString('utf8'));
  }

  public async BuscarNSFE(req: Request, res: Response) {
    try {
      const { clienteid } = req.body;
    } catch (error) {
      console.log("Erro ao buscar NFSE:", error);
    }
  }

  private assinarXml(
    xml: string,
    certPath: string,
    password: string,
    children: string
  ): string {
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
      xpath: `//*[local-name(.)='${children}']`,
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
      `//*[local-name(.)='${children}']`
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

    const finalXml = signedDoc.toString().replace(/>\s+</g, '><').replace(/(\r\n|\n|\r)/g, '').trim();

    console.log(`\n\n\n ${finalXml}`);
  
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

    console.log(filters);
    

    const ClientRepository = MkauthSource.getRepository(ClientesEntities);

    const whereConditions: any = {};

    if (cpf) {
      whereConditions.cpf_cnpj = cpf;
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
          login: true,
          cpf_cnpj: true,
          cli_ativado: true,
        },
      });

      const faturasData = MkauthSource.getRepository(Faturas);

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const startDate = dateFilter
        ? new Date(dateFilter.start)
        : firstDayOfMonth;
      const endDate = dateFilter ? new Date(dateFilter.end) : lastDayOfMonth;

      startDate.setHours(startDate.getHours() + 3);
      endDate.setHours(endDate.getHours() + 3);

      const faturasResponse = await faturasData.find({
        where: {
          login: In(clientesResponse.map((cliente) => cliente.login)),
          datavenc: Between(startDate, endDate),
          datadel: IsNull(),
        },
        select: {
          id: true,
          login: true,
          datavenc: true,
          tipo: true,
          valor: true,
        },
        order: {
          datavenc: "DESC",
        },
      });

      const clientesComFaturas = clientesResponse
        .map((cliente) => {
          const fatura = faturasResponse.filter(
            (f) => f.login === cliente.login
          );

          if (fatura.length === 0) return null;

          return {
            ...cliente,
            fatura: {
              titulo: fatura.map((f) => f.id).join(", ") || null,
              login: fatura.map((f) => f.login).join(", ") || null,
              datavenc:
                fatura
                  .map((f) => new Date(f.datavenc).toLocaleDateString("pt-BR"))
                  .join(", ") || null,
              tipo: fatura.map((f) => f.tipo).join(", ") || null,
              valor: fatura.map((f) => f.valor).join(", ") || null,
            },
          };
        })
        .filter((cliente) => cliente !== null); // Remove clientes sem fatura


      res.status(200).json(clientesComFaturas);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      res.status(500).json({ message: "Erro ao buscar clientes" });
    }
  }
}

export default new NFSEController();
