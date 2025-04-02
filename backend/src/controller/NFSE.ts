import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as https from "https";
import { execFileSync, execSync } from "child_process";
import axios from "axios";
import * as dotenv from "dotenv";
import { Request, Response } from "express";
import { SignedXml } from "xml-crypto";
import * as forge from "node-forge";
import { DOMParser } from "xmldom";
import MkauthSource from "../database/MkauthSource";
import AppDataSource from "../database/DataSource";
import { NFSE } from "../entities/NFSE";
import { ClientesEntities } from "../entities/ClientesEntities";
import { Faturas } from "../entities/Faturas";
import { In, Between, IsNull } from "typeorm";
import moment from "moment-timezone";
import { processarCertificado } from "../utils/certUtils";
import { parseStringPromise } from "xml2js";

dotenv.config();

class NFSEController {
  private certPath = path.resolve(__dirname, "../files/certificado.pfx");
  private homologacao = process.env.SERVIDOR_HOMOLOGACAO === "true";
  private WSDL_URL = this.homologacao
    ? "http://fi1.fiorilli.com.br:5663/IssWeb-ejb/IssWebWS/IssWebWS?wsdl"
    : "https://wsnfe.arealva.sp.gov.br:8443/IssWeb-ejb/IssWebWS/IssWebWS?wsdl";
  private TEMP_DIR = path.resolve(__dirname, "../files");
  private PASSWORD = "";
  private DECRYPTED_CERT_PATH = path.join(
    this.TEMP_DIR,
    "decrypted_certificado.tmp"
  );
  private NEW_CERT_PATH = path.join(this.TEMP_DIR, "new_certificado.pfx");

  constructor() {
    this.uploadCertificado = this.uploadCertificado.bind(this);
    this.iniciar = this.iniciar.bind(this);
    this.gerarNFSE = this.gerarNFSE.bind(this);
    this.gerarRpsXml = this.gerarRpsXml.bind(this);
    this.extrairChaveECertificado = this.extrairChaveECertificado.bind(this);
    this.assinarXml = this.assinarXml.bind(this);
    this.imprimirNFSE = this.imprimirNFSE.bind(this);
    this.verificaRps = this.verificaRps.bind(this);
    this.cancelarNfse = this.cancelarNfse.bind(this);
    this.setPassword = this.setPassword.bind(this);
    this.setNfseNumber = this.setNfseNumber.bind(this);
    this.setNfseStatus = this.setNfseStatus.bind(this);
    this.BuscarNSFE = this.BuscarNSFE.bind(this);
    this.BuscarNSFEDetalhes = this.BuscarNSFEDetalhes.bind(this);
    this.BuscarClientes = this.BuscarClientes.bind(this);
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

  async iniciar(req: Request, res: Response) {
    try {
      let { password, clientesSelecionados, aliquota, service, reducao } =
        req.body;
      this.PASSWORD = password;
      aliquota = aliquota?.trim() ? aliquota : "4.4269";
      aliquota = aliquota.replace(",", ".").replace("%", "");
      if (!service) service = "Servico de Suporte Tecnico";
      if (!reducao) reducao = 40;
      reducao = Number(reducao) / 100;
      const result = await this.gerarNFSE(
        password,
        clientesSelecionados,
        "EnviarLoteRpsSincronoEnvio",
        aliquota,
        service,
        reducao
      );
      if (Array.isArray(result)) {
        const ok = result.every((r) => r.status === "200");
        if (ok)
          res.status(200).json({ mensagem: "RPS criado com sucesso!", result });
        else res.status(500).json({ erro: "Erro ao criar o RPS." });
      } else {
        // if (result?.status === "200") res.status(200).json({ mensagem: "RPS criado com sucesso!", result });
        // else res.status(500).json({ erro: "Erro ao criar o RPS." });
      }
    } catch {
      res.status(500).json({ erro: "Erro ao criar o RPS." });
    }
  }

  async gerarNFSE(
    password: string,
    ids: string[],
    SOAPAction: string,
    aliquota: string,
    service: string,
    reducao: number
  ) {
    try {
      const certPathToUse = processarCertificado(
        this.certPath,
        password,
        this.TEMP_DIR
      );
      const pfxBuffer = fs.readFileSync(certPathToUse);
      const httpsAgent = new https.Agent({
        pfx: pfxBuffer,
        passphrase: password,
        rejectUnauthorized: false,
      });
      const NsfeData = AppDataSource.getRepository(NFSE);
      const nfseResponse = await NsfeData.find({
        order: { id: "DESC" },
        take: 1,
      });
      let nfseNumber = nfseResponse[0]?.numeroRps
        ? nfseResponse[0].numeroRps + 1
        : 1;

      console.log(nfseNumber);

      const respArr: any[] = [];
      if (!fs.existsSync("log")) fs.mkdirSync("log", { recursive: true });
      const logPath = "./log/xml_log.txt";

      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        let rpsXmls = "";

        for (const bid of batch) {
          // Gerar o XML do RPS sem assinatura
          let rps = await this.gerarRpsXml(
            bid,
            Number(aliquota).toFixed(4),
            service,
            reducao,
            nfseNumber,
            nfseResponse[0]
          );

          // Assinar cada RPS individualmente
          const signedRps = this.assinarXml(
            rps,
            "InfDeclaracaoPrestacaoServico"
          );

          // Adicionar o RPS assinado na lista
          rpsXmls += signedRps;

          // Incrementar o número do RPS
          nfseNumber++;
        }

        // Criar o LoteRps contendo todos os RPS assinados
        let lote = `
    <LoteRps versao="2.01" Id="lote${nfseNumber}">
      <NumeroLote>1</NumeroLote>
      <CpfCnpj><Cnpj>${
        this.homologacao
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN
      }</Cnpj></CpfCnpj>
      <InscricaoMunicipal>${
        this.homologacao
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO
      }</InscricaoMunicipal>
      <QuantidadeRps>${batch.length}</QuantidadeRps>
      <ListaRps>${rpsXmls}</ListaRps>
    </LoteRps>
  `;

        lote = lote
          .replace(/[\r\n]+/g, "")
          .replace(/>\s+</g, "><")
          .trim();

        let envio = `<EnviarLoteRpsSincronoEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${lote}</EnviarLoteRpsSincronoEnvio>`;
        let soap = `<?xml version="1.0" encoding="UTF-8"?>
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
          <soapenv:Header/>
          <soapenv:Body>
              <ws:recepcionarLoteRpsSincrono>
                  ${envio}
                  <username>${process.env.MUNICIPIO_LOGIN}</username>
                  <password>${process.env.MUNICIPIO_SENHA}</password>
              </ws:recepcionarLoteRpsSincrono>
          </soapenv:Body>
      </soapenv:Envelope>`;

        // Remove todas as quebras de linha e espaços desnecessários
        soap = soap
          .replace(/[\r\n]+/g, "")
          .replace(/>\s+</g, "><")
          .trim();

        // Salva o lote inteiro como uma linha única no arquivo de log
        fs.appendFileSync(logPath, soap + "\n", "utf8");

        const response = await axios.post(this.WSDL_URL, soap, {
          httpsAgent,
          headers: { "Content-Type": "text/xml; charset=UTF-8", SOAPAction },
        });

        const firstId = batch[0];
        const RPSQuery = MkauthSource.getRepository(Faturas);
        const rpsData = await RPSQuery.findOne({
          where: { id: Number(firstId) },
        });
        const ClientRepository = MkauthSource.getRepository(ClientesEntities);
        const FaturasRepository = MkauthSource.getRepository(Faturas);
        const FaturasData = await FaturasRepository.findOne({
          where: { id: Number(firstId) },
        });
        const ClientData = await ClientRepository.findOne({
          where: { login: FaturasData?.login },
        });
        const resp = await axios.get(
          `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${ClientData?.cidade}`
        );
        const municipio = resp.data.id;
        let valorMenosDesconto = ClientData?.desconto
          ? Number(rpsData?.valor) - Number(ClientData?.desconto)
          : Number(rpsData?.valor);
        let valorReduzido =
          Number(reducao) === 0
            ? valorMenosDesconto
            : Number(valorMenosDesconto) * Number(reducao);
        valorReduzido = Number(valorReduzido.toFixed(2));
        const insertDatabase = NsfeData.create({
          login: rpsData?.login || "",
          numeroRps: nfseNumber - 1,
          serieRps: nfseResponse[0]?.serieRps || "",
          tipoRps: nfseResponse[0]?.tipoRps || 0,
          dataEmissao: rpsData?.processamento
            ? new Date(rpsData.processamento)
            : new Date(),
          competencia: rpsData?.datavenc
            ? new Date(rpsData.datavenc)
            : new Date(),
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
          telefoneTomador:
            ClientData?.celular.replace(/[^0-9]/g, "") || undefined,
          emailTomador: ClientData?.email || undefined,
          optanteSimplesNacional: 1,
          incentivoFiscal: 2,
        });

        const xml = response.data;
        const parsed = await parseStringPromise(xml, { explicitArray: false });

        console.log(response.data);

        // Caminho até a resposta SOAP
        const resposta = parsed?.["soap:Envelope"]?.["soap:Body"]?.["ns3:recepcionarLoteRpsSincronoResponse"]?.["ns2:EnviarLoteRpsSincronoResposta"];

        // Verifica se existe mensagem de erro
        const temErro = resposta?.ListaMensagemRetornoLote?.MensagemRetorno;

        if (temErro) {
          console.log("Erro detectado na resposta SOAP:", temErro);
          respArr.push({ status: "500", response: "Erro na geração da NFSe", detalhes: temErro });
          continue; // pula este lote, não insere no banco
        }

        if (await this.verificaRps(nfseNumber)) {
          await NsfeData.save(insertDatabase);
          respArr.push({ status: "200", response: soap });
        } else {
          respArr.push({ status: "500", response: "ERRO NA CONSULTA DE RPS" });
        }

        console.log(response);

        respArr.push({ status: "200", response: "ok" });
      }
      if (fs.existsSync(this.NEW_CERT_PATH)) fs.unlinkSync(this.NEW_CERT_PATH);
      if (fs.existsSync(this.DECRYPTED_CERT_PATH)) fs.unlinkSync(this.DECRYPTED_CERT_PATH);
      return respArr;
    } catch (error: any) {
      console.log(error);
      return { status: "500", response: error || "Erro" };
    }
  }

  async gerarRpsXml(
    id: string,
    aliquota: string,
    service: string,
    reducao: number,
    nfseNumber: number,
    nfseBase: any
  ) {
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
    const ibge = await axios.get(
      `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${ClientData?.cidade}`
    );
    let val = ClientData?.desconto
      ? Number(rpsData?.valor) - Number(ClientData?.desconto)
      : Number(rpsData?.valor);
    val = val * reducao;
    val = Number(val.toFixed(2));
    let xml = `
      <Rps xmlns="http://www.abrasf.org.br/nfse.xsd">
        <InfDeclaracaoPrestacaoServico Id="RPS${rpsData?.uuid_lanc}">
          <Rps>
            <IdentificacaoRps>
              <Numero>${nfseNumber}</Numero>
              <Serie>${nfseBase?.serieRps}</Serie>
              <Tipo>${nfseBase?.tipoRps}</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${new Date()
              .toISOString()
              .substring(0, 10)}</DataEmissao>
            <Status>1</Status>
          </Rps>
          <Competencia>${new Date()
            .toISOString()
            .substring(0, 10)}</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>${val}</ValorServicos>
              <Aliquota>${this.homologacao ? "2.00" : aliquota}</Aliquota>
            </Valores>
            <IssRetido>${nfseBase?.issRetido}</IssRetido>
            <ResponsavelRetencao>${
              nfseBase?.responsavelRetencao
            }</ResponsavelRetencao>
            <ItemListaServico>${
              this.homologacao ? "17.01" : nfseBase?.itemListaServico
            }</ItemListaServico>
            <Discriminacao>${service}</Discriminacao>
            <CodigoMunicipio>3503406</CodigoMunicipio>
            <ExigibilidadeISS>${nfseBase?.exigibilidadeIss}</ExigibilidadeISS>
          </Servico>
          <Prestador>
            <CpfCnpj><Cnpj>${
              this.homologacao
                ? process.env.MUNICIPIO_CNPJ_TEST
                : process.env.MUNICIPIO_LOGIN
            }</Cnpj></CpfCnpj>
            <InscricaoMunicipal>${
              this.homologacao
                ? process.env.MUNICIPIO_INCRICAO_TEST
                : process.env.MUNICIPIO_INCRICAO
            }</InscricaoMunicipal>
          </Prestador>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>
                <${
                  ClientData?.cpf_cnpj.length === 11 ? "Cpf" : "Cnpj"
                }>${ClientData?.cpf_cnpj.replace(/[^0-9]/g, "")}</${
      ClientData?.cpf_cnpj.length === 11 ? "Cpf" : "Cnpj"
    }>
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${ClientData?.nome}</RazaoSocial>
            <Endereco>
              <Endereco>${ClientData?.endereco}</Endereco>
              <Numero>${ClientData?.numero}</Numero>
              <Complemento>${ClientData?.complemento}</Complemento>
              <Bairro>${ClientData?.bairro}</Bairro>
              <CodigoMunicipio>${ibge.data.id}</CodigoMunicipio>
              <Uf>SP</Uf>
              <Cep>${ClientData?.cep.replace(/[^0-9]/g, "")}</Cep>
            </Endereco>
            <Contato>
              <Telefone>${ClientData?.celular.replace(/[^0-9]/g, "")}</Telefone>
              <Email>${
                this.homologacao ? "teste@gmail.com" : ClientData?.email
              }</Email>
            </Contato>
          </Tomador>
          ${
            this.homologacao
              ? ""
              : "<RegimeEspecialTributacao>6</RegimeEspecialTributacao>"
          }
          <OptanteSimplesNacional>${
            this.homologacao ? "2" : nfseBase?.optanteSimplesNacional
          }</OptanteSimplesNacional>
          <IncentivoFiscal>${nfseBase?.incentivoFiscal}</IncentivoFiscal>
        </InfDeclaracaoPrestacaoServico>
      </Rps>
    `;
    return xml
      .replace(/[\r\n]+/g, "")
      .replace(/>\s+</g, "><")
      .trim();
  }

  extrairChaveECertificado() {
    const pfxBuffer = fs.readFileSync(this.certPath);
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString("binary"));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.PASSWORD);
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

  assinarXml(xml: string, referenceId: string) {
    const { privateKeyPem, x509Certificate } = this.extrairChaveECertificado();
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

  async imprimirNFSE(req: Request, res: Response) {
    const { rpsNumber } = req.body;
    const result = await Promise.all(
      rpsNumber.map((rps: string | number) => this.BuscarNSFEDetalhes(rps))
    );
    res.status(200).json(result);
  }

  async verificaRps(rpsNumber: string | number, serie = "1", tipo = "1") {
    try {
      const dados = `<IdentificacaoRps><Numero>${rpsNumber}</Numero><Serie>${serie}</Serie><Tipo>${tipo}</Tipo></IdentificacaoRps><Prestador><CpfCnpj><Cnpj>${
        this.homologacao
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN
      }</Cnpj></CpfCnpj><InscricaoMunicipal>${
        this.homologacao
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO
      }</InscricaoMunicipal></Prestador>`;
      const envioXml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`;
      const soapFinal =
        `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`
          .replace(/[\r\n]+/g, "")
          .replace(/\s{2,}/g, " ")
          .replace(/>\s+</g, "><")
          .trim();
      const certPathToUse = processarCertificado(
        this.certPath,
        this.PASSWORD,
        this.TEMP_DIR
      );
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
      if (response.data.includes("<ns2:Codigo>E92</ns2:Codigo>")) return true;
      return false;
    } catch {
      return false;
    }
  }

  async cancelarNfse(req: Request, res: Response) {
    try {
      const { rpsNumber, password } = req.body;
      if (!Array.isArray(rpsNumber)) {
        res.status(400).json({ error: "rpsNumber must be an array" });
        return;
      }
      this.PASSWORD = password;
      const arr = await Promise.all(
        rpsNumber.map(async (rps: string | number) => {
          try {
            await this.setNfseNumber(rps);
            const nfseNumber = await this.setNfseNumber(rps);
            const dados = `<Pedido><InfPedidoCancelamento Id="CANCEL${nfseNumber}"><IdentificacaoNfse><Numero>${nfseNumber}</Numero><CpfCnpj><Cnpj>${
              this.homologacao
                ? process.env.MUNICIPIO_CNPJ_TEST
                : process.env.MUNICIPIO_LOGIN
            }</Cnpj></CpfCnpj><InscricaoMunicipal>${
              this.homologacao
                ? process.env.MUNICIPIO_INCRICAO_TEST
                : process.env.MUNICIPIO_INCRICAO
            }</InscricaoMunicipal><CodigoMunicipio>3503406</CodigoMunicipio></IdentificacaoNfse><CodigoCancelamento>2</CodigoCancelamento></InfPedidoCancelamento></Pedido>`;
            const envioXml = `<CancelarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</CancelarNfseEnvio>`;
            const envioXmlAssinado = this.assinarXml(
              envioXml,
              "InfPedidoCancelamento"
            );
            const soapFinal =
              `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:cancelarNfse>${envioXmlAssinado}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:cancelarNfse></soapenv:Body></soapenv:Envelope>`
                .replace(/[\r\n]+/g, "")
                .replace(/\s{2,}/g, " ")
                .replace(/>\s+</g, "><")
                .trim();
            const soapFinalHomologacao =
              `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:cancelarNfse>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:cancelarNfse></soapenv:Body></soapenv:Envelope>`
                .replace(/[\r\n]+/g, "")
                .replace(/\s{2,}/g, " ")
                .replace(/>\s+</g, "><")
                .trim();
            const certPathToUse = processarCertificado(
              this.certPath,
              this.PASSWORD,
              this.TEMP_DIR
            );
            const pfxBuffer = fs.readFileSync(certPathToUse);
            const httpsAgent = new https.Agent({
              pfx: pfxBuffer,
              passphrase: this.PASSWORD,
              rejectUnauthorized: false,
            });
            let response;
            if (this.homologacao) {
              response = await axios.post(this.WSDL_URL, soapFinalHomologacao, {
                httpsAgent,
                headers: {
                  "Content-Type": "text/xml; charset=UTF-8",
                  SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
                },
              });
            } else {
              response = await axios.post(this.WSDL_URL, soapFinal, {
                httpsAgent,
                headers: {
                  "Content-Type": "text/xml; charset=UTF-8",
                  SOAPAction: "ConsultarNfseServicoPrestadoEnvio",
                },
              });
            }
            return { rps, success: true, response: response.data };
          } catch (error) {
            return { rps, success: false, error };
          }
        })
      );
      res.status(200).json(arr);
    } catch {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async setPassword(req: Request, res: Response) {
    const { password } = req.body;
    this.PASSWORD = password;
    res.status(200).json({ error: "Sucesso" });
  }

  async setNfseNumber(rpsNumber: string | number, serie = "1", tipo = "1") {
    try {
      const dados = `<IdentificacaoRps><Numero>${rpsNumber}</Numero><Serie>${serie}</Serie><Tipo>${tipo}</Tipo></IdentificacaoRps><Prestador><CpfCnpj><Cnpj>${
        this.homologacao
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN
      }</Cnpj></CpfCnpj><InscricaoMunicipal>${
        this.homologacao
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO
      }</InscricaoMunicipal></Prestador>`;
      const envioXml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`;
      const soapFinal = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`;
      const certPathToUse = processarCertificado(
        this.certPath,
        this.PASSWORD,
        this.TEMP_DIR
      );
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
      if (match && match[1]) return match[1];
      return null;
    } catch (error) {
      return error;
    }
  }

  async setNfseStatus(rpsNumber: string | number, serie = "1", tipo = "1") {
    try {
      const dados = `<IdentificacaoRps><Numero>${rpsNumber}</Numero><Serie>${serie}</Serie><Tipo>${tipo}</Tipo></IdentificacaoRps><Prestador><CpfCnpj><Cnpj>${
        this.homologacao
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN
      }</Cnpj></CpfCnpj><InscricaoMunicipal>${
        this.homologacao
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO
      }</InscricaoMunicipal></Prestador>`;
      const envioXml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`;
      const soapFinal =
        `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`
          .replace(/[\r\n]+/g, "")
          .replace(/\s{2,}/g, " ")
          .replace(/>\s+</g, "><")
          .trim();
      const certPathToUse = processarCertificado(
        this.certPath,
        this.PASSWORD,
        this.TEMP_DIR
      );
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
      if (response.data.includes('<ns2:NfseCancelamento versao="2.0">'))
        return true;
      return false;
    } catch {
      return false;
    }
  }

  async BuscarNSFE(req: Request, res: Response) {
    try {
      const { cpf, filters, dateFilter } = req.body;
      const w: any = {};
      if (cpf) w.cpf_cnpj = cpf;
      if (filters) {
        const { plano, vencimento, cli_ativado, nova_nfe } = filters;
        if (plano?.length) w.plano = In(plano);
        if (vencimento?.length) w.venc = In(vencimento);
        if (cli_ativado?.length) w.cli_ativado = In(["s"]);
        if (nova_nfe?.length) w.tags = In(nova_nfe);
      }
      const ClientRepository = MkauthSource.getRepository(ClientesEntities);
      const clientesResponse = await ClientRepository.find({
        where: w,
        select: { login: true, cpf_cnpj: true, cli_ativado: true },
      });
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startDate = dateFilter
        ? new Date(dateFilter.start)
        : firstDayOfMonth;
      const endDate = dateFilter ? new Date(dateFilter.end) : lastDayOfMonth;
      startDate.setHours(startDate.getHours() + 3);
      endDate.setHours(endDate.getHours() + 3);
      const nfseData = AppDataSource.getRepository(NFSE);
      const nfseResponse = await nfseData.find({
        where: {
          login: In(clientesResponse.map((c) => c.login)),
          competencia: Between(startDate, endDate),
        },
        order: { id: "DESC" },
      });
      const arr = await Promise.all(
        clientesResponse.map(async (c) => {
          const nfseDoCliente = nfseResponse.filter(
            (nf) => nf.login === c.login
          );
          if (!nfseDoCliente.length) return null;
          const statusArray = await Promise.all(
            nfseDoCliente.map(async (nf) =>
              (await this.setNfseStatus(nf.numeroRps)) ? "Cancelada" : "Ativa"
            )
          );
          const nfseNumberArray = await Promise.all(
            nfseDoCliente.map(async (nf) => this.setNfseNumber(nf.numeroRps))
          );
          return {
            ...c,
            nfse: {
              id: nfseDoCliente.map((nf) => nf.id).join(", ") || null,
              login: nfseDoCliente.map((nf) => nf.login).join(", ") || null,
              numero_rps:
                nfseDoCliente.map((nf) => nf.numeroRps).join(", ") || null,
              serie_rps:
                nfseDoCliente.map((nf) => nf.serieRps).join(", ") || null,
              tipo_rps:
                nfseDoCliente.map((nf) => nf.tipoRps).join(", ") || null,
              data_emissao:
                nfseDoCliente
                  .map((nf) =>
                    moment
                      .tz(nf.dataEmissao, "America/Sao_Paulo")
                      .format("DD/MM/YYYY")
                  )
                  .join(", ") || null,
              competencia:
                nfseDoCliente
                  .map((nf) =>
                    moment
                      .tz(nf.competencia, "America/Sao_Paulo")
                      .format("DD/MM/YYYY")
                  )
                  .join(", ") || null,
              valor_servico:
                nfseDoCliente.map((nf) => nf.valorServico).join(", ") || null,
              aliquota:
                nfseDoCliente.map((nf) => nf.aliquota).join(", ") || null,
              iss_retido:
                nfseDoCliente.map((nf) => nf.issRetido).join(", ") || null,
              responsavel_retecao:
                nfseDoCliente.map((nf) => nf.responsavelRetencao).join(", ") ||
                null,
              item_lista_servico:
                nfseDoCliente.map((nf) => nf.itemListaServico).join(", ") ||
                null,
              discriminacao:
                nfseDoCliente.map((nf) => nf.discriminacao).join(", ") || null,
              codigo_municipio:
                nfseDoCliente.map((nf) => nf.codigoMunicipio).join(", ") ||
                null,
              exigibilidade_iss:
                nfseDoCliente.map((nf) => nf.exigibilidadeIss).join(", ") ||
                null,
              cnpj_prestador:
                nfseDoCliente.map((nf) => nf.cnpjPrestador).join(", ") || null,
              inscricao_municipal_prestador:
                nfseDoCliente
                  .map((nf) => nf.inscricaoMunicipalPrestador)
                  .join(", ") || null,
              cpf_tomador:
                nfseDoCliente.map((nf) => nf.cpfTomador).join(", ") || null,
              razao_social_tomador:
                nfseDoCliente.map((nf) => nf.razaoSocialTomador).join(", ") ||
                null,
              endereco_tomador:
                nfseDoCliente.map((nf) => nf.enderecoTomador).join(", ") ||
                null,
              numero_endereco:
                nfseDoCliente.map((nf) => nf.numeroEndereco).join(", ") || null,
              complemento:
                nfseDoCliente.map((nf) => nf.complemento).join(", ") || null,
              bairro: nfseDoCliente.map((nf) => nf.bairro).join(", ") || null,
              uf: nfseDoCliente.map((nf) => nf.uf).join(", ") || null,
              cep: nfseDoCliente.map((nf) => nf.cep).join(", ") || null,
              telefone_tomador:
                nfseDoCliente.map((nf) => nf.telefoneTomador).join(", ") ||
                null,
              email_tomador:
                nfseDoCliente.map((nf) => nf.emailTomador).join(", ") || null,
              optante_simples_nacional:
                nfseDoCliente
                  .map((nf) => nf.optanteSimplesNacional)
                  .join(", ") || null,
              incentivo_fiscal:
                nfseDoCliente.map((nf) => nf.incentivoFiscal).join(", ") ||
                null,
              status: statusArray.join(", ") || null,
              numeroNfse: nfseNumberArray.join(", ") || null,
            },
          };
        })
      );
      const filtered = arr
        .filter((i): i is NonNullable<typeof i> => i !== null) // Remove nulls corretamente
        .sort((a, b) => (b?.nfse?.id || "").localeCompare(a?.nfse?.id || ""));
      res.status(200).json(filtered);
    } catch {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async BuscarNSFEDetalhes(
    rpsNumber: string | number,
    serie = "1",
    tipo = "1"
  ) {
    try {
      const dados = `<IdentificacaoRps><Numero>${rpsNumber}</Numero><Serie>${serie}</Serie><Tipo>${tipo}</Tipo></IdentificacaoRps><Prestador><CpfCnpj><Cnpj>${
        this.homologacao
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN
      }</Cnpj></CpfCnpj><InscricaoMunicipal>${
        this.homologacao
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO
      }</InscricaoMunicipal></Prestador>`;
      const envioXml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`;
      const soapFinal =
        `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${process.env.MUNICIPIO_LOGIN}</username><password>${process.env.MUNICIPIO_SENHA}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`
          .replace(/[\r\n]+/g, "")
          .replace(/\s{2,}/g, " ")
          .replace(/>\s+</g, "><")
          .trim();
      const certPathToUse = processarCertificado(
        this.certPath,
        this.PASSWORD,
        this.TEMP_DIR
      );
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
        const extractChildren = (node: Element) => {
          const r: Record<string, any> = {};
          for (let i = 0; i < node.childNodes.length; i++) {
            const c = node.childNodes[i];
            if (c.nodeType === 1) {
              const el = c as Element;
              const k = el.localName;
              const txt = el.textContent?.trim() || "";
              if (
                el.childNodes.length > 0 &&
                Array.from(el.childNodes).some((a) => a.nodeType === 1)
              )
                r[k] = extractChildren(el);
              else r[k] = txt;
            }
          }
          return r;
        };
        extractedData[nfseNode.localName] = extractChildren(nfseNode);
        const uf =
          extractedData.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico
            ?.InfDeclaracaoPrestacaoServico?.Tomador?.Endereco?.CodigoMunicipio;
        if (uf) {
          const ibgeResponse = await axios
            .get(
              `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${uf}`,
              { timeout: 1000 }
            )
            .catch(() => ({ data: { nome: "" } }));
          extractedData.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Tomador.Endereco.Cidade =
            ibgeResponse.data.nome;
        }
        return { status: "success", data: extractedData };
      } else {
        return {
          status: "error",
          message: "InfNfse element not found in XML.",
        };
      }
    } catch (error) {
      return {
        status: "error",
        message: "Erro ao buscar detalhes da NFSE.",
        error,
      };
    }
  }

  async BuscarClientes(req: Request, res: Response) {
    const { cpf, filters, dateFilter } = req.body;
    const ClientRepository = MkauthSource.getRepository(ClientesEntities);
    const w: any = {};
    let servicosFilter: string[] = ["mensalidade"];
    if (cpf) w.cpf_cnpj = cpf;
    if (filters) {
      let { plano, vencimento, cli_ativado, SCM, servicos } = filters;
      if (plano?.length) w.plano = In(plano);
      if (vencimento?.length) w.venc = In(vencimento);
      if (cli_ativado?.length) w.cli_ativado = In(["s"]);
      if (SCM?.length) {
        w.vendedor = In(SCM);
      } else {
        w.vendedor = In(["SVA"]);
      }
      if (servicos?.length) servicosFilter = servicos;
    }
    try {
      const clientesResponse = await ClientRepository.find({
        where: w,
        select: {
          login: true,
          cpf_cnpj: true,
          cli_ativado: true,
          desconto: true,
        },
        order: { id: "DESC" },
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
          login: In(clientesResponse.map((c) => c.login)),
          datavenc: Between(startDate, endDate),
          datadel: IsNull(),
          tipo: In(servicosFilter),
        },
        select: {
          id: true,
          login: true,
          datavenc: true,
          tipo: true,
          valor: true,
        },
        order: { id: "DESC" },
      });
      const arr = clientesResponse
        .map((cliente) => {
          const fat = faturasResponse.filter((f) => f.login === cliente.login);
          if (!fat.length) return null;
          return {
            ...cliente,
            fatura: {
              titulo: fat.map((f) => f.id).join(", ") || null,
              login: fat.map((f) => f.login).join(", ") || null,
              datavenc:
                fat
                  .map((f) => new Date(f.datavenc).toLocaleDateString("pt-BR"))
                  .join(", ") || null,
              tipo: fat.map((f) => f.tipo).join(", ") || null,
              valor:
                fat
                  .map((f) =>
                    (Number(f.valor) - (cliente.desconto || 0)).toFixed(2)
                  )
                  .join(", ") || null,
            },
          };
        })
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .sort((a, b) =>
          (b?.fatura?.titulo || "").localeCompare(a?.fatura?.titulo || "")
        );
      res.status(200).json(arr);
    } catch {
      res.status(500).json({ message: "Erro ao buscar clientes" });
    }
  }
}

export default new NFSEController();
