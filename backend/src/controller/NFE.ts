import { Request, Response } from "express";
import { In, Between, IsNull } from "typeorm";
import { create } from "xmlbuilder2";
import * as fs from "fs";
import * as path from "path";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import axios from "axios";
import * as https from "https";
import AppDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { NFE } from "../entities/NFE";
import { ClientesEntities } from "../entities/ClientesEntities";
import { processarCertificado } from "../utils/certUtils";
import { Faturas } from "../entities/Faturas";
import moment from "moment-timezone";
import dotenv from "dotenv";
import { Sis_prodCliente } from "../entities/Sis_prodCliente";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

class NFEController {
  private homologacao: boolean = false;
  private certPath = path.resolve(__dirname, "../files/certificado.pfx");
  private TEMP_DIR = path.resolve(__dirname, "../files");

  public emitirSaidaComodato = async (req: Request, res: Response) => {
    try {
      // Changed to receive login instead of clienteId
      const { login, password, ambiente } = req.body;

      this.homologacao = ambiente === "homologacao";

      if (!login) {
        res.status(400).json({ message: "Login não fornecido" });
        return;
      }

      const clientRepository = MkauthSource.getRepository(ClientesEntities);
      const nfeRepository = AppDataSource.getRepository(NFE);

      // Find client by login
      const client = await clientRepository.findOne({
        where: { login: login },
      });

      console.log(login);

      if (!client) {
        res.status(404).json({ message: "Cliente não encontrado" });
        return;
      }

      const prodClienteRepository = MkauthSource.getRepository(Sis_prodCliente);

      const prodCliente = await prodClienteRepository.findOne({
        where: { cliente: client.login },
      });

      if (!prodCliente) {
        res.status(404).json({ message: "Produto não encontrado" });
        return;
      }

      const equipamentos = await prodClienteRepository.find({
        where: { cliente: client.login },
      });

      // 1. Determine next NFE number
      const lastNfe = await nfeRepository.findOne({
        where: { serie: this.homologacao ? "99" : "1" },
        order: { id: "DESC" },
      });

      const nNF = lastNfe ? parseInt(lastNfe.nNF) + 1 : 1;
      const serie = this.homologacao ? "99" : "1";
      // Use moment-timezone for correct formatting
      const dhEmi = moment()
        .tz("America/Sao_Paulo")
        .format("YYYY-MM-DDTHH:mm:ssZ");

      const cNF = Math.floor(Math.random() * 99999999)
        .toString()
        .padStart(8, "0");

      // 2. Build XML
      const nfeData = {
        infNFe: {
          "@Id": "", // Will be filled after chNFe calculation
          "@versao": "4.00",
          ide: {
            cUF: "35", // SP
            cNF: cNF,
            natOp: "REMESSA EM COMODATO",
            mod: "55",
            serie: serie,
            nNF: nNF.toString(),
            dhEmi: dhEmi,
            dhSaiEnt: dhEmi,
            tpNF: "1", // Saída
            idDest: "1", // Interna
            cMunFG: "3503406", // Arealva
            tpImp: "1", // Retrato
            tpEmis: "1", // Normal
            cDV: "", // Will be calculated
            tpAmb: this.homologacao ? "2" : "1",
            finNFe: "1", // Normal
            indFinal: "1", // Consumidor final
            indPres: "1", // Presencial (or others depending on operation)
            procEmi: "0", // App do contribuinte
            verProc: "1.0",
          },
          emit: {
            CNPJ: process.env.CPF_CNPJ?.replace(/\D/g, ""),
            xNome: "WIP TELECOM MULTIMIDIA EIRELI ME",
            xFant: "WIP TELECOM",
            enderEmit: {
              xLgr: "Rua Emilio Carraro",
              nro: "945",
              xBairro: "Altos da Cidade",
              cMun: "3503406",
              xMun: "Arealva",
              UF: "SP",
              CEP: "17160380",
              cPais: "1058",
              xPais: "BRASIL",
              fone: "1432961608",
            },
            IE: "183013286115",
            CRT: "1", // Simples Nacional
          },
          dest: {
            CNPJ:
              client.cpf_cnpj.length > 11
                ? client.cpf_cnpj.replace(/\D/g, "")
                : undefined,
            CPF:
              client.cpf_cnpj.length <= 11
                ? client.cpf_cnpj.replace(/\D/g, "")
                : undefined,
            xNome: this.homologacao
              ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
              : client.nome,

            enderDest: {
              xLgr: client.endereco,
              nro: client.numero || "S/N",
              xBairro: client.bairro,
              cMun: client.cidade_ibge || "3503406",
              xMun: client.cidade,
              UF: client.estado || "SP",
              CEP: client.cep.replace(/\D/g, ""),
              cPais: "1058",
              xPais: "BRASIL",
            },
            indIEDest: "9", // Não Contribuinte
          },
          det: equipamentos.map((eq: any, index: number) => ({
            "@nItem": index + 1,
            prod: {
              cProd: eq.codigo || "CF0001",
              cEAN: "SEM GTIN",
              xProd: eq.descricao,
              NCM: "85176259",
              CFOP: "5908", // Comodato Saída
              uCom: "UN",
              qCom: "1.0000",
              vUnCom: eq.valor || "0.00",
              vProd: eq.valor || "0.00",
              cEANTrib: "SEM GTIN",
              uTrib: "UN",
              qTrib: "1.0000",
              vUnTrib: eq.valor || "0.00",
              indTot: "1",
            },
            imposto: {
              ICMS: {
                ICMSSN102: {
                  orig: "0",
                  CSOSN: "400",
                },
              },
              PIS: {
                PISOutr: {
                  CST: "99",
                  vBC: "0.00",
                  pPIS: "0.00",
                  vPIS: "0.00",
                },
              },
              COFINS: {
                COFINSOutr: {
                  CST: "99",
                  vBC: "0.00",
                  pCOFINS: "0.00",
                  vCOFINS: "0.00",
                },
              },
            },
          })),
          total: {
            ICMSTot: {
              vBC: "0.00",
              vICMS: "0.00",
              vICMSDeson: "0.00",
              vFCP: "0.00",
              vBCST: "0.00",
              vST: "0.00",
              vFCPST: "0.00",
              vFCPSTRet: "0.00",
              vProd: equipamentos
                .reduce(
                  (acc: number, cur: any) => acc + parseFloat(cur.valor || 0),
                  0,
                )
                .toFixed(2),
              vFrete: "0.00",
              vSeg: "0.00",
              vDesc: "0.00",
              vII: "0.00",
              vIPI: "0.00",
              vIPIDevol: "0.00",
              vPIS: "0.00",
              vCOFINS: "0.00",
              vOutro: "0.00",
              vNF: equipamentos
                .reduce(
                  (acc: number, cur: any) => acc + parseFloat(cur.valor || 0),
                  0,
                )
                .toFixed(2),
            },
          },
          transp: {
            modFrete: "9", // Sem frete
          },
          pag: {
            detPag: {
              tPag: "90", // Sem pagamento
              vPag: "0.00",
            },
          },
        },
      };

      // 3. Calculate Chave Acesso and DV
      const chave = this.gerarChaveAcesso(nfeData.infNFe);
      nfeData.infNFe["@Id"] = `NFe${chave}`;
      nfeData.infNFe.ide.cDV = chave.slice(-1);

      // 4. Generate inner XML (Attempting to compact)
      let innerXml = create(
        { encoding: "UTF-8" },
        { NFe: { "@xmlns": "http://www.portalfiscal.inf.br/nfe", ...nfeData } },
      ).end({ prettyPrint: false });

      // 5. Sign XML
      const signedXml = await this.assinarXml(
        innerXml,
        password,
        nfeData.infNFe["@Id"],
      );

      // 6. Wrap in enviNFe (Batch)
      const loteXml = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>1</idLote><indSinc>1</indSinc>${signedXml.replace(/<\?xml.*?\?>/, "")}</enviNFe>`;

      // 7. SOAP Envelope
      const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${loteXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;

      // 8. Credentials and Send
      const { cert, key } = this.getCredentialsFromPfx(password);
      const httpsAgent = new https.Agent({
        cert,
        key,
        rejectUnauthorized: false,
      });

      const url = this.homologacao
        ? "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx?WSDL"
        : "https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx?WSDL";

      console.log(`Enviando NFe para ${url}`);

      const response = await axios.post(url, soapEnvelope, {
        headers: {
          "Content-Type":
            'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"',
        },
        httpsAgent,
      });

      console.log("Response SEFAZ Status:", response.status);
      const responseBody = response.data;

      // Check for success (100 or 103)
      // We should extract nProt if available
      let nProt = "";
      const nProtMatch = responseBody.match(/<nProt>(.*?)<\/nProt>/);
      nProt = nProtMatch ? nProtMatch[1] : "";

      // Also extract cStat
      let cStat = "";
      const cStatMatch = responseBody.match(/<cStat>(.*?)<\/cStat>/); // Note: might match multiple, usually the last one (inside protNFe) is what matters for the NFe status itself.
      // But retEnviNFe also has cStat (104 for batch processed).
      // We should look for the cStat inside protNFe if possible, or just parse loosely.
      // If we used a robust parser it would be better, but regex is what was used in test.

      // Simple logic: If we have nProt, it was likely authorized or denied with a protocol.
      // Ideally we want to know if it was authorized (100).

      const status = responseBody.includes("<cStat>100</cStat>")
        ? "autorizado"
        : "enviado";

      const nfeRecord = nfeRepository.create({
        nNF: nfeData.infNFe.ide.nNF,
        serie: nfeData.infNFe.ide.serie,
        chave: chave,
        xml: signedXml,
        status: status,
        protocolo: nProt, // Fixed column name
        data_emissao: new Date(),
        cliente_id: client.id,
        destinatario_nome: client.nome,
        destinatario_cpf_cnpj: client.cpf_cnpj,
        tipo_operacao: "saida_comodato",
        valor_total: parseFloat(nfeData.infNFe.total.ICMSTot.vNF),
        tpAmb: this.homologacao ? 2 : 1,
      });

      await nfeRepository.save(nfeRecord);

      res.status(200).json({
        message: "NFE Processada",
        id: nfeRecord.id,
        chave: chave,
        nProt: nProt,
        status_sefaz: status,
        raw_response: responseBody.substring(0, 500), // partial return for debug
      });
    } catch (error: any) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Erro ao emitir NFE", error: error.message });
    }
  };

  public emitirEntradaComodato = async (req: Request, res: Response) => {
    try {
      const { login, password, ambiente } = req.body;

      this.homologacao = ambiente === "homologacao";

      const clientRepository = MkauthSource.getRepository(ClientesEntities);
      const nfeRepository = AppDataSource.getRepository(NFE);

      const client = await clientRepository.findOne({
        where: { login: login },
      });
      if (!client) {
        res.status(404).json({ message: "Cliente não encontrado" });
        return;
      }

      const prodClienteRepository = MkauthSource.getRepository(Sis_prodCliente);

      const prodCliente = await prodClienteRepository.findOne({
        where: { cliente: client.login },
      });

      if (!prodCliente) {
        res.status(404).json({ message: "Produto não encontrado" });
        return;
      }

      const equipamentos = await prodClienteRepository.find({
        where: { cliente: client.login },
      });

      // 1. Determine next NFE number
      const lastNfe = await nfeRepository.findOne({
        where: { serie: this.homologacao ? "99" : "1" },
        order: { id: "DESC" },
      });

      const nNF = lastNfe ? parseInt(lastNfe.nNF) + 1 : 1;
      const serie = this.homologacao ? "99" : "1";
      const dhEmi = new Date().toISOString();
      const cNF = Math.floor(Math.random() * 99999999)
        .toString()
        .padStart(8, "0");

      // 2. Build XML
      const nfeData = {
        infNFe: {
          "@Id": "",
          "@versao": "4.00",
          ide: {
            cUF: "35",
            cNF: cNF,
            natOp: "RETORNO DE COMODATO",
            mod: "55",
            serie: serie,
            nNF: nNF.toString(),
            dhEmi: dhEmi,
            dhSaiEnt: dhEmi,
            tpNF: "0", // Entrada
            idDest: "1",
            cMunFG: "3503406",
            tpImp: "1",
            tpEmis: "1",
            cDV: "",
            tpAmb: this.homologacao ? "2" : "1",
            finNFe: "1",
            indFinal: "1",
            indPres: "1",
            procEmi: "0",
            verProc: "1.0",
          },
          emit: {
            CNPJ: process.env.CPF_CNPJ?.replace(/\D/g, ""),
            xNome: "WIP TELECOM MULTIMIDIA EIRELI ME",
            xFant: "WIP TELECOM",
            enderEmit: {
              xLgr: "Rua Emilio Carraro",
              nro: "945",
              xBairro: "Altos da Cidade",
              cMun: "3503406",
              xMun: "Arealva",
              UF: "SP",
              CEP: "17160380",
              cPais: "1058",
              xPais: "BRASIL",
              fone: "1432961608",
            },
            IE: "183013286115",
            CRT: "1",
          },
          dest: {
            CNPJ:
              client.cpf_cnpj.length > 11
                ? client.cpf_cnpj.replace(/\D/g, "")
                : undefined,
            CPF:
              client.cpf_cnpj.length <= 11
                ? client.cpf_cnpj.replace(/\D/g, "")
                : undefined,
            xNome: client.nome,
            enderDest: {
              xLgr: client.endereco,
              nro: client.numero || "S/N",
              xBairro: client.bairro,
              cMun: client.cidade_ibge || "3503406",
              xMun: client.cidade,
              UF: client.estado || "SP",
              CEP: client.cep.replace(/\D/g, ""),
              cPais: "1058",
              xPais: "BRASIL",
            },
            indIEDest: "9",
          },
          det: equipamentos.map((eq: any, index: number) => ({
            "@nItem": index + 1,
            prod: {
              cProd: eq.codigo || "CF0001",
              cEAN: "SEM GTIN",
              xProd: eq.descricao,
              NCM: "85176259",
              CFOP: "1909", // Retorno de Comodato
              uCom: "UN",
              qCom: "1.0000",
              vUnCom: eq.valor || "0.00",
              vProd: eq.valor || "0.00",
              cEANTrib: "SEM GTIN",
              uTrib: "UN",
              qTrib: "1.0000",
              vUnTrib: eq.valor || "0.00",
              indTot: "1",
            },
            imposto: {
              ICMS: {
                ICMSSN400: {
                  orig: "0",
                  CSOSN: "400",
                },
              },
              PIS: {
                PISOutr: {
                  CST: "99",
                  vBC: "0.00",
                  pPIS: "0.00",
                  vPIS: "0.00",
                },
              },
              COFINS: {
                COFINSOutr: {
                  CST: "99",
                  vBC: "0.00",
                  pCOFINS: "0.00",
                  vCOFINS: "0.00",
                },
              },
            },
          })),
          total: {
            ICMSTot: {
              vBC: "0.00",
              vICMS: "0.00",
              vICMSDeson: "0.00",
              vFCP: "0.00",
              vBCST: "0.00",
              vST: "0.00",
              vFCPST: "0.00",
              vFCPSTRet: "0.00",
              vProd: equipamentos
                .reduce(
                  (acc: number, cur: any) => acc + parseFloat(cur.valor || 0),
                  0,
                )
                .toFixed(2),
              vFrete: "0.00",
              vSeg: "0.00",
              vDesc: "0.00",
              vII: "0.00",
              vIPI: "0.00",
              vIPIDevol: "0.00",
              vPIS: "0.00",
              vCOFINS: "0.00",
              vOutro: "0.00",
              vNF: equipamentos
                .reduce(
                  (acc: number, cur: any) => acc + parseFloat(cur.valor || 0),
                  0,
                )
                .toFixed(2),
            },
          },
          transp: {
            modFrete: "9",
          },
          pag: {
            detPag: {
              tPag: "90",
              vPag: "0.00",
            },
          },
        },
      };

      const chave = this.gerarChaveAcesso(nfeData.infNFe);
      nfeData.infNFe["@Id"] = `NFe${chave}`;
      nfeData.infNFe.ide.cDV = chave.slice(-1);

      let xml = create(
        { encoding: "UTF-8" },
        { NFe: { "@xmlns": "http://www.portalfiscal.inf.br/nfe", ...nfeData } },
      ).end({ prettyPrint: true });

      const signedXml = await this.assinarXml(
        xml,
        password,
        nfeData.infNFe["@Id"],
      );

      const nfeRecord = nfeRepository.create({
        nNF: nfeData.infNFe.ide.nNF,
        serie: nfeData.infNFe.ide.serie,
        chave: chave,
        xml: signedXml,
        status: "assinado",
        data_emissao: new Date(),
        cliente_id: client.id,
        destinatario_nome: client.nome,
        destinatario_cpf_cnpj: client.cpf_cnpj,
        tipo_operacao: "entrada_comodato",
        valor_total: parseFloat(nfeData.infNFe.total.ICMSTot.vNF),
        tpAmb: this.homologacao ? 2 : 1,
      });

      await nfeRepository.save(nfeRecord);

      res.status(200).json({
        message: "NFE de Entrada Gerada e Assinada",
        id: nfeRecord.id,
        chave: chave,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Erro ao emitir NFE de Entrada", error: error });
    }
  };

  private gerarChaveAcesso(infNFe: any): string {
    const cUF = infNFe.ide.cUF;
    const dhEmi = infNFe.ide.dhEmi;
    const aamm = dhEmi.substring(2, 4) + dhEmi.substring(5, 7);
    const cnpj = infNFe.emit.CNPJ;
    const mod = infNFe.ide.mod;
    const serie = infNFe.ide.serie.padStart(3, "0");
    const nNF = infNFe.ide.nNF.padStart(9, "0");
    const tpEmis = infNFe.ide.tpEmis;
    const cNF = infNFe.ide.cNF;

    const chaveSemDV = `${cUF}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;
    const dv = this.calcularDV(chaveSemDV);
    return `${chaveSemDV}${dv}`;
  }

  private calcularDV(chave: string): string {
    let peso = 2;
    let soma = 0;
    for (let i = chave.length - 1; i >= 0; i--) {
      soma += parseInt(chave[i]) * peso;
      peso++;
      if (peso > 9) peso = 2;
    }
    const resto = soma % 11;
    let dv = 11 - resto;
    if (dv >= 10) dv = 0;
    return dv.toString();
  }

  private async assinarXml(
    xml: string,
    password: string,
    idTag: string,
  ): Promise<string> {
    const certPath = path.join(__dirname, "..", "files", "certificado.pfx");

    if (!fs.existsSync(certPath)) {
      throw new Error(`Certificado não encontrado em: ${certPath}`);
    }

    const pfxBuffer = fs.readFileSync(certPath);
    const pfxAsn1 = forge.asn1.fromDer(
      forge.util.createBuffer(pfxBuffer.toString("binary")),
    );
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);

    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ];
    const keyBags = pfx.getBags({
      bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
    })[forge.pki.oids.pkcs8ShroudedKeyBag];

    if (!certBags || !keyBags) {
      throw new Error(
        "Não foi possível extrair certificado ou chave privada do PFX.",
      );
    }

    const certPem = forge.pki.certificateToPem(certBags[0]!.cert!);
    const keyPem = forge.pki.privateKeyToPem(keyBags[0]!.key!);

    const sig = new SignedXml();
    sig.privateKey = keyPem;
    sig.publicCert = certPem;

    sig.canonicalizationAlgorithm =
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";

    sig.addReference({
      xpath: "//*[local-name(.)='infNFe']",
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      ],
      digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
      uri: "#" + idTag,
    });

    sig.computeSignature(xml);
    return sig.getSignedXml();
  }

  public BuscarClientes = async (req: Request, res: Response) => {
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
          id: true,
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
                    (Number(f.valor) - (cliente.desconto || 0)).toFixed(2),
                  )
                  .join(", ") || null,
            },
          };
        })
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .sort((a, b) =>
          (b?.fatura?.titulo || "").localeCompare(a?.fatura?.titulo || ""),
        );
      res.status(200).json(arr);
    } catch {
      res.status(500).json({ message: "Erro ao buscar clientes" });
    }
  };

  public cancelarNota = async (req: Request, res: Response) => {
    try {
      const {
        chave,
        protocolo,
        justificativa = "Cancelamento de Nota",
        login,
        ambiente,
        password,
      } = req.body;

      // Basic verification
      if (!chave || !protocolo || !login) {
        res
          .status(400)
          .json({ message: "Dados incompletos para cancelamento" });
        return;
      }

      const isHomologacao = ambiente === "homologacao";

      // 1. Build Event XML
      const tpEvento = "110111"; // Cancelamento
      const nSeqEvento = "1";
      // Use moment-timezone
      const dhEvento = moment()
        .tz("America/Sao_Paulo")
        .format("YYYY-MM-DDTHH:mm:ssZ");
      const idTag = `ID${tpEvento}${chave}${nSeqEvento.padStart(2, "0")}`;
      const cnpj = process.env.CPF_CNPJ;

      // Raw XML construction
      // Ensure "versao" is lowercase as fixed in tests
      const infEventoXml = `<infEvento Id="${idTag}" xmlns="http://www.portalfiscal.inf.br/nfe"><cOrgao>35</cOrgao><tpAmb>${isHomologacao ? "2" : "1"}</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chave}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>${tpEvento}</tpEvento><nSeqEvento>${nSeqEvento}</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${protocolo}</nProt><xJust>${justificativa}</xJust></detEvento></infEvento>`;

      // 2. Sign
      const signedEvento = await this.assinarEvento(
        infEventoXml,
        password,
        idTag,
      );

      // 3. Wrap in Batch (envEvento)
      const envEventoXml = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>1</idLote>${signedEvento}</envEvento>`;

      // 4. Wrap in SOAP
      const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${envEventoXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;

      // 5. Send Request
      const { cert, key } = this.getCredentialsFromPfx(password);
      const httpsAgent = new https.Agent({
        cert,
        key,
        rejectUnauthorized: false,
      });

      const url = isHomologacao
        ? "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeRecepcaoEvento4.asmx?WSDL"
        : "https://nfe.fazenda.sp.gov.br/ws/nfeRecepcaoEvento4.asmx?WSDL";

      console.log(`Enviando Cancelamento para ${url}`);

      const response = await axios.post(url, soapEnvelope, {
        headers: {
          "Content-Type":
            'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento"',
        },
        httpsAgent,
      });

      const responseBody = response.data;
      const cStatMatch = responseBody.match(/<cStat>(.*?)<\/cStat>/);
      const cStat = cStatMatch ? cStatMatch[1] : ""; // Note: extracts first cStat, check strictness if needed

      // Update DB if success (135)
      // Update DB if success (135 - Evento registrado vinculada a NF-e)
      if (responseBody.includes("<cStat>135</cStat>")) {
        const nfeRepository = AppDataSource.getRepository(NFE);
        // We could also store the cancellation XML or protocol if we had columns for it.
        // For now, updating status is the critical part requested.
        await nfeRepository.update(
          { chave: chave },
          {
            status: "cancelado",
            // If we want to store the cancellation protocol, we might overwrite the emission protocol
            // or we need a new column 'protocolo_cancelamento'.
            // Given the current entity, let's just update 'status'.
          },
        );
      }

      res.status(200).json({
        message: "Solicitação de cancelamento processada",
        cStat: cStat,
        response: responseBody.substring(0, 1000),
      });
    } catch (error: any) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Erro ao cancelar NFE", error: error.message });
    }
  };

  private getCredentialsFromPfx(password: string) {
    if (!fs.existsSync(this.certPath)) {
      throw new Error(`Certificado não encontrado em: ${this.certPath}`);
    }

    // Use certUtils to process/re-export certificate
    const processedCertPath = processarCertificado(
      this.certPath,
      password,
      this.TEMP_DIR,
    );

    // Read from processed path
    const pfxBuffer = fs.readFileSync(processedCertPath);
    const pfxAsn1 = forge.asn1.fromDer(
      forge.util.createBuffer(pfxBuffer.toString("binary")),
    );
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);

    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ];
    const keyBags = pfx.getBags({
      bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
    })[forge.pki.oids.pkcs8ShroudedKeyBag];

    if (!certBags || !keyBags) {
      throw new Error("Falha ao extrair chaves do PFX via Forge");
    }

    const certPem = forge.pki.certificateToPem(certBags[0]!.cert!);
    const keyPem = forge.pki.privateKeyToPem(keyBags[0]!.key!);

    return { cert: certPem, key: keyPem };
  }

  private async assinarEvento(
    infEventoXml: string,
    password: string,
    idTag: string,
  ): Promise<string> {
    const fullXmlToSign = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">${infEventoXml}</evento>`;

    const { cert, key } = this.getCredentialsFromPfx(password);

    const sig = new SignedXml();
    sig.privateKey = key;
    sig.publicCert = cert;
    sig.canonicalizationAlgorithm =
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";

    sig.addReference({
      xpath: "//*[local-name(.)='infEvento']",
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      ],
      digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
      uri: "#" + idTag,
    });

    sig.computeSignature(fullXmlToSign);
    return sig.getSignedXml();
  }

  public BuscarAtivos = async (req: Request, res: Response) => {
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
      w.cli_ativado = In(["s"]);
      if (servicos?.length) servicosFilter = servicos;
    }
    try {
      const clientesResponse = await ClientRepository.find({
        where: w,
        select: {
          id: true,
          login: true,
          cpf_cnpj: true,
          cli_ativado: true,
          nome: true,
          desconto: true,
        },
        order: { id: "DESC" },
      });

      res.status(200).json(clientesResponse);
    } catch {
      res.status(500).json({ message: "Erro ao buscar clientes" });
    }
  };
}

export default NFEController;
