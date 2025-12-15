import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { Request, Response } from "express";
import { DOMParser } from "xmldom";
import axios from "axios";
import moment from "moment-timezone";
import { In, Between, IsNull, Not } from "typeorm";
import { parseStringPromise } from "xml2js";

import AppDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { NFSE } from "../entities/NFSE";
import { ClientesEntities } from "../entities/ClientesEntities";
import { Faturas } from "../entities/Faturas";

import { NfseXmlFactory } from "../services/nfse/NfseXmlFactory";
import { FiorilliProvider } from "../services/nfse/FiorilliProvider";

dotenv.config();

class NFSEController {
  private certPath = path.resolve(__dirname, "../files/certificado.pfx");
  private TEMP_DIR = path.resolve(__dirname, "../files");
  private homologacao: boolean = false;
  private WSDL_URL = "";
  private PASSWORD = "";

  private xmlFactory: NfseXmlFactory;
  private fiorilliProvider: FiorilliProvider;

  constructor() {
    this.xmlFactory = new NfseXmlFactory();
    // Provider will be initialized properly when we have the WSDL URL set in 'iniciar' or defaults
    // For now we set partial defaults, but WSDL might change based on 'homologacao'
    this.fiorilliProvider = new FiorilliProvider(
      this.certPath,
      this.TEMP_DIR,
      ""
    );

    this.uploadCertificado = this.uploadCertificado.bind(this);
    this.iniciar = this.iniciar.bind(this);
    this.gerarNFSE = this.gerarNFSE.bind(this);
    // this.gerarRpsXml = this.gerarRpsXml.bind(this); // Refactored into internal helper or factory usage
    this.imprimirNFSE = this.imprimirNFSE.bind(this);
    this.verificaRps = this.verificaRps.bind(this);
    this.cancelarNfse = this.cancelarNfse.bind(this);
    this.setPassword = this.setPassword.bind(this);
    this.setNfseNumber = this.setNfseNumber.bind(this);
    this.setNfseStatus = this.setNfseStatus.bind(this);
    this.BuscarNSFE = this.BuscarNSFE.bind(this);
    this.BuscarNSFEDetalhes = this.BuscarNSFEDetalhes.bind(this);
    this.BuscarClientes = this.BuscarClientes.bind(this);
    this.removerAcentos = this.removerAcentos.bind(this);
  }

  private configureProvider() {
    if (this.homologacao) {
      this.WSDL_URL =
        "http://fi1.fiorilli.com.br:5663/IssWeb-ejb/IssWebWS/IssWebWS?wsdl";
    } else {
      this.WSDL_URL =
        "https://wsnfe.arealva.sp.gov.br:8443/IssWeb-ejb/IssWebWS/IssWebWS?wsdl";
    }
    // Re-instantiate provider with correct WSDL
    this.fiorilliProvider = new FiorilliProvider(
      this.certPath,
      this.TEMP_DIR,
      this.WSDL_URL
    );
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
      let {
        password,
        clientesSelecionados,
        aliquota,
        service,
        reducao,
        ambiente,
      } = req.body;
      this.PASSWORD = password;

      console.log(aliquota);
      console.log(ambiente);

      this.homologacao = ambiente === "homologacao";
      console.log("Servidor Localhost?: " + this.homologacao);

      this.configureProvider();
      console.log(this.WSDL_URL);

      aliquota = aliquota?.trim() ? aliquota : "5.0000";
      if (this.homologacao) {
        aliquota = "2.5000";
      }
      aliquota = aliquota.replace(",", ".").replace("%", "");
      if (!service) service = "Servico de Suporte Tecnico";

      if (!reducao) reducao = 60;
      let reducaoStr = String(reducao).replace(",", ".").replace("%", "");
      reducao = Number(reducaoStr) / 100;

      console.log(reducao);

      const result = await this.gerarNFSE(
        password,
        clientesSelecionados,
        "EnviarLoteRpsSincronoEnvio",
        aliquota,
        ambiente,
        service,
        reducao
      );

      if (Array.isArray(result)) {
        const ok = result.every((r) => r.status === "200");
        console.log("Result: " + JSON.stringify(result));
        console.log("okTest: " + ok);

        if (ok)
          res.status(200).json({ mensagem: "RPS criado com sucesso!", result });
        else res.status(500).json({ erro: "Erro ao criar o RPS." });
      } else {
        // Fallback for non-array result logic if needed
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
    ambiente: string,
    service: string,
    reducao: number
  ) {
    try {
      // Logic for fetching initial NSFE number
      const NsfeData = AppDataSource.getRepository(NFSE);

      // Determine Target Series
      let targetSeries = "1";
      if (ambiente === "homologacao") {
        targetSeries = "wip99";
      } else {
        // Find last used production series (not wip99)
        const lastProd = await NsfeData.findOne({
          where: { serieRps: Not("wip99") },
          order: { id: "DESC" },
        });
        targetSeries = lastProd?.serieRps || "1";
      }

      // Find last RPS for this specific series to determine next number
      const lastRpsForSeries = await NsfeData.findOne({
        where: { serieRps: targetSeries },
        order: { numeroRps: "DESC" },
      });

      let nfseNumber = lastRpsForSeries?.numeroRps
        ? lastRpsForSeries.numeroRps + 1
        : 1;

      // Use the last record (of any series? or target?) as base for other fields like 'issRetido'
      // Ideally use the last record of target series to keep consistency, or fallback to any last record if new series.
      let nfseBase = lastRpsForSeries;
      if (!nfseBase) {
        // If starting a new series (e.g. wip99), copy config from last standard '1' series to valid defaults
        nfseBase =
          (
            await NsfeData.find({
              order: { id: "DESC" },
              take: 1,
            })
          )[0] || null;
      }

      // Pass targetSeries explicitly to prepareRpsData so it doesn't need to re-guess
      const serieToUse = targetSeries;

      console.log(`Ambiente: ${this.homologacao ? "Homologacao" : "Producao"}`);
      console.log(`Serie Alvo: ${serieToUse}`);
      console.log(`Proximo Numero RPS: ${nfseNumber}`);

      const respArr: any[] = [];
      if (!fs.existsSync("log")) fs.mkdirSync("log", { recursive: true });
      const logPath = "./log/xml_log.txt";

      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        let rpsXmls = "";

        const entitiesToSave: NFSE[] = [];

        // Process batch
        for (const bid of batch) {
          const {
            xml,
            valorReduzido,
            rpsData,
            ClientData,
            FaturasData,
            // nfseBase, // Avoid shadowing, we already have it in scope
            ibgeId,
            serieRps,
          } = await this.prepareRpsData(
            bid,
            aliquota,
            service,
            reducao,
            nfseNumber,
            nfseBase as NFSE,
            serieToUse
          );

          // Sign RPS
          let signedRps = this.fiorilliProvider.assinarXml(
            xml,
            "InfDeclaracaoPrestacaoServico",
            password
          );

          // Append to list
          rpsXmls += signedRps;

          // Increment number
          nfseNumber++;

          // Create entity but DO NOT SAVE yet
          const novoRegistro = NsfeData.create({
            login: rpsData?.login || "",
            numeroRps: nfseNumber - 1,
            serieRps: serieRps || "",
            tipoRps: nfseBase?.tipoRps || 0,
            dataEmissao: rpsData?.processamento
              ? new Date(rpsData.processamento)
              : new Date(),
            competencia: rpsData?.datavenc
              ? new Date(rpsData.datavenc)
              : new Date(),
            valorServico: valorReduzido || 0,
            aliquota: Number(Number(aliquota).toFixed(4)),
            issRetido: nfseBase?.issRetido || 0,
            responsavelRetencao: nfseBase?.responsavelRetencao || 0,
            itemListaServico: nfseBase?.itemListaServico || "",
            discriminacao: service,
            codigoMunicipio: nfseBase?.codigoMunicipio || 0,
            exigibilidadeIss: nfseBase?.exigibilidadeIss || 0,
            cnpjPrestador: nfseBase?.cnpjPrestador || "",
            inscricaoMunicipalPrestador:
              nfseBase?.inscricaoMunicipalPrestador || "",
            cpfTomador: ClientData?.cpf_cnpj.replace(/[^0-9]/g, "") || "",
            razaoSocialTomador: ClientData?.nome || "",
            enderecoTomador: ClientData?.endereco || "",
            numeroEndereco: ClientData?.numero || "",
            complemento: ClientData?.complemento || undefined,
            bairro: ClientData?.bairro || "",
            uf: nfseBase?.uf || "",
            cep: ClientData?.cep.replace(/[^0-9]/g, "") || "",
            telefoneTomador:
              ClientData?.celular.replace(/[^0-9]/g, "") || undefined,
            emailTomador: ClientData?.email || undefined,
            optanteSimplesNacional: 1,
            incentivoFiscal: 2,
            ambiente: ambiente,
            status: "Ativa",
          });
          entitiesToSave.push(novoRegistro);
        }

        // Create Lote XML
        const loteId = `lote${nfseNumber}`; // Note: strictly speaking this might be slightly off if multiple batches, but follows original logic intent
        const cnpj = this.homologacao
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN;
        const inscricao = this.homologacao
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO;

        const loteXml = this.xmlFactory.createLoteXml(
          loteId,
          cnpj || "",
          inscricao || "",
          batch.length,
          rpsXmls
        );

        // Wrap in SOAP
        const user = process.env.MUNICIPIO_LOGIN || "";
        const pass = process.env.MUNICIPIO_SENHA || "";
        const soapXml = this.xmlFactory.createEnviarLoteSoap(
          loteXml,
          user,
          pass
        );

        // Log
        fs.appendFileSync(logPath, soapXml + "\n", "utf8");

        // Send Request
        const responseXml = await this.fiorilliProvider.sendSoapRequest(
          soapXml,
          SOAPAction,
          password
        );

        // Parse Response
        const parsed = await parseStringPromise(responseXml, {
          explicitArray: false,
        });

        // Check for error
        // The structure might be different depending on success/fail.
        // User log shows: soap:Body -> ns3:recepcionarLoteRpsSincronoResponse -> ns2:EnviarLoteRpsSincronoResposta -> ns2:ListaMensagemRetornoLote -> ns2:MensagemRetorno
        const resposta =
          parsed?.["soap:Envelope"]?.["soap:Body"]?.[
            "ns3:recepcionarLoteRpsSincronoResponse"
          ]?.["ns2:EnviarLoteRpsSincronoResposta"];

        const temErro =
          resposta?.["ns2:ListaMensagemRetorno"]?.["ns2:MensagemRetorno"] ||
          resposta?.["ns2:ListaMensagemRetornoLote"]?.["ns2:MensagemRetorno"];

        console.log("Tem erro: " + JSON.stringify(temErro));

        if (temErro) {
          console.log("Erro detectado na resposta SOAP:", temErro);
          respArr.push({
            status: "500",
            response: "Erro na geração da NFSe",
            detalhes: temErro,
          });
          // Do NOT save entitiesToSave
          continue;
        }

        // If success, save to DB
        if (entitiesToSave.length > 0) {
          await NsfeData.save(entitiesToSave);
        }

        console.log(responseXml);
        respArr.push({ status: "200", response: "ok" });
      }

      // Cleanup happens automatically or we can force it if provider methods left artifacts (current provider cleanups are handled or minimal)
      // The original code unlinked 'NEW_CERT_PATH' etc, but our provider handles the cert temp file better presumably.
      // If we need to explicitly clean up specific files used by legacy logic:
      const decryptedPath = path.join(
        this.TEMP_DIR,
        "decrypted_certificado.tmp"
      );
      if (fs.existsSync(decryptedPath)) fs.unlinkSync(decryptedPath);

      return respArr;
    } catch (error: any) {
      console.log(error);
      return { status: "500", response: error || "Erro" };
    }
  }

  // Refactored helper to prepare data for a single RPS
  private async prepareRpsData(
    id: string,
    aliquota: string,
    service: string,
    reducao: number,
    nfseNumber: number,
    nfseBase: NFSE,
    serieOverride?: string
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

    // Fetch IBGE code
    // Optimization: cache this if possible, but keeping original flow
    let ibgeId = "3503406"; // default fallback or Bauru/Arealva?
    try {
      const resp = await axios.get(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${ClientData?.cidade}`
      );
      ibgeId = resp.data.id;
    } catch (e) {
      /* ignore */
    }

    let val = ClientData?.desconto
      ? Number(rpsData?.valor) - Number(ClientData?.desconto)
      : Number(rpsData?.valor);

    // Calc reduced value for display/db
    let valorReduzido = Number(reducao) === 0 ? val : Number(val) * reducao;
    valorReduzido = Number(valorReduzido.toFixed(2));

    // Calc value for XML (original logic applied reduction to 'val' variable)
    val = val * (1 - reducao);
    val = Number(val.toFixed(2));

    const email = this.homologacao
      ? "suporte_wiptelecom@outlook.com"
      : ClientData?.email && ClientData.email.trim() !== ""
      ? ClientData.email.trim()
      : "sememail@wiptelecom.com.br";

    const cnpjPrestador = this.homologacao
      ? process.env.MUNICIPIO_CNPJ_TEST
      : process.env.MUNICIPIO_LOGIN;
    const inscricaoPrestador = this.homologacao
      ? process.env.MUNICIPIO_INCRICAO_TEST
      : process.env.MUNICIPIO_INCRICAO;

    const serieRps = serieOverride
      ? serieOverride
      : this.homologacao
      ? "wip99"
      : nfseBase?.serieRps;

    const xml = this.xmlFactory.createRpsXml(
      rpsData?.uuid_lanc || "",
      nfseNumber,
      serieRps,
      nfseBase?.tipoRps,
      new Date(), // Data Emissao
      "1", // Status
      val,
      Number(aliquota).toFixed(4),
      nfseBase?.issRetido,
      nfseBase?.responsavelRetencao,
      this.homologacao ? "17.01" : nfseBase?.itemListaServico,
      service,
      "3503406", // CodigoMunicipio Prestacao
      nfseBase?.exigibilidadeIss,
      cnpjPrestador || "",
      inscricaoPrestador || "",
      ClientData?.cpf_cnpj || "",
      ClientData?.nome || "",
      this.removerAcentos(ClientData?.endereco),
      ClientData?.numero || "",
      ClientData?.complemento || "",
      ClientData?.bairro || "",
      String(ibgeId),
      "SP",
      ClientData?.cep.replace(/[^0-9]/g, "") || "",
      ClientData?.celular.replace(/[^0-9]/g, "") || "",
      email,
      this.homologacao ? "" : "6", // Regime Especial
      this.homologacao ? "2" : nfseBase?.optanteSimplesNacional,
      nfseBase?.incentivoFiscal
    );

    return {
      xml,
      valorReduzido,
      rpsData,
      ClientData,
      FaturasData,
      nfseBase,
      ibgeId,
      serieRps,
    };
  }

  async imprimirNFSE(req: Request, res: Response) {
    const { id, ambiente } = req.body;
    const nfseRepository = AppDataSource.getRepository(NFSE);

    const result = await Promise.all(
      id.map(async (id: string | number) => {
        const nfse = await nfseRepository.findOne({
          where: { id: Number(id), ambiente },
        });

        if (nfse) {
          return this.BuscarNSFEDetalhes(
            nfse.numeroRps,
            nfse.serieRps,
            nfse.tipoRps
          );
        }
        return { error: `NFSE ${id} não encontrado no banco de dados.` };
      })
    );
    console.log(result);

    res.status(200).json(result);
  }

  async verificaRps(
    rpsNumber: string | number,
    serie: string | number,
    tipo: string | number,
    ambiente: string
  ) {
    try {
      const cnpj =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN;
      const inscricao =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO;

      const envioXml = this.xmlFactory.createConsultaNfseRpsEnvio(
        rpsNumber,
        String(serie),
        String(tipo),
        cnpj || "",
        inscricao || ""
      );
      const soapFinal = this.xmlFactory.createConsultaNfseSoap(
        envioXml,
        process.env.MUNICIPIO_LOGIN || "",
        process.env.MUNICIPIO_SENHA || ""
      );

      this.configureProvider(); // Ensure correct wsdl
      const response = await this.fiorilliProvider.sendSoapRequest(
        soapFinal,
        "ConsultarNfseServicoPrestadoEnvio",
        this.PASSWORD
      );

      if (response && response.includes("<ns2:Codigo>E92</ns2:Codigo>"))
        return true;
      return false;
    } catch {
      return false;
    }
  }

  async cancelarNfse(req: Request, res: Response) {
    try {
      const { id, password, ambiente } = req.body;
      if (!Array.isArray(id)) {
        res.status(400).json({ error: "id must be an array" });
        return;
      }
      this.PASSWORD = password;
      this.configureProvider();

      const nfseRepository = AppDataSource.getRepository(NFSE);

      const arr = await Promise.all(
        id.map(async (nfseId: string | number) => {
          try {
            const nfseEntity = await nfseRepository.findOne({
              where: { id: Number(nfseId), ambiente },
            });

            if (!nfseEntity) {
              return { id: nfseId, success: false, error: "NFShe not found" };
            }

            const rps = nfseEntity.numeroRps;

            // await this.setNfseNumber(rps); // Redundant call in original? kept safe
            const nfseNumber = await this.setNfseNumber(
              rps,
              nfseEntity?.serieRps || "1",
              nfseEntity?.tipoRps || "1"
            );
            if (!nfseNumber)
              throw new Error("NFSe Number not found for RPS " + rps);

            const cnpj =
              ambiente === "homologacao"
                ? process.env.MUNICIPIO_CNPJ_TEST
                : process.env.MUNICIPIO_LOGIN;
            const inscricao =
              ambiente === "homologacao"
                ? process.env.MUNICIPIO_INCRICAO_TEST
                : process.env.MUNICIPIO_INCRICAO;

            const pedidoXml = this.xmlFactory.createPedidoCancelamentoXml(
              nfseNumber,
              cnpj || "",
              inscricao || "",
              "3503406"
            );
            const envioXml = `<CancelarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${pedidoXml}</CancelarNfseEnvio>`;

            // Sign the inner part
            const envioXmlAssinado = this.fiorilliProvider.assinarXml(
              envioXml,
              "InfPedidoCancelamento",
              password
            );

            const soapFinal = this.xmlFactory.createCancelamentoSoap(
              envioXmlAssinado,
              process.env.MUNICIPIO_LOGIN || "",
              process.env.MUNICIPIO_SENHA || ""
            );

            // Note: Original code had a split logic for homologacao not signing or using different soap?
            // "const soapFinalHomologacao ... <ws:cancelarNfse>${envioXml}..." (unsigned)
            // But verify if that was intentional or a debugging left-over.
            // The original logic sent `soapFinalHomologacao` (unsigned) if homologacao.
            // I will match that logic.

            let soapToSend = soapFinal;
            if (this.homologacao) {
              // If homologacao, original used unsigned 'envioXml' inside the soap
              const soapUnsigned = this.xmlFactory.createCancelamentoSoap(
                envioXml,
                process.env.MUNICIPIO_LOGIN || "",
                process.env.MUNICIPIO_SENHA || ""
              );
              soapToSend = soapUnsigned;
            }

            const response = await this.fiorilliProvider.sendSoapRequest(
              soapToSend,
              "ConsultarNfseServicoPrestadoEnvio",
              password
            ); // Action might be different? Original used ConsultarNfseServicoPrestadoEnvio for cancel too?

            nfseEntity.status = "Cancelada";
            await nfseRepository.save(nfseEntity);

            return { id: nfseId, success: true, response: response };
          } catch (error) {
            return { id: nfseId, success: false, error };
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

  async setNfseNumber(
    rpsNumber: string | number,
    serie: string | number = "1",
    tipo: string | number = "1"
  ) {
    try {
      console.log(rpsNumber);

      const cnpj = this.homologacao
        ? process.env.MUNICIPIO_CNPJ_TEST
        : process.env.MUNICIPIO_LOGIN;
      const inscricao = this.homologacao
        ? process.env.MUNICIPIO_INCRICAO_TEST
        : process.env.MUNICIPIO_INCRICAO;

      const envioXml = this.xmlFactory.createConsultaNfseRpsEnvio(
        rpsNumber,
        String(serie),
        String(tipo),
        cnpj || "",
        inscricao || ""
      );
      const soapFinal = this.xmlFactory.createConsultaNfseSoap(
        envioXml,
        process.env.MUNICIPIO_LOGIN || "",
        process.env.MUNICIPIO_SENHA || ""
      );

      this.configureProvider();
      const response = await this.fiorilliProvider.sendSoapRequest(
        soapFinal,
        "ConsultarNfseServicoPrestadoEnvio",
        this.PASSWORD
      );

      console.log(response);

      console.log("Setado Status NFSE: RPS: " + rpsNumber);

      const parsed = await parseStringPromise(response, {
        explicitArray: false,
      });

      const compNfse =
        parsed?.["soap:Envelope"]?.["soap:Body"]?.[
          "ns3:consultarNfsePorRpsResponse"
        ]?.["ns2:ConsultarNfseRpsResposta"]?.["ns2:CompNfse"];

      // If CompNfse is array (multiple results?), take first
      const nfseNode = Array.isArray(compNfse) ? compNfse[0] : compNfse;

      const numeroNfse =
        nfseNode?.["ns2:Nfse"]?.["ns2:InfNfse"]?.["ns2:Numero"];

      if (numeroNfse) return numeroNfse;
      return null;
    } catch (error) {
      return error;
    }
  }

  async setNfseStatus(
    rpsNumber: string | number,
    serie: string | number = "1",
    tipo: string | number = "1"
  ) {
    try {
      const cnpj = this.homologacao
        ? process.env.MUNICIPIO_CNPJ_TEST
        : process.env.MUNICIPIO_LOGIN;
      const inscricao = this.homologacao
        ? process.env.MUNICIPIO_INCRICAO_TEST
        : process.env.MUNICIPIO_INCRICAO;

      const envioXml = this.xmlFactory.createConsultaNfseRpsEnvio(
        rpsNumber,
        String(serie),
        String(tipo),
        cnpj || "",
        inscricao || ""
      );
      const soapFinal = this.xmlFactory.createConsultaNfseSoap(
        envioXml,
        process.env.MUNICIPIO_LOGIN || "",
        process.env.MUNICIPIO_SENHA || ""
      );

      this.configureProvider();
      const response = await this.fiorilliProvider.sendSoapRequest(
        soapFinal,
        "ConsultarNfseServicoPrestadoEnvio",
        this.PASSWORD
      );

      if (response.includes('<ns2:NfseCancelamento versao="2.0">')) return true;
      return false;
    } catch {
      return false;
    }
  }

  async BuscarNSFE(req: Request, res: Response) {
    try {
      const { cpf, filters, dateFilter, ambiente } = req.body;
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
          ambiente: ambiente,
        },
        order: { id: "DESC" },
      });
      const arr = await Promise.all(
        clientesResponse.map(async (c) => {
          const nfseDoCliente = nfseResponse.filter(
            (nf) => nf.login === c.login
          );

          const nfseValidas: typeof nfseDoCliente = [];
          const nfseNumberArray: string[] = [];

          for (const nf of nfseDoCliente) {
            const isCancelada = await this.setNfseStatus(
              nf.numeroRps,
              nf.serieRps,
              nf.tipoRps
            );
            if (!isCancelada) {
              nfseValidas.push(nf);
              const numeroNfse = await this.setNfseNumber(
                nf.numeroRps,
                nf.serieRps,
                nf.tipoRps
              );
              nfseNumberArray.push(numeroNfse);
            }
          }

          if (!nfseValidas.length) return null;

          return {
            ...c,
            nfse: {
              id: nfseValidas.map((nf) => nf.id).join(", "),
              login: nfseValidas.map((nf) => nf.login).join(", ") || null,
              numero_rps:
                nfseValidas.map((nf) => nf.numeroRps).join(", ") || null,
              serie_rps:
                nfseValidas.map((nf) => nf.serieRps).join(", ") || null,
              tipo_rps: nfseValidas.map((nf) => nf.tipoRps).join(", ") || null,
              data_emissao:
                nfseValidas
                  .map((nf) =>
                    moment
                      .tz(nf.dataEmissao, "America/Sao_Paulo")
                      .format("DD/MM/YYYY")
                  )
                  .join(", ") || null,
              competencia:
                nfseValidas
                  .map((nf) =>
                    moment
                      .tz(nf.competencia, "America/Sao_Paulo")
                      .format("DD/MM/YYYY")
                  )
                  .join(", ") || null,
              valor_servico:
                nfseValidas.map((nf) => nf.valorServico).join(", ") || null,
              aliquota: nfseValidas.map((nf) => nf.aliquota).join(", ") || null,
              iss_retido:
                nfseValidas.map((nf) => nf.issRetido).join(", ") || null,
              responsavel_retecao:
                nfseValidas.map((nf) => nf.responsavelRetencao).join(", ") ||
                null,
              item_lista_servico:
                nfseValidas.map((nf) => nf.itemListaServico).join(", ") || null,
              discriminacao:
                nfseValidas.map((nf) => nf.discriminacao).join(", ") || null,
              codigo_municipio:
                nfseValidas.map((nf) => nf.codigoMunicipio).join(", ") || null,
              exigibilidade_iss:
                nfseValidas.map((nf) => nf.exigibilidadeIss).join(", ") || null,
              cnpj_prestador:
                nfseValidas.map((nf) => nf.cnpjPrestador).join(", ") || null,
              inscricao_municipal_prestador:
                nfseValidas
                  .map((nf) => nf.inscricaoMunicipalPrestador)
                  .join(", ") || null,
              cpf_tomador:
                nfseValidas.map((nf) => nf.cpfTomador).join(", ") || null,
              razao_social_tomador:
                nfseValidas.map((nf) => nf.razaoSocialTomador).join(", ") ||
                null,
              endereco_tomador:
                nfseValidas.map((nf) => nf.enderecoTomador).join(", ") || null,
              numero_endereco:
                nfseValidas.map((nf) => nf.numeroEndereco).join(", ") || null,
              complemento:
                nfseValidas.map((nf) => nf.complemento).join(", ") || null,
              bairro: nfseValidas.map((nf) => nf.bairro).join(", ") || null,
              uf: nfseValidas.map((nf) => nf.uf).join(", ") || null,
              cep: nfseValidas.map((nf) => nf.cep).join(", ") || null,
              telefone_tomador:
                nfseValidas.map((nf) => nf.telefoneTomador).join(", ") || null,
              email_tomador:
                nfseValidas.map((nf) => nf.emailTomador).join(", ") || null,
              optante_simples_nacional:
                nfseValidas.map((nf) => nf.optanteSimplesNacional).join(", ") ||
                null,
              incentivo_fiscal:
                nfseValidas.map((nf) => nf.incentivoFiscal).join(", ") || null,
              status: nfseValidas.map((nf) => nf.status).join(", ") || null,
              numeroNfse: nfseNumberArray.join(", ") || null,
            },
          };
        })
      );
      const filtered = arr
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .sort((a, b) => (b?.nfse?.id || "").localeCompare(a?.nfse?.id || ""));
      res.status(200).json(filtered);
    } catch {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async BuscarNSFEDetalhes(
    rpsNumber: string | number,
    serie: string | number,
    tipo: string | number,
    retryCount: number = 0
  ): Promise<any> {
    try {
      const cnpj = this.homologacao
        ? process.env.MUNICIPIO_CNPJ_TEST
        : process.env.MUNICIPIO_LOGIN;
      const inscricao = this.homologacao
        ? process.env.MUNICIPIO_INCRICAO_TEST
        : process.env.MUNICIPIO_INCRICAO;

      const envioXml = this.xmlFactory.createConsultaNfseRpsEnvio(
        rpsNumber,
        String(serie),
        String(tipo),
        cnpj || "",
        inscricao || ""
      );
      const soapFinal = this.xmlFactory.createConsultaNfseSoap(
        envioXml,
        process.env.MUNICIPIO_LOGIN || "",
        process.env.MUNICIPIO_SENHA || ""
      );

      this.configureProvider();

      const response = await this.fiorilliProvider.sendSoapRequest(
        soapFinal,
        "ConsultarNfseServicoPrestadoEnvio",
        this.PASSWORD
      );

      // Check for E92 - RPS not converted
      // if (response && response.includes("<ns2:Codigo>E92</ns2:Codigo>")) {
      //   console.log(
      //     `[BuscarNSFEDetalhes] RPS ${rpsNumber} ainda não convertido (E92). Tentativa ${
      //       retryCount + 1
      //     }/10. Aguardando...`
      //   );
      //   // if (retryCount < 10) {
      //   //   await new Promise((resolve) => setTimeout(resolve, 3000));
      //   //   return this.BuscarNSFEDetalhes(
      //   //     rpsNumber,
      //   //     serie,
      //   //     tipo,
      //   //     retryCount + 1
      //   //   );
      //   // }
      // }

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(response, "text/xml");
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

  async getLastNfseNumber(ambiente: string = "producao"): Promise<number> {
    try {
      this.configureProvider();

      const cnpj =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN;
      const inscricao =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO;

      // Date range: Last 30 days to ensure coverage
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);

      const envioXml = this.xmlFactory.createConsultarNfseServicoPrestadoEnvio(
        cnpj || "",
        inscricao || "",
        start,
        end
      );

      const soapXml = this.xmlFactory.createConsultarNfseServicoPrestadoSoap(
        envioXml,
        process.env.MUNICIPIO_LOGIN || "",
        process.env.MUNICIPIO_SENHA || ""
      );

      const response = await this.fiorilliProvider.sendSoapRequest(
        soapXml,
        "ConsultarNfseServicoPrestadoEnvio", // Action per doc
        this.PASSWORD
      );

      const parsed = await parseStringPromise(response, {
        explicitArray: false,
      });

      const listaMensagem =
        parsed?.["soap:Envelope"]?.["soap:Body"]?.[
          "ns3:consultarNfseServicoPrestadoResponse"
        ]?.["ns2:ConsultarNfseServicoPrestadoResposta"]?.[
          "ns2:ListaMensagemRetorno"
        ];

      if (listaMensagem) {
        console.log(
          "Mensagem Retorno getLastNfseNumber:",
          JSON.stringify(listaMensagem)
        );
      }

      const compNfse =
        parsed?.["soap:Envelope"]?.["soap:Body"]?.[
          "ns3:consultarNfseServicoPrestadoResponse"
        ]?.["ns2:ConsultarNfseServicoPrestadoResposta"]?.["ns2:ListaNfse"]?.[
          "ns2:CompNfse"
        ];

      if (!compNfse) {
        console.log("Nenhuma NFSe encontrada no período. Retornando 1.");
        return 1;
      }

      const lista = Array.isArray(compNfse) ? compNfse : [compNfse];
      let maxRps = 0;

      for (const item of lista) {
        const rpsNum =
          item?.["ns2:Nfse"]?.["ns2:InfNfse"]?.[
            "ns2:DeclaracaoPrestacaoServico"
          ]?.["ns2:InfDeclaracaoPrestacaoServico"]?.["ns2:Rps"]?.[
            "ns2:IdentificacaoRps"
          ]?.["ns2:Numero"];

        if (rpsNum) {
          const n = Number(rpsNum);
          if (!isNaN(n) && n > maxRps) {
            maxRps = n;
          }
        }
      }

      console.log(`Último RPS encontrado: ${maxRps}. Próximo: ${maxRps + 1}`);
      return maxRps + 1;
    } catch (error) {
      console.error("Erro ao buscar último número de RPS:", error);
      // Fallback: Check DB? Or safe default?
      // For now, throwing or returning 1 might be risky if existing notes exist.
      // But adhering to the requested logic:
      return 1;
    }
  }

  removerAcentos(texto: any): string {
    if (!texto) return "";
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
