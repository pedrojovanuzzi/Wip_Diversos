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
import { DOMParser } from "xmldom";
import {
  Between,
  Equal,
  FindOptionsOrder,
  In,
  IsNull,
  MoreThanOrEqual,
} from "typeorm";
import * as crypto from "crypto";

dotenv.config();

class NFSEController {
  private certPath = path.resolve(__dirname, "../files/certificado.pfx");
  // private WSDL_URL = "http://fi1.fiorilli.com.br:5663/IssWeb-ejb/IssWebWS/IssWebWS"; //HOMOLOGAÇÃO
  private WSDL_URL = "http://nfe.arealva.sp.gov.br:5661/IssWeb-ejb/IssWebWS/IssWebWS?wsdl"; //PRODUÇÃO
  private TEMP_DIR = path.resolve(__dirname, "../files");
  private PASSWORD = "";
  private DECRYPTED_CERT_PATH = path.resolve(
    this.TEMP_DIR,
    "decrypted_certificado.tmp"
  );
  private NEW_CERT_PATH = path.resolve(this.TEMP_DIR, "new_certificado.pfx");

  public iniciar = async (req: Request, res: Response) => {
    try {
      const { password, clientesSelecionados, aliquota } = req.body;

      this.PASSWORD = password;

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

  public async gerarNFSE(
    password: string,
    ids: string[],
    SOAPAction: string,
    aliquota: string
  ) {
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

        const response = await axios.post(this.WSDL_URL, xmlLoteRps, {
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

  private async gerarXmlRecepcionarRps(id: string, aliquota: string = "5") {
    const builder = xmlbuilder
    const RPSQuery = MkauthSource.getRepository(Faturas)
    const rpsData = await RPSQuery.findOne({ where: { id: Number(id) } })
    const ClientRepository = MkauthSource.getRepository(ClientesEntities)
    const FaturasRepository = MkauthSource.getRepository(Faturas)
    const FaturasData = await FaturasRepository.findOne({ where: { id: Number(id) } })
    const ClientData = await ClientRepository.findOne({ where: { login: FaturasData?.login } })
  
    const response = await axios.get(
      `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${ClientData?.cidade}`
    )
    const municipio = response.data.id
  
    const NsfeData = AppDataSource.getRepository(NFSE)
    const nfseResponse = await NsfeData.find({ order: { id: "DESC" }, take: 1 })
    const nfseNumber = nfseResponse && nfseResponse[0]?.numeroRps ? nfseResponse[0].numeroRps + 1 : 1
  
    const loteRpsSemAssinatura = `
  <LoteRps Id="lote1" versao="2.01" xmlns="http://www.abrasf.org.br/nfse.xsd">
    <NumeroLote>1</NumeroLote>
    <CpfCnpj><Cnpj>20843290000142</Cnpj></CpfCnpj>
    <InscricaoMunicipal>2195-00/14</InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps xmlns="http://www.abrasf.org.br/nfse.xsd">
        <InfDeclaracaoPrestacaoServico Id="_${String(rpsData?.uuid_lanc)}">
          <Rps>
            <IdentificacaoRps>
              <Numero>${String(nfseNumber)}</Numero>
              <Serie>${String(nfseResponse[0]?.serieRps)}</Serie>
              <Tipo>${String(nfseResponse[0]?.tipoRps)}</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${new Date().toISOString().substring(0, 10)}</DataEmissao>
            <Status>1</Status>
          </Rps>
          <Competencia>${new Date().toISOString().substring(0, 10)}</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>${String(rpsData?.valor)}</ValorServicos>
              <Aliquota>${aliquota}</Aliquota>
            </Valores>
            <IssRetido>${String(nfseResponse[0]?.issRetido)}</IssRetido>
            <ResponsavelRetencao>${String(nfseResponse[0]?.responsavelRetencao)}</ResponsavelRetencao>
            <ItemListaServico>${String(nfseResponse[0]?.itemListaServico)}</ItemListaServico>
            <Discriminacao>Servicos de Manutencao, e Suporte Tecnico</Discriminacao>
            <CodigoMunicipio>3503406</CodigoMunicipio>
            <ExigibilidadeISS>1</ExigibilidadeISS>
          </Servico>
          <Prestador>
            <CpfCnpj><Cnpj>20843290000142</Cnpj></CpfCnpj>
            <InscricaoMunicipal>2195-00/14</InscricaoMunicipal>
          </Prestador>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>
                <${
                  ClientData?.cpf_cnpj.length === 11 ? "Cpf" : "Cnpj"
                }>${String(ClientData?.cpf_cnpj.replace(/[^0-9]/g, ""))}</${
      ClientData?.cpf_cnpj.length === 11 ? "Cpf" : "Cnpj"
    }>
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${String(ClientData?.nome)}</RazaoSocial>
            <Endereco>
              <Endereco>${String(ClientData?.endereco)}</Endereco>
              <Numero>${String(ClientData?.numero)}</Numero>
              <Complemento>${String(ClientData?.complemento)}</Complemento>
              <Bairro>${String(ClientData?.bairro)}</Bairro>
              <CodigoMunicipio>${municipio}</CodigoMunicipio>
              <Uf>SP</Uf>
              <Cep>${String(ClientData?.cep.replace(/[^0-9]/g, ""))}</Cep>
            </Endereco>
            <Contato>
              <Telefone>${String(ClientData?.celular)}</Telefone>
              <Email>${String(ClientData?.email)}</Email>
            </Contato>
          </Tomador>
          <RegimeEspecialTributacao>06</RegimeEspecialTributacao>
          <OptanteSimplesNacional>${
            nfseResponse[0]?.optanteSimplesNacional || "2"
          }</OptanteSimplesNacional>
          <IncentivoFiscal>${nfseResponse[0]?.incentivoFiscal || "2"}</IncentivoFiscal>
        </InfDeclaracaoPrestacaoServico>
        <!-- A primeira assinatura deve ficar aqui -->
      </Rps>
    </ListaRps>
  </LoteRps>
  `.replace(/\s+>/g, ">") 
  .replace(/>\s+</g, "><")
  .replace(/<\s+/g, "<")
  .trim();
  
    const envioSemAssinatura = `
  <EnviarLoteRpsSincronoEnvio Id="#lote1" xmlns="http://www.abrasf.org.br/nfse.xsd">
    ${loteRpsSemAssinatura}
    <!-- A segunda assinatura deve ficar aqui -->
  </EnviarLoteRpsSincronoEnvio>
  `.replace(/\s+>/g, ">") 
  .replace(/>\s+</g, "><")
  .replace(/<\s+/g, "<")
  .trim();
  
    // Aqui criamos o SOAP final, mas sem as assinaturas
    const soapSemAssinatura = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
    <soapenv:Header/>
    <soapenv:Body>
      <ws:recepcionarLoteRpsSincrono>
        ${envioSemAssinatura}
        <username>${process.env.MUNICIPIO_LOGIN}</username>
        <password>${process.env.MUNICIPIO_SENHA}</password>
      </ws:recepcionarLoteRpsSincrono>
    </soapenv:Body>
  </soapenv:Envelope>
  `.replace(/\s+>/g, ">") 
  .replace(/>\s+</g, "><")
  .replace(/<\s+/g, "<")
  .trim();
  
    // Agora geramos os digests e assinaturas
    const SignatureVariables = this.extrairCertificados(
      this.certPath,
      this.PASSWORD,
      loteRpsSemAssinatura, // referência #lote1
      envioSemAssinatura    
    )
  
    // Primeira assinatura, ref #lote1
    const assinatura1 = `
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
      <Reference URI="#_${String(rpsData?.uuid_lanc)}">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
        <DigestValue>${SignatureVariables.parteOne.digestValue}</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>${SignatureVariables.parteOne.signature}</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>${SignatureVariables.parteOne.x509Certificate}</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>`.replace(/\s+>/g, ">") 
  .replace(/>\s+</g, "><")
  .replace(/<\s+/g, "<")
  .trim();
  
    
    const assinatura2 = `
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
      <Reference URI="#lote1">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
        <DigestValue>${SignatureVariables.parteTwo.digestValue}</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>${SignatureVariables.parteTwo.signature}</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>${SignatureVariables.parteTwo.x509Certificate}</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>`.replace(/\s+>/g, ">") 
  .replace(/>\s+</g, "><")
  .replace(/<\s+/g, "<")
  .trim();
  
    // Injeta a primeira assinatura logo após <!-- A primeira assinatura deve ficar aqui -->
    const loteComAssinatura1 = loteRpsSemAssinatura.replace(
      /<!-- A primeira assinatura deve ficar aqui -->/,
      assinatura1
    )
  
    // Injeta a segunda assinatura logo após <!-- A segunda assinatura deve ficar aqui -->
    const envioComAssinatura2 = envioSemAssinatura
      .replace(loteRpsSemAssinatura, loteComAssinatura1)
      .replace(/<!-- A segunda assinatura must ficar aqui -->/i, assinatura2) // note case
  
    // Se o texto exato for "<!-- A segunda assinatura deve ficar aqui -->", substitua por ele:
    const envioAssinado = envioComAssinatura2.replace(
      /<!-- A segunda assinatura deve ficar aqui -->/,
      assinatura2
    )
  
    // Por fim, injeta tudo no soap
    const soapComAssinaturas = soapSemAssinatura.replace(envioSemAssinatura, envioAssinado)
  
    const xmlBuffer = Buffer.from(soapComAssinaturas, "utf8")
  
    // Salva no banco
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
      incentivoFiscal: 2
    })
    await NsfeData.save(insertDatabase)

    const soapComAssinaturasUnicaLinha = soapComAssinaturas
    .replace(/\s+>/g, ">") 
    .replace(/>\s+</g, "><")
    .replace(/<\s+/g, "<")
    .trim();



  
    console.log(soapComAssinaturasUnicaLinha)
  
    return soapComAssinaturasUnicaLinha
  }
  
  private extrairCertificados(
    certPath: string,
    password: string,
    elementToSignOne: string,
    elementToSignTwo: string
  ): {
    parteOne: {
      privateKeyPem: string
      x509Certificate: string
      digestValue: string
      signature: string
    }
    parteTwo: {
      privateKeyPem: string
      x509Certificate: string
      digestValue: string
      signature: string
    }
  } {
    const pfxBuffer = fs.readFileSync(certPath)
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString("binary"))
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)

    let privateKeyPem = ""
    let certificatePem = ""

    p12.safeContents.forEach((content) => {
      content.safeBags.forEach((bag) => {
        if (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag && bag.key) {
          privateKeyPem = forge.pki.privateKeyToPem(bag.key)
        } else if (bag.type === forge.pki.oids.certBag && bag.cert) {
          certificatePem = forge.pki.certificateToPem(bag.cert)
        }
      })
    })

    if (!privateKeyPem || !certificatePem) {
      throw new Error("Falha ao extrair chave privada ou certificado.")
    }

    const x509Certificate = certificatePem
      .replace(/-----BEGIN CERTIFICATE-----/g, "")
      .replace(/-----END CERTIFICATE-----/g, "")
      .replace(/\s+/g, "")

    // Aplica canonicalização e só depois gera o digest
    const canonicalOne = this.excC14n(elementToSignOne)
    const canonicalTwo = this.excC14n(elementToSignTwo)

    const digestValueOne = crypto
      .createHash("sha1")
      .update(canonicalOne)
      .digest("base64")

    const signerOne = crypto.createSign("RSA-SHA1")
    signerOne.update(canonicalOne)
    const signatureOne = signerOne.sign(privateKeyPem, "base64")

    const digestValueTwo = crypto
      .createHash("sha1")
      .update(canonicalTwo)
      .digest("base64")

    const signerTwo = crypto.createSign("RSA-SHA1")
    signerTwo.update(canonicalTwo)
    const signatureTwo = signerTwo.sign(privateKeyPem, "base64")

    return {
      parteOne: {
        privateKeyPem,
        x509Certificate,
        digestValue: digestValueOne,
        signature: signatureOne
      },
      parteTwo: {
        privateKeyPem,
        x509Certificate,
        digestValue: digestValueTwo,
        signature: signatureTwo
      }
    }
  }

  private excC14n(xml: string): string {
    const doc = new DOMParser().parseFromString(xml, "text/xml")
    const node = doc.documentElement
    const c14n = new SignedXml();

    return c14n.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#"
  }

  public async BuscarNSFE(req: Request, res: Response) {
    try {
      const { clienteid } = req.body;
    } catch (error) {
      console.log("Erro ao buscar NFSE:", error);
    }
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
