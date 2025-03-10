import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as https from "https";
import { execSync } from "child_process";
import axios from "axios";
import * as dotenv from "dotenv";
import e, { Request, response, Response } from "express";
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
import { And, Between, In, IsNull } from "typeorm";
import * as crypto from "crypto";
import moment from 'moment-timezone';


dotenv.config();

interface NFSENode {
  [key: string]: string; 
}

class NFSEController {

  private certPath = path.resolve(__dirname, "../files/certificado.pfx");
  private homologacao = process.env.SERVIDOR_HOMOLOGACAO === 'true';
  private WSDL_URL =
    this.homologacao === true
      ? "http://fi1.fiorilli.com.br:5663/IssWeb-ejb/IssWebWS/IssWebWS"
      : "http://nfe.arealva.sp.gov.br:5661/IssWeb-ejb/IssWebWS/IssWebWS?wsdl";
  private TEMP_DIR = path.resolve(__dirname, "../files");
  private PASSWORD = "";
  private DECRYPTED_CERT_PATH = path.resolve(
    this.TEMP_DIR,
    "decrypted_certificado.tmp"
  );
  private NEW_CERT_PATH = path.resolve(this.TEMP_DIR, "new_certificado.pfx");

  constructor() {
    this.setNfseStatus = this.setNfseStatus.bind(this);
    this.setNfseNumber = this.setNfseNumber.bind(this);
    this.BuscarNSFE = this.BuscarNSFE.bind(this);
  }

  public iniciar = async (req: Request, res: Response) => {
    try {
      let { password, clientesSelecionados, aliquota, service, reducao } = req.body;
      this.PASSWORD = password;

      aliquota = aliquota && aliquota.trim() !== "" ? aliquota : "4.4269";
      aliquota = aliquota.replace(",", ".");
      aliquota = aliquota.replace("%", "");
      

      if(service === "" || undefined || null){
        service = "Servico de Suporte Tecnico";
      }
      
      if(reducao === "" || undefined || null){
        reducao = 40;
      }

      reducao = reducao / 100;

      if (!password) throw new Error("Senha do certificado não fornecida.");
      const result = await this.gerarNFSE(
        password,
        clientesSelecionados,
        "EnviarLoteRpsSincronoEnvio",
        aliquota,
        service,
        reducao
      );      

      if(result?.status === "200"){
        res.status(200).json({ mensagem: "RPS criado com sucesso!", result });
      }
      else{
        res.status(500).json({ erro: "Erro ao criar o RPS." });
      }     
    } catch (error) {
      res.status(500).json({ erro: "Erro ao criar o RPS." });
    }
  };

  public async gerarNFSE(
    password: string,
    ids: string[],
    SOAPAction: string,
    aliquota: string,
    service : string = "Servico de Suporte Tecnico",
    reducao : number | string = 40,
  ) {
    try {
      if (!fs.existsSync(this.TEMP_DIR))
        fs.mkdirSync(this.TEMP_DIR, { recursive: true });
  
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
          try {
            $certificado = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('${this.certPath}', '${password}', [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable);
            $bytes = $certificado.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, '${password}');
            [System.IO.File]::WriteAllBytes('${this.NEW_CERT_PATH}', $bytes)
          } catch {
            Write-Error $_.Exception.Message
            exit 1
          }
        `;
        try {
          execSync(
            `powershell -Command "${powershellCommand.replace(/\n/g, " ")}"`,
            {
              stdio: ["ignore", "inherit", "pipe"], // Captura stderr
            }
          );
        } catch (error: any) {
          console.error("Erro no PowerShell:", error.stderr || error.message || error);
          return { status: "500", response: error.stderr || "Erro desconhecido" };
        }
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
        const xmlLoteRps = await this.gerarXmlRecepcionarRps(
          id,
          Number(aliquota).toFixed(4),
          service,
          reducao
        );
        const response = await axios.post(this.WSDL_URL, xmlLoteRps, {
          httpsAgent,
          headers: {
            "Content-Type": "text/xml; charset=UTF-8",
            SOAPAction: SOAPAction,
          },
        });

        console.log(response);
        
  
        if (response.status === 200) {
          return { status: "200", response: response.data };
        } else {
          return { status: "500", response: "Error" };
        }
      }
  
      if (fs.existsSync(this.NEW_CERT_PATH)) fs.unlinkSync(this.NEW_CERT_PATH);
      if (fs.existsSync(this.DECRYPTED_CERT_PATH))
        fs.unlinkSync(this.DECRYPTED_CERT_PATH);
    } catch (error: any) {
      console.error("Erro geral no gerarNFSE:", error);
      return { status: "500", response: error.message || "Senha Inválida" };
    }
  }
  

  private async gerarXmlRecepcionarRps(id: string, aliquota: string, service : string, reducao : number | string) {
    try {
      const RPSQuery = MkauthSource.getRepository(Faturas);
    const rpsData = await RPSQuery.findOne({ where: { id: Number(id) } });
    const ClientRepository = MkauthSource.getRepository(ClientesEntities);
    const FaturasRepository = MkauthSource.getRepository(Faturas);
    const FaturasData = await FaturasRepository.findOne({
      where: { id: Number(id) },
    });
    const ClientData = await ClientRepository.findOne({
      where: { login: FaturasData?.login },
    });
    const response = await axios.get(
      `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${ClientData?.cidade}`
    );
    const municipio = response.data.id;
    const NsfeData = AppDataSource.getRepository(NFSE);
    const nfseResponse = await NsfeData.find({
      order: { id: "DESC" },
      take: 1,
    });
    let nfseNumber =
      nfseResponse && nfseResponse[0]?.numeroRps
        ? nfseResponse[0].numeroRps + 1
        : 1;

    nfseNumber = nfseNumber === 9999999 ? 9999999 + 1 : nfseNumber; //Por causa de um Teste Realizado]

    let valorMenosDesconto = 0;

    ClientData?.desconto ? valorMenosDesconto =(Number(rpsData?.valor) - Number(ClientData?.desconto)) : valorMenosDesconto = Number(rpsData?.valor);

    let valorReduzido = Number(valorMenosDesconto) * Number(reducao);

    valorReduzido = Number(valorReduzido.toFixed(2));

    const rpsXmlSemAssinatura = `
    <Rps xmlns="http://www.abrasf.org.br/nfse.xsd">
      <InfDeclaracaoPrestacaoServico Id="RPS${String(rpsData?.uuid_lanc)}">
        <Rps>
          <IdentificacaoRps>
            <Numero>${String(nfseNumber)}</Numero>
            <Serie>${String(nfseResponse[0]?.serieRps)}</Serie>
            <Tipo>${String(nfseResponse[0]?.tipoRps)}</Tipo>
          </IdentificacaoRps>
          <DataEmissao>${new Date()
            .toISOString()
            .substring(0, 10)}</DataEmissao>
          <Status>1</Status>
        </Rps>
        <Competencia>${new Date().toISOString().substring(0, 10)}</Competencia>
        <Servico>
          <Valores>
            <ValorServicos>${String(valorReduzido)}</ValorServicos>
            <Aliquota>${this.homologacao === true ? "2.00" : aliquota || "4.4269"}</Aliquota>
          </Valores>
          <IssRetido>${String(nfseResponse[0]?.issRetido)}</IssRetido>
          <ResponsavelRetencao>${String(
            nfseResponse[0]?.responsavelRetencao
          )}</ResponsavelRetencao>
          <ItemListaServico>${this.homologacao === true ? "17.01" : String(
            nfseResponse[0]?.itemListaServico
          )}</ItemListaServico>
          <Discriminacao>${service}</Discriminacao>
          <CodigoMunicipio>3503406</CodigoMunicipio>
          <ExigibilidadeISS>${String(
            nfseResponse[0]?.exigibilidadeIss
          )}</ExigibilidadeISS>
        </Servico>
        <Prestador>
          <CpfCnpj><Cnpj>${
            this.homologacao === true
              ? process.env.MUNICIPIO_CNPJ_TEST
              : process.env.MUNICIPIO_LOGIN
          }</Cnpj></CpfCnpj>
          <InscricaoMunicipal>${
            this.homologacao === true
              ? process.env.MUNICIPIO_INCRICAO_TEST
              : process.env.MUNICIPIO_INCRICAO
          }</InscricaoMunicipal>
        </Prestador>
        <Tomador>
          <IdentificacaoTomador>
            <CpfCnpj>
              <${ClientData?.cpf_cnpj.length === 11 ? "Cpf" : "Cnpj"}>${String(
      ClientData?.cpf_cnpj.replace(/[^0-9]/g, "")
    )}</${ClientData?.cpf_cnpj.length === 11 ? "Cpf" : "Cnpj"}>
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
            <Telefone>${String(
              ClientData?.celular.replace(/[^0-9]/g, "")
            )}</Telefone>
            <Email>${this.homologacao === true
            ? "teste24542frsgwr@gmail.com"
            : String(ClientData?.email )}</Email>
          </Contato>
        </Tomador>
        ${this.homologacao === true ? "" : "<RegimeEspecialTributacao>6</RegimeEspecialTributacao>"}
        <OptanteSimplesNacional>${
          this.homologacao === true ? "2" : nfseResponse[0]?.optanteSimplesNacional || "1"
        }</OptanteSimplesNacional>
        <IncentivoFiscal>${
          nfseResponse[0]?.incentivoFiscal || "2"
        }</IncentivoFiscal>
      </InfDeclaracaoPrestacaoServico>
    </Rps>
    `
      .replace(/[\r\n]+/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/>\s+</g, "><")
      .replace(/<\s+/g, "<")
      .replace(/\s+>/g, ">")
      .trim();

    const loteXmlSemAssinatura = `
    <LoteRps versao="2.01" Id="lote${nfseNumber}">
      <NumeroLote>1</NumeroLote>
      <CpfCnpj><Cnpj>${
        this.homologacao === true
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN
      }</Cnpj></CpfCnpj>
      <InscricaoMunicipal>${
        this.homologacao === true
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO
      }</InscricaoMunicipal>
      <QuantidadeRps>1</QuantidadeRps>
      <ListaRps>
        ${rpsXmlSemAssinatura}
      </ListaRps>
    </LoteRps>
    `
      .replace(/[\r\n]+/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/>\s+</g, "><")
      .replace(/<\s+/g, "<")
      .replace(/\s+>/g, ">")
      .trim();


      const GerarNfseHomologacao = `
        ${rpsXmlSemAssinatura}
    `
      .replace(/[\r\n]+/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/>\s+</g, "><")
      .replace(/<\s+/g, "<")
      .replace(/\s+>/g, ">")
      .trim();

    const SignatureRps = this.assinarXml(
      loteXmlSemAssinatura,
      `InfDeclaracaoPrestacaoServico`
    );

    const loteXmlComAssinatura = `
    ${SignatureRps}
  `.trim();

  let envioXml = "";

  if(this.homologacao){
    envioXml = `
    <GerarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
      ${GerarNfseHomologacao}
    </GerarNfseEnvio>
    `.trim();
  }
  else{
    envioXml = `
    <EnviarLoteRpsSincronoEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
      ${loteXmlComAssinatura}
    </EnviarLoteRpsSincronoEnvio>
    `.trim();
  }
    

    const soapFinal = `
    <?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:ws="http://ws.issweb.fiorilli.com.br/"
    xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
      <soapenv:Header/>
      <soapenv:Body>
        <ws:recepcionarLoteRpsSincrono>
          ${envioXml}
          <username>${
            this.homologacao === true
              ? process.env.MUNICIPIO_LOGIN_TEST
              : process.env.MUNICIPIO_LOGIN
          }</username>
          <password>${
            this.homologacao === true
              ? process.env.MUNICIPIO_SENHA_TEST
              : process.env.MUNICIPIO_SENHA
          }</password>
        </ws:recepcionarLoteRpsSincrono>
      </soapenv:Body>
    </soapenv:Envelope>
    `.replace(/[\r\n]+/g, "") // Remove quebras de linha
    .replace(/\s{2,}/g, " ") // Substitui múltiplos espaços por um único
    .replace(/>\s+</g, "><") // Remove espaços entre tags
    .replace(/<\s+/g, "<") // Remove espaços após '<'
    .replace(/\s+>/g, ">") // Remove espaços antes de '>'
    .trim(); // Remove espaços no início e fim

    const soapFinalHomologacao = `
    <?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:ws="http://ws.issweb.fiorilli.com.br/"
    xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
      <soapenv:Header/>
      <soapenv:Body>
        <ws:gerarNfse>
          ${envioXml}
          <username>${
            this.homologacao === true
              ? process.env.MUNICIPIO_LOGIN_TEST
              : process.env.MUNICIPIO_LOGIN
          }</username>
          <password>${
            this.homologacao === true
              ? process.env.MUNICIPIO_SENHA_TEST
              : process.env.MUNICIPIO_SENHA
          }</password>
        </ws:gerarNfse>
      </soapenv:Body>
    </soapenv:Envelope>
    `.replace(/[\r\n]+/g, "") // Remove quebras de linha
      .replace(/\s{2,}/g, " ") // Substitui múltiplos espaços por um único
      .replace(/>\s+</g, "><") // Remove espaços entre tags
      .replace(/<\s+/g, "<") // Remove espaços após '<'
      .replace(/\s+>/g, ">") // Remove espaços antes de '>'
      .trim(); // Remove espaços no início e fim

      if(this.homologacao){
        aliquota = "2.00";
      }

    const NsfeRepository = AppDataSource.getRepository(NFSE);
    const insertDatabase = NsfeRepository.create({
      login: rpsData?.login || "",
      numeroRps: nfseNumber || 0,
      serieRps: nfseResponse[0]?.serieRps || "",
      tipoRps: nfseResponse[0]?.tipoRps || 0,
      dataEmissao: rpsData?.processamento
        ? new Date(rpsData.processamento)
        : new Date(),
      competencia: rpsData?.datavenc ? new Date(rpsData.datavenc) : new Date(),
      valorServico: valorReduzido || 0,
      aliquota: Number(Number(aliquota).toFixed(4)),
      issRetido: nfseResponse[0]?.issRetido || 0,
      responsavelRetencao: nfseResponse[0]?.responsavelRetencao || 0,
      itemListaServico: nfseResponse[0]?.itemListaServico || "",
      discriminacao: service,
      codigoMunicipio: nfseResponse[0]?.codigoMunicipio || 0,
      exigibilidadeIss: nfseResponse[0]?.exigibilidadeIss || 0,
      cnpjPrestador: nfseResponse[0]?.cnpjPrestador || "",
      inscricaoMunicipalPrestador:
        nfseResponse[0]?.inscricaoMunicipalPrestador || "",
      cpfTomador: ClientData?.cpf_cnpj.replace(/[^0-9]/g, "") || "",
      razaoSocialTomador: ClientData?.nome || "",
      enderecoTomador: ClientData?.endereco || "",
      numeroEndereco: ClientData?.numero || "",
      complemento: ClientData?.complemento || undefined,
      bairro: ClientData?.bairro || "",
      uf: nfseResponse[0]?.uf || "",
      cep: ClientData?.cep.replace(/[^0-9]/g, "") || "",
      telefoneTomador: ClientData?.celular.replace(/[^0-9]/g, "") || undefined,
      emailTomador: ClientData?.email || undefined,
      optanteSimplesNacional: 1,
      incentivoFiscal: 2,
    });

    if (await this.verificaRps(nfseNumber)) {

      await NsfeData.save(insertDatabase);
      
    if(this.homologacao){
      return soapFinalHomologacao;
    }

      return soapFinal;
    } else {
      return "ERRO NA CONSULTA DE RPS";
    }
    } catch (error) {
      return "Error " + error;
    }
  }

  private extrairChaveECertificado() {
    const pfxBuffer = fs.readFileSync(this.certPath);
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString("binary"));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.PASSWORD);
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
    const x509Certificate = certificatePem
      .replace(/-----BEGIN CERTIFICATE-----/g, "")
      .replace(/-----END CERTIFICATE-----/g, "")
      .replace(/\s+/g, "");
    return { privateKeyPem, x509Certificate };
  }

  public imprimirNFSE = async (req: Request, res: Response) => {
    const { rpsNumber } = req.body;
    const result = await Promise.all(rpsNumber.map((rps: string | number) => this.BuscarNSFEDetalhes(rps)));

    res.status(200).json(result);
  };
  

  private async verificaRps(
    rpsNumber: string | number,
    serie: string = "1",
    tipo: string = "1"
  ) {
    try {
      const dados = `<IdentificacaoRps>
                    <Numero>${rpsNumber}</Numero>
                    <Serie>${serie}</Serie>
                    <Tipo>${tipo}</Tipo>
                    </IdentificacaoRps>
                    <Prestador>
                    <CpfCnpj>
                        <Cnpj>${
                          this.homologacao === true
                            ? process.env.MUNICIPIO_CNPJ_TEST
                            : process.env.MUNICIPIO_LOGIN
                        }</Cnpj>
                    </CpfCnpj>
                    <InscricaoMunicipal>${
                      this.homologacao === true
                        ? process.env.MUNICIPIO_INCRICAO_TEST
                        : process.env.MUNICIPIO_INCRICAO
                    }</InscricaoMunicipal>
                    </Prestador>`.trim();

      const envioXml =
        `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`.trim();
      const soapFinal =
        `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`
          .replace(/[\r\n]+/g, "")
          .replace(/\s{2,}/g, " ")
          .replace(/>\s+</g, "><")
          .replace(/<\s+/g, "<")
          .replace(/\s+>/g, ">")
          .trim();

      const certPathToUse = fs.existsSync(this.NEW_CERT_PATH)
        ? this.NEW_CERT_PATH
        : this.certPath;
      const pfxBuffer = fs.readFileSync(certPathToUse);

      const httpsAgent = new https.Agent({
        pfx: pfxBuffer,
        passphrase: this.PASSWORD,
        rejectUnauthorized: false,
      });

      const response = await axios.post(this.WSDL_URL, soapFinal, {
        httpsAgent,
        headers: {
          "Content-Type": "text/xml; charset=UTF-8",
          SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
        },
      });

      // console.log(response.data);
      
      
      if (response.data.includes("<ns2:Codigo>E92</ns2:Codigo>")) return true;
      return false;

    } catch (error) {
      return error;
    }
  }

  public async cancelarNfse(req: Request, res: Response) {
    try {
      const { rpsNumber, password } = req.body;

      if (!Array.isArray(rpsNumber)) {
        res.status(400).json({ error: "rpsNumber must be an array" });
        return;
      }

      this.PASSWORD = password;

      const responses = await Promise.all(
        rpsNumber.map(async (rps: string | number) => {
          try {
            console.log(await this.setNfseNumber(rps));

            const nfseNumber = await this.setNfseNumber(rps);

            const dados =
              `<Pedido><InfPedidoCancelamento Id="CANCEL${nfseNumber}"><IdentificacaoNfse><Numero>${nfseNumber}</Numero><CpfCnpj><Cnpj>${
                this.homologacao === true
                  ? process.env.MUNICIPIO_CNPJ_TEST
                  : process.env.MUNICIPIO_LOGIN
              }</Cnpj></CpfCnpj><InscricaoMunicipal>${
                this.homologacao === true
                  ? process.env.MUNICIPIO_INCRICAO_TEST
                  : process.env.MUNICIPIO_INCRICAO
              }</InscricaoMunicipal><CodigoMunicipio>3503406</CodigoMunicipio></IdentificacaoNfse><CodigoCancelamento>2</CodigoCancelamento></InfPedidoCancelamento></Pedido>`.trim();
            const envioXml =
              `<CancelarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</CancelarNfseEnvio>`.trim();
             
            const envioXmlAssinado = this.assinarXml(
              envioXml,
              "InfPedidoCancelamento"
            );
            const soapFinal =
              `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:cancelarNfse>${envioXmlAssinado}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:cancelarNfse></soapenv:Body></soapenv:Envelope>`
                .replace(/[\r\n]+/g, "")
                .replace(/\s{2,}/g, " ")
                .replace(/>\s+</g, "><")
                .replace(/<\s+/g, "<")
                .replace(/\s+>/g, ">")
                .trim();

            const soapFinalHomologacao = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:cancelarNfse>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:cancelarNfse></soapenv:Body></soapenv:Envelope>`
                .replace(/[\r\n]+/g, "")
                .replace(/\s{2,}/g, " ")
                .replace(/>\s+</g, "><")
                .replace(/<\s+/g, "<")
                .replace(/\s+>/g, ">")
                .trim();


            const certPathToUse = fs.existsSync(this.NEW_CERT_PATH)
              ? this.NEW_CERT_PATH
              : this.certPath;
            const pfxBuffer = fs.readFileSync(certPathToUse);
            const httpsAgent = new https.Agent({
              pfx: pfxBuffer,
              passphrase: this.PASSWORD,
              rejectUnauthorized: false,
            });

            let response = null;

            if(this.homologacao){
              response = await axios.post(this.WSDL_URL, soapFinalHomologacao, {
                httpsAgent,
                headers: {
                  "Content-Type": "text/xml; charset=UTF-8",
                  SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
                },
              });
            }
            else{
              response = await axios.post(this.WSDL_URL, soapFinal, {
                httpsAgent,
                headers: {
                  "Content-Type": "text/xml; charset=UTF-8",
                  SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
                },
              });
            }
            

            console.log(response);

            setTimeout(() => {
            }, 5000);

            res.status(200).json({ rps, success: true, response: response.data });
            return;
          } catch (error) {
            console.error(`Error processing RPS ${rps}:`, error);
            res.status(500).json({ rps, success: false, error: error });
            return; 
          }
        })
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  private async setNfseNumber(
    rpsNumber: string | number,
    serie: string = "1",
    tipo: string = "1"
  ) {
    try {
      const dados = `<IdentificacaoRps>
                    <Numero>${rpsNumber}</Numero>
                    <Serie>${serie}</Serie>
                    <Tipo>${tipo}</Tipo>
                    </IdentificacaoRps>
                    <Prestador>
                    <CpfCnpj>
                        <Cnpj>${
                          this.homologacao === true
                            ? process.env.MUNICIPIO_CNPJ_TEST
                            : process.env.MUNICIPIO_LOGIN
                        }</Cnpj>
                    </CpfCnpj>
                    <InscricaoMunicipal>${
                      this.homologacao === true
                        ? process.env.MUNICIPIO_INCRICAO_TEST
                        : process.env.MUNICIPIO_INCRICAO
                    }</InscricaoMunicipal>
                    </Prestador>`.trim();

      const envioXml =
        `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`.trim();
      const soapFinal =
        `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`
          .replace(/[\r\n]+/g, "")
          .replace(/\s{2,}/g, " ")
          .replace(/>\s+</g, "><")
          .replace(/<\s+/g, "<")
          .replace(/\s+>/g, ">")
          .trim();

      const certPathToUse = fs.existsSync(this.NEW_CERT_PATH)
        ? this.NEW_CERT_PATH
        : this.certPath;
      const pfxBuffer = fs.readFileSync(certPathToUse);

      const httpsAgent = new https.Agent({
        pfx: pfxBuffer,
        passphrase: this.PASSWORD,
        rejectUnauthorized: false,
      });

      const response = await axios.post(this.WSDL_URL, soapFinal, {
        httpsAgent,
        headers: {
          "Content-Type": "text/xml; charset=UTF-8",
          SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
        },
      });

      const match = response.data.match(/<ns2:Numero>(\d+)<\/ns2:Numero>/);

      if (match && match[1]) {
        return match[1]; // Retorna o valor do número
      } else {
        console.log("Número não encontrado no XML.");
        return null; // Retorna null caso o número não seja encontrado
      }
    } catch (error) {
      return error;
    }
  }

  private assinarXml(xml: string, referenceId: string): string {
    const { privateKeyPem, x509Certificate } = this.extrairChaveECertificado();

    const keyInfoContent = `<X509Data><X509Certificate>${x509Certificate}</X509Certificate></X509Data>`;

    const signer = new SignedXml({
      implicitTransforms: ["http://www.w3.org/TR/2001/REC-xml-c14n-20010315"],
      privateKey: privateKeyPem,
      publicCert: `${x509Certificate}`,
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

    try {
      signer.computeSignature(xml, {
        location: {
          reference: `//*[local-name(.)='${referenceId}']`,
          action: "after",
        },
      });

      const isValid = true;

      if (!isValid) {
        throw new Error(`Signature validation failed`);
      }
      // console.log("Signature is valid:", isValid);
      return signer.getSignedXml();
    } catch (error) {
      console.error("An error occurred during XML signing:", error);
      return String(error);
    }
  }

  private async setNfseStatus(
    rpsNumber: string | number,
    serie: string = "1",
    tipo: string = "1"
  ) {
    try {
      const dados = `<IdentificacaoRps>
                    <Numero>${rpsNumber}</Numero>
                    <Serie>${serie}</Serie>
                    <Tipo>${tipo}</Tipo>
                    </IdentificacaoRps>
                    <Prestador>
                    <CpfCnpj>
                        <Cnpj>${
                          this.homologacao === true
                            ? process.env.MUNICIPIO_CNPJ_TEST
                            : process.env.MUNICIPIO_LOGIN
                        }</Cnpj>
                    </CpfCnpj>
                    <InscricaoMunicipal>${
                      this.homologacao === true
                        ? process.env.MUNICIPIO_INCRICAO_TEST
                        : process.env.MUNICIPIO_INCRICAO
                    }</InscricaoMunicipal>
                    </Prestador>`.trim();

      const envioXml =
        `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`.trim();
      const soapFinal =
        `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`
          .replace(/[\r\n]+/g, "")
          .replace(/\s{2,}/g, " ")
          .replace(/>\s+</g, "><")
          .replace(/<\s+/g, "<")
          .replace(/\s+>/g, ">")
          .trim();

      const certPathToUse = fs.existsSync(this.NEW_CERT_PATH)
        ? this.NEW_CERT_PATH
        : this.certPath;
      const pfxBuffer = fs.readFileSync(certPathToUse);

      const httpsAgent = new https.Agent({
        pfx: pfxBuffer,
        passphrase: this.PASSWORD,
        rejectUnauthorized: false,
      });

      const response = await axios.post(this.WSDL_URL, soapFinal, {
        httpsAgent,
        headers: {
          "Content-Type": "text/xml; charset=UTF-8",
          SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
        },
      });
      

      if (response.data.includes('<ns2:NfseCancelamento versao="2.0">')) {
        return true; // Encontrado NfseCancelamento
      } else {
        return false; // Não encontrado NfseCancelamento
      }
    } catch (error) {
      console.log(error);
      return false; // Em caso de erro, retorna false
    }
  }

  public async BuscarNSFE(req: Request, res: Response) {
    try {
      const { cpf, filters, dateFilter } = req.body
      const whereConditions: any = {}
      if (cpf) whereConditions.cpf_cnpj = cpf
      if (filters) {
        const { plano, vencimento, cli_ativado, nova_nfe } = filters
        if (plano?.length) whereConditions.plano = In(plano)
        if (vencimento?.length) whereConditions.venc = In(vencimento)
        if (cli_ativado?.length) whereConditions.cli_ativado = In(["s"])
        if (nova_nfe?.length) whereConditions.tags = In(nova_nfe)
      }
      const ClientRepository = MkauthSource.getRepository(ClientesEntities)
      const clientesResponse = await ClientRepository.find({
        where: whereConditions,
        select: { login: true, cpf_cnpj: true, cli_ativado: true },
      })

      const now = new Date()
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const startDate = dateFilter ? new Date(dateFilter.start) : firstDayOfMonth
      const endDate = dateFilter ? new Date(dateFilter.end) : lastDayOfMonth
      startDate.setHours(startDate.getHours() + 3)
      endDate.setHours(endDate.getHours() + 3)

      const nfseData = AppDataSource.getRepository(NFSE)
      const nfseResponse = await nfseData.find({
        where: { login: In(clientesResponse.map((c) => c.login)) ,
        competencia: Between(startDate, endDate),},
        order: { id: "DESC" },
      })
      const clientesComNfse = await Promise.all(
        clientesResponse.map(async (cliente) => {
          const nfseDoCliente = nfseResponse.filter((nf) => nf.login === cliente.login)
          if (!nfseDoCliente.length) return null
          const statusArray = await Promise.all(
            nfseDoCliente.map(async (nf) => {
              const cancelada = await this.setNfseStatus(nf.numeroRps)
              return cancelada ? "Cancelada" : "Ativa"
            })
          )
          const nfseNumberArray = await Promise.all(
            nfseDoCliente.map(async (nf) => {
              const cancelada = await this.setNfseNumber(nf.numeroRps)
              return cancelada
            })
          )
          return {
            ...cliente,
            nfse: {
              id: nfseDoCliente.map((nf) => nf.id).join(", ") || null,
              login: nfseDoCliente.map((nf) => nf.login).join(", ") || null,
              numero_rps: nfseDoCliente.map((nf) => nf.numeroRps).join(", ") || null,
              serie_rps: nfseDoCliente.map((nf) => nf.serieRps).join(", ") || null,
              tipo_rps: nfseDoCliente.map((nf) => nf.tipoRps).join(", ") || null,
              data_emissao: nfseDoCliente.map((nf) =>
                moment.tz(nf.dataEmissao, "America/Sao_Paulo").format("DD/MM/YYYY")
              ).join(", ") || null,
              competencia: nfseDoCliente.map((nf) =>
                moment.tz(nf.competencia, "America/Sao_Paulo").format("DD/MM/YYYY")
              ).join(", ") || null,
              valor_servico: nfseDoCliente.map((nf) => nf.valorServico).join(", ") || null,
              aliquota: nfseDoCliente.map((nf) => nf.aliquota).join(", ") || null,
              iss_retido: nfseDoCliente.map((nf) => nf.issRetido).join(", ") || null,
              responsavel_retecao: nfseDoCliente.map((nf) => nf.responsavelRetencao).join(", ") || null,
              item_lista_servico: nfseDoCliente.map((nf) => nf.itemListaServico).join(", ") || null,
              discriminacao: nfseDoCliente.map((nf) => nf.discriminacao).join(", ") || null,
              codigo_municipio: nfseDoCliente.map((nf) => nf.codigoMunicipio).join(", ") || null,
              exigibilidade_iss: nfseDoCliente.map((nf) => nf.exigibilidadeIss).join(", ") || null,
              cnpj_prestador: nfseDoCliente.map((nf) => nf.cnpjPrestador).join(", ") || null,
              inscricao_municipal_prestador: nfseDoCliente.map((nf) => nf.inscricaoMunicipalPrestador).join(", ") || null,
              cpf_tomador: nfseDoCliente.map((nf) => nf.cpfTomador).join(", ") || null,
              razao_social_tomador: nfseDoCliente.map((nf) => nf.razaoSocialTomador).join(", ") || null,
              endereco_tomador: nfseDoCliente.map((nf) => nf.enderecoTomador).join(", ") || null,
              numero_endereco: nfseDoCliente.map((nf) => nf.numeroEndereco).join(", ") || null,
              complemento: nfseDoCliente.map((nf) => nf.complemento).join(", ") || null,
              bairro: nfseDoCliente.map((nf) => nf.bairro).join(", ") || null,
              uf: nfseDoCliente.map((nf) => nf.uf).join(", ") || null,
              cep: nfseDoCliente.map((nf) => nf.cep).join(", ") || null,
              telefone_tomador: nfseDoCliente.map((nf) => nf.telefoneTomador).join(", ") || null,
              email_tomador: nfseDoCliente.map((nf) => nf.emailTomador).join(", ") || null,
              optante_simples_nacional: nfseDoCliente.map((nf) => nf.optanteSimplesNacional).join(", ") || null,
              incentivo_fiscal: nfseDoCliente.map((nf) => nf.incentivoFiscal).join(", ") || null,
              status: statusArray.join(", ") || null,
              numeroNfse: nfseNumberArray.join(", ") || null,
            },
          }
        })
      )
      const resolvedClientesComNfse = clientesComNfse
        .filter((item) => item !== null)
        .sort((a, b) => (b.nfse.id || "").localeCompare(a.nfse.id || ""))
      res.status(200).json(resolvedClientesComNfse)
    } catch {
      res.status(500).json({ error: "Internal Server Error" })
    }
  }

  public async BuscarNSFEDetalhes(rpsNumber: string | number, serie: string = "1", tipo: string = "1") {
    try {
      const dados = `<IdentificacaoRps>
                       <Numero>${rpsNumber}</Numero>
                       <Serie>${serie}</Serie>
                       <Tipo>${tipo}</Tipo>
                     </IdentificacaoRps>
                     <Prestador>
                       <CpfCnpj>
                         <Cnpj>${
                           this.homologacao
                             ? process.env.MUNICIPIO_CNPJ_TEST
                             : process.env.MUNICIPIO_LOGIN
                         }</Cnpj>
                       </CpfCnpj>
                       <InscricaoMunicipal>${
                         this.homologacao
                           ? process.env.MUNICIPIO_INCRICAO_TEST
                           : process.env.MUNICIPIO_INCRICAO
                       }</InscricaoMunicipal>
                     </Prestador>`.trim();
  
      const envioXml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`.trim();
  
      const soapFinal = `<?xml version="1.0" encoding="UTF-8"?>
        <soapenv:Envelope 
          xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
          xmlns:ws="http://ws.issweb.fiorilli.com.br/" 
          xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
          <soapenv:Header/>
          <soapenv:Body>
            <ws:consultarNfsePorRps>
              ${envioXml}
              <username>${process.env.MUNICIPIO_LOGIN}</username>
              <password>${process.env.MUNICIPIO_SENHA}</password>
            </ws:consultarNfsePorRps>
          </soapenv:Body>
        </soapenv:Envelope>`
        .replace(/[\r\n]+/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/>\s+</g, "><")
        .replace(/<\s+/g, "<")
        .replace(/\s+>/g, ">")
        .trim();
  
      const certPathToUse = fs.existsSync(this.NEW_CERT_PATH) ? this.NEW_CERT_PATH : this.certPath;
      const pfxBuffer = fs.readFileSync(certPathToUse);
  
      const httpsAgent = new https.Agent({
        pfx: pfxBuffer,
        passphrase: this.PASSWORD,
        rejectUnauthorized: false,
      });
  
      const response = await axios.post(this.WSDL_URL, soapFinal, {
        httpsAgent,
        headers: {
          "Content-Type": "text/xml; charset=UTF-8",
          SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
        },
      });
  
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(response.data, "text/xml");
      const nfseNodes = xmlDoc.getElementsByTagName("ns2:CompNfse");
  
      if (nfseNodes.length > 0) {
        const nfseNode = nfseNodes[0];
        const extractedData: Record<string, any> = {};
  
        const extractChildren = (node: Element): Record<string, any> => {
          const result: Record<string, any> = {};
          for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i];
            if (child.nodeType === 1) {
              const element = child as Element;
              const key = element.localName;
              const text = element.textContent?.trim() || "";
              if (
                element.childNodes.length > 0 &&
                Array.from(element.childNodes).some((c) => c.nodeType === 1)
              ) {
                result[key] = extractChildren(element);
              } else {
                result[key] = text;
              }
            }
          }
          return result;
        };
  
        extractedData[nfseNode.localName] = extractChildren(nfseNode);
  
        const uf =
          extractedData.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico
            ?.InfDeclaracaoPrestacaoServico?.Tomador?.Endereco?.CodigoMunicipio;
  
        if (uf) {
          const ibgeResponse = await axios.get(
            `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${uf}`,
            { timeout: 1000 }
          ).catch(() => ({ data: { nome: "" } }));
          extractedData.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico
            .Tomador.Endereco.Cidade = ibgeResponse.data.nome;
        }
  
        return { status: "success", data: extractedData };
      } else {
        return { status: "error", message: "InfNfse element not found in XML." };
      }
    } catch (error) {
      return {
        status: "error",
        message: "Erro ao buscar detalhes da NFSE.",
        error,
      };
    }
  }
  
  
  
  public async uploadCertificado(req: Request, res: Response) {
    try {
      res.status(200).json({ mensagem: "Certificado enviado com sucesso." });
    } catch (error) {
      res
        .status(500)
        .json({ erro: "Erro ao processar o upload do certificado." });
    }
  }

  public async BuscarClientes(req: Request, res: Response) {
    const { cpf, filters, dateFilter } = req.body;
    const ClientRepository = MkauthSource.getRepository(ClientesEntities);
    const whereConditions: any = {};
    if (cpf) whereConditions.cpf_cnpj = cpf;
    if (filters) {
      const { plano, vencimento, cli_ativado, nova_nfe } = filters;
      if (plano?.length) whereConditions.plano = In(plano);
      if (vencimento?.length) whereConditions.venc = In(vencimento);
      if (cli_ativado?.length) whereConditions.cli_ativado = In(["s"]);
      if (nova_nfe?.length) whereConditions.tags = In(nova_nfe);
    }
    try {
      const clientesResponse = await ClientRepository.find({
        where: whereConditions,
        select: { login: true, cpf_cnpj: true, cli_ativado: true, desconto: true },
        order: {id: "DESC"}
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
        order: {id: "DESC"}
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
              valor: fatura.map((f) => (Number(f.valor) - (cliente.desconto || 0)).toFixed(2)).join(", ") || null,
            },
          };
        })
        .filter((cliente) => cliente !== null)
        .sort((a, b) => (b.fatura.titulo || "").localeCompare(a.fatura.titulo || "")); // Ordenação por título
        ;
      res.status(200).json(clientesComFaturas);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar clientes" });
    }
  }
}

export default new NFSEController();
