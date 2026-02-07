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
import { XMLParser } from "fast-xml-parser";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import JSZip from "jszip";

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
      const nfeData: any = {
        infNFe: {
          "@Id": "",
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
            CNPJ: process.env.CPF_CNPJ?.replace(/\D/g, "") || "",
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
            xNome: this.homologacao
              ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
              : client.nome || "CLIENTE SEM NOME",
            enderDest: {
              xLgr: client.endereco || "Rua Sem Nome",
              nro: client.numero || "S/N",
              xBairro: client.bairro || "Bairro Padrão",
              cMun: client.cidade_ibge || "3503406",
              xMun: client.cidade || "Arealva",
              UF: client.estado || "SP",
              CEP: client.cep ? client.cep.replace(/\D/g, "") : "17160000",
              cPais: "1058",
              xPais: "BRASIL",
            },
            indIEDest: "9",
          },
          det: equipamentos.map((eq: any, index: number) => ({
            "@nItem": index + 1,
            prod: {
              cProd: eq.idprod,
              cEAN: "SEM GTIN",
              xProd: eq.descricao || "EQUIPAMENTO EM COMODATO",
              NCM: "85176259",
              CFOP: "5908",
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
                  (acc: number, cur: any) => acc + parseFloat(cur.valor || "0"),
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
                  (acc: number, cur: any) => acc + parseFloat(cur.valor || "0"),
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

      console.log(response);

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
      const dhEmi = moment()
        .tz("America/Sao_Paulo")
        .format("YYYY-MM-DDTHH:mm:ssZ");
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
            xNome: this.homologacao
              ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
              : client.nome || "CLIENTE SEM NOME",
            enderDest: {
              xLgr: client.endereco || "Rua Sem Nome",
              nro: client.numero || "S/N",
              xBairro: client.bairro || "Bairro Padrão",
              cMun: client.cidade_ibge || "3503406",
              xMun: client.cidade || "Arealva",
              UF: client.estado || "SP",
              CEP: client.cep ? client.cep.replace(/\D/g, "") : "17160000",
              cPais: "1058",
              xPais: "BRASIL",
            },
            indIEDest: "9",
          },
          det: equipamentos.map((eq: any, index: number) => ({
            "@nItem": index + 1,
            prod: {
              cProd: eq.idprod,
              cEAN: "SEM GTIN",
              xProd: eq.descricao || "DEVOLUCAO DE EQUIPAMENTO",
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
      ).end({ prettyPrint: false });

      const signedXml = await this.assinarXml(
        xml,
        password,
        nfeData.infNFe["@Id"],
      );

      // --- TRANSMISSION LOGIC START ---
      const loteXml = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>1</idLote><indSinc>1</indSinc>${signedXml.replace(/<\?xml.*?\?>/, "")}</enviNFe>`;

      const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${loteXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;

      const { cert, key } = this.getCredentialsFromPfx(password);
      const httpsAgent = new https.Agent({
        cert,
        key,
        rejectUnauthorized: false,
      });

      const url = this.homologacao
        ? "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx?WSDL"
        : "https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx?WSDL";

      console.log(`Enviando NFe Entrada para ${url}`);

      let response;
      try {
        response = await axios.post(url, soapEnvelope, {
          headers: {
            "Content-Type":
              'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"',
          },
          httpsAgent,
        });
      } catch (reqError: any) {
        console.error("Erro na requisição SOAP:", reqError.message);
        throw new Error(`Erro de comunicação com SEFAZ: ${reqError.message}`);
      }

      console.log("Response SEFAZ Status:", response.status);
      const responseBody = response.data;
      console.log(responseBody);

      let nProt = "";
      const nProtMatch = responseBody.match(/<nProt>(.*?)<\/nProt>/);
      nProt = nProtMatch ? nProtMatch[1] : "";

      const status = responseBody.includes("<cStat>100</cStat>")
        ? "autorizado"
        : "enviado";

      // --- TRANSMISSION LOGIC END ---

      const nfeRecord = nfeRepository.create({
        nNF: nfeData.infNFe.ide.nNF,
        serie: nfeData.infNFe.ide.serie,
        chave: chave,
        xml: signedXml,
        status: status,
        protocolo: nProt,
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
        message: "NFE de Entrada Processada",
        id: nfeRecord.id,
        chave: chave,
        nProt: nProt,
        status_sefaz: status,
        raw_response: responseBody.substring(0, 500),
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

  public BuscarNFEs = async (req: Request, res: Response) => {
    try {
      const { cpf, dateFilter, status, ambiente, tipo_operacao } = req.body;
      const nfeRepository = AppDataSource.getRepository(NFE);

      const where: any = {};

      if (cpf) {
        where.destinatario_cpf_cnpj = cpf.replace(/\D/g, "");
      }

      if (dateFilter && dateFilter.start && dateFilter.end) {
        // Force UTC boundaries to ensure we search exactly from 00:00:00 to 23:59:59 of the selected days
        // irrespective of the server timezone. This assumes the DB stores dates naively or we want strict visual matching.
        const start = new Date(
          `${dateFilter.start.substring(0, 10)}T00:00:00.000Z`,
        );
        const end = new Date(
          `${dateFilter.end.substring(0, 10)}T23:59:59.999Z`,
        );

        console.log("Filter Range (UTC):", start, end);

        where.data_emissao = Between(start, end);
      }

      if (status) {
        where.status = status;
      }

      if (ambiente) {
        where.tpAmb = ambiente === "homologacao" ? 2 : 1;
      }

      if (tipo_operacao) {
        where.tipo_operacao = tipo_operacao;
      }

      // Se nenhum filtro for passado, limita a 50 ou exige filtro?
      // Por padrão typeorm find sem where traz tudo. Vamos limitar ou permitir?
      // Melhor garantir que pelo menos um range de data ou cpf seja ideal, mas vamos deixar aberto por enquanto
      // com um take limite se não tiver filtro especifico, ou paginação.
      // Assumindo que o front envia filtros.

      const nfes = await nfeRepository.find({
        where: where,
        order: { id: "DESC" },
        take: 100, // Limite de segurança
      });

      // Parse XML to extract product info for frontend display
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: false,
      });

      const nfesWithProd = nfes.map((nfe) => {
        let xProd = "Produto não identificado";
        try {
          if (nfe.xml) {
            const parsed = parser.parse(nfe.xml);
            const root = parsed.nfeProc?.NFe || parsed.NFe;
            const det = root?.infNFe?.det;
            if (det) {
              // If array, take first. If object, take it.
              const firstItem = Array.isArray(det) ? det[0] : det;
              xProd = firstItem?.prod?.xProd || xProd;
            }
          }
        } catch (e) {
          // ignore parsing error
        }
        return { ...nfe, produto_predominante: xProd };
      });

      res.status(200).json(nfesWithProd);
    } catch (error: any) {
      console.error("Erro ao buscar NFEs:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar NFEs", error: error.message });
    }
  };
  public downloadXml = async (req: Request, res: Response) => {
    try {
      const { chave } = req.params;
      const nfeRepository = AppDataSource.getRepository(NFE);

      const nfe = await nfeRepository.findOne({ where: { chave } });

      if (!nfe || !nfe.xml) {
        res.status(404).json({ message: "XML não encontrado." });
        return;
      }

      const xmlContent = nfe.xml;
      const fileName = `${chave}-nfe.xml`;

      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      res.setHeader("Content-Type", "application/xml");
      res.send(xmlContent);
    } catch (error) {
      console.error("Erro ao baixar XML:", error);
      res.status(500).json({ message: "Erro ao baixar XML." });
    }
  };

  public generateReportPdf = async (req: Request, res: Response) => {
    try {
      const { id, dataInicio, dataFim, password, tipo_operacao } = req.body;

      // Se tiver IDs selecionados, usa eles. Se não, usa os filtros de data.
      let nfes: NFE[] = [];
      const nfeRepository = AppDataSource.getRepository(NFE);

      if (id && id.length > 0) {
        nfes = await nfeRepository.find({
          where: { id: In(id) },
          order: { nNF: "ASC" },
        });
      } else {
        // Busca por data se não tiver IDs
        // Converter strings de data "DD/MM/YYYY" para Date se necessário,
        // ou assumir que vem no formato ISO/correto se o frontend mandar.
        // O frontend manda LocaleDateString pt-BR. Vamos converter.

        let start: Date;
        let end: Date;

        if (dataInicio && dataFim) {
          const [diaIni, mesIni, anoIni] = dataInicio.split("/");
          const [diaFim, mesFim, anoFim] = dataFim.split("/");
          start = new Date(`${anoIni}-${mesIni}-${diaIni}T00:00:00`);
          end = new Date(`${anoFim}-${mesFim}-${diaFim}T23:59:59`);

          const where: any = {
            data_emissao: Between(start, end),
          };

          if (tipo_operacao) {
            where.tipo_operacao = tipo_operacao;
          }

          nfes = await nfeRepository.find({
            where: where,
            order: { nNF: "ASC" },
          });
        }
      }

      if (nfes.length === 0) {
        res
          .status(404)
          .json({ message: "Nenhuma nota encontrada para o relatório." });
        return;
      }

      const doc = new PDFDocument({ margin: 30, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        const result = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=relatorio_nfe.pdf",
        );
        res.send(result);
      });

      // --- Cabeçalho do Relatório ---
      // Draw Header Background
      doc.rect(0, 0, 595.28, 100).fill("#1e293b"); // Slate-900 like color
      doc.fillColor("white");

      doc.fontSize(20).text("Relatório de Notas Fiscais", 30, 30);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 30, 60);
      doc.text(
        `Período: ${dataInicio || "Início"} a ${dataFim || "Fim"}${tipo_operacao ? ` - Tipo: ${tipo_operacao}` : ""}`,
        30,
        75,
      );

      doc.text(`Total de Notas: ${nfes.length}`, 400, 60, { align: "right" });

      // Reset Colors
      doc.fillColor("black");

      doc.moveDown();
      doc.y = 120; // Start content below header

      // --- Tabela ---
      const startX = 30;
      let currentY = doc.y;

      // Column Configuration
      const cols = {
        numero: { x: 30, w: 50, title: "NÚMERO", align: "left" as const },
        serie: { x: 80, w: 30, title: "SÉR", align: "left" as const },
        tipo: { x: 110, w: 60, title: "TIPO", align: "left" as const },
        produto: { x: 170, w: 100, title: "PRODUTO", align: "left" as const },
        dest: { x: 270, w: 130, title: "DESTINATÁRIO", align: "left" as const },
        emissao: { x: 400, w: 60, title: "EMISSÃO", align: "left" as const },
        valor: { x: 460, w: 70, title: "VALOR", align: "right" as const },
        status: { x: 530, w: 60, title: "STATUS", align: "left" as const },
      };

      const drawHeader = (y: number) => {
        doc.rect(startX, y, 535, 20).fill("#e2e8f0"); // Gray-200
        doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(7);

        doc.text(cols.numero.title, cols.numero.x + 5, y + 6);
        doc.text(cols.serie.title, cols.serie.x + 5, y + 6);
        doc.text(cols.tipo.title, cols.tipo.x + 5, y + 6);
        doc.text(cols.produto.title, cols.produto.x + 5, y + 6);
        doc.text(cols.dest.title, cols.dest.x + 5, y + 6);
        doc.text(cols.emissao.title, cols.emissao.x + 5, y + 6);
        doc.text(cols.valor.title, cols.valor.x, y + 6, {
          width: cols.valor.w,
          align: "right",
        });
        doc.text(cols.status.title, cols.status.x + 5, y + 6);

        doc.fillColor("black");
      };

      drawHeader(currentY);
      currentY += 20;

      doc.font("Helvetica").fontSize(8);

      let totalValor = 0;

      // Parse Helper
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: false,
      });

      nfes.forEach((nfe, index) => {
        if (currentY > 750) {
          doc.addPage();
          currentY = 30;
          drawHeader(currentY);
          currentY += 20;
          doc.font("Helvetica").fontSize(8);
        }

        // Zebra Striping
        if (index % 2 !== 0) {
          doc.rect(startX, currentY, 535, 20).fill("#f8fafc"); // Very light gray
          doc.fillColor("black"); // Reset text color
        }

        // Extract Product
        let xProd = "-";
        try {
          if (nfe.xml) {
            const parsed = parser.parse(nfe.xml);
            const root = parsed.nfeProc?.NFe || parsed.NFe;
            const det = root?.infNFe?.det;
            if (det) {
              const firstItem = Array.isArray(det) ? det[0] : det;
              xProd = firstItem?.prod?.xProd || "-";
            }
          }
        } catch (e) {}

        const date = new Date(nfe.data_emissao);
        const dateStr = date.toLocaleDateString("pt-BR");
        const valor = parseFloat(nfe.valor_total.toString());
        totalValor += valor;

        // Vertical Alignment
        const textY = currentY + 6;

        doc.text(nfe.nNF, cols.numero.x + 5, textY);
        doc.text(nfe.serie, cols.serie.x + 5, textY);

        let tipoDisplay =
          nfe.tipo_operacao === "entrada_comodato"
            ? "ENTRADA"
            : nfe.tipo_operacao === "saida_comodato"
              ? "SAIDA"
              : "OUTRO";
        doc.text(tipoDisplay, cols.tipo.x + 5, textY);

        doc.text(xProd.substring(0, 30), cols.produto.x + 5, textY, {
          width: cols.produto.w - 5,
          ellipsis: true,
        });

        doc.text(
          (nfe.destinatario_nome || "").substring(0, 35),
          cols.dest.x + 5,
          textY,
          { width: cols.dest.w - 5, ellipsis: true },
        );
        doc.text(dateStr, cols.emissao.x + 5, textY);
        doc.text(
          valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
          cols.valor.x,
          textY,
          { width: cols.valor.w, align: "right" },
        );

        // Status color logic (text)
        doc.save();
        if (nfe.status === "autorizado") doc.fillColor("green");
        else if (nfe.status === "cancelado" || nfe.status === "erro")
          doc.fillColor("red");
        else doc.fillColor("blue");

        doc.text(nfe.status.toUpperCase(), cols.status.x + 5, textY);
        doc.restore();

        currentY += 20;
      });

      doc.moveDown();
      doc.moveDown();

      // Total Box
      doc.rect(350, currentY, 215, 30).fill("#f1f5f9");
      doc.fillColor("black").fontSize(10).font("Helvetica-Bold");
      doc.text("TOTAL DO PERÍODO", 360, currentY + 10);
      doc.text(
        `R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        360,
        currentY + 10,
        { align: "right", width: 195 },
      );

      doc.end();
    } catch (error) {
      console.error("Erro ao gerar relatório PDF:", error);
      res.status(500).json({ message: "Erro ao gerar relatório PDF." });
    }
  };

  public baixarZipXml = async (req: Request, res: Response) => {
    try {
      const { id } = req.body;
      const nfeRepository = AppDataSource.getRepository(NFE);

      const nfes = await nfeRepository.find({
        where: { id: In(id) },
      });

      if (!nfes.length) {
        res.status(404).json({ message: "Nenhuma nota encontrada." });
        return;
      }

      const zip = new JSZip();
      const folderXml = zip.folder("xmls");
      const folderPdf = zip.folder("pdfs");

      await Promise.all(
        nfes.map(async (nfe) => {
          const nomeArquivo = `NFe_${nfe.nNF}_Serie_${nfe.serie}`;

          if (nfe.xml) {
            folderXml?.file(`${nomeArquivo}.xml`, nfe.xml);
          }

          try {
            const pdfBuffer = await this.generateDanfe(nfe);
            folderPdf?.file(`${nomeArquivo}.pdf`, pdfBuffer);
          } catch (err) {
            console.error(`Erro ao gerar PDF da nota ${nfe.nNF}:`, err);
            folderPdf?.file(
              `ERRO_${nomeArquivo}.txt`,
              `Falha ao gerar PDF: ${err}`,
            );
          }
        }),
      );

      const zipContent = await zip.generateAsync({ type: "nodebuffer" });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=nfes_export.zip",
      );
      res.send(zipContent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao gerar ZIP." });
    }
  };

  public generateDanfe = async (nfe: NFE): Promise<Buffer> => {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "",
          parseTagValue: false,
        });

        const xmlString = nfe.xml;
        const parsed = parser.parse(xmlString);

        // Handle NFE structure variations (nfeProc vs NFe)
        let root = parsed.nfeProc?.NFe || parsed.NFe; // Standard is nfeProc > NFe

        if (!root) throw new Error("XML inválido ou formato desconhecido");

        const inf = root.infNFe;
        if (!inf) throw new Error("infNFe não encontrado");

        // Mapping fields
        const ide = inf.ide;
        const emit = inf.emit;
        const dest = inf.dest;
        const det = Array.isArray(inf.det) ? inf.det : [inf.det];
        const total = inf.total?.ICMSTot;

        const doc = new PDFDocument({ margin: 20, size: "A4" });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));

        // --- Layout Reuse (NFE) ---
        const margin = 20;
        const pageWidth = 595.28;
        const contentWidth = pageWidth - margin * 2;
        let y = margin;

        // Helper to draw a box
        const drawBox = (
          x: number,
          y: number,
          w: number,
          h: number,
          title: string,
        ) => {
          doc.rect(x, y, w, h).stroke();
          doc
            .fontSize(6)
            .font("Helvetica-Bold")
            .text(title.toUpperCase(), x + 2, y + 2);
        };

        // Header Section
        doc.rect(margin, y, contentWidth, 85).stroke();

        // Left: Emitente Logo/Names
        // const emitBoxW = contentWidth * 0.45;
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(emit.xNome.substring(0, 45), margin + 5, y + 15);

        doc.fontSize(8).font("Helvetica");
        const enderEmit = emit.enderEmit || {};
        doc.text(
          `${enderEmit.xLgr || ""}, ${enderEmit.nro || ""}`,
          margin + 5,
          y + 35,
        );
        doc.text(
          `Bairro: ${enderEmit.xBairro || ""} - CEP: ${enderEmit.CEP || ""}`,
          margin + 5,
          y + 45,
        );
        doc.text(
          `${enderEmit.xMun || ""} - ${enderEmit.UF || ""}`,
          margin + 5,
          y + 55,
        );
        doc.text(`CNPJ: ${emit.CNPJ}  IE: ${emit.IE}`, margin + 5, y + 70);

        // Right: DANFE Info
        const danfeBlockX = margin + 300;
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .text("DANFE", danfeBlockX, y + 10);
        doc
          .fontSize(8)
          .font("Helvetica")
          .text(
            "Documento Auxiliar da Nota Fiscal Eletrônica",
            danfeBlockX,
            y + 25,
          );

        doc.rect(danfeBlockX, y + 35, 235, 40).stroke(); // Chave Box within Header
        doc
          .fontSize(6)
          .font("Helvetica-Bold")
          .text("CHAVE DE ACESSO", danfeBlockX + 2, y + 37);
        doc
          .fontSize(8)
          .font("Helvetica")
          .text(nfe.chave.replace(/(\d{4})/g, "$1 "), danfeBlockX + 5, y + 55);

        y += 90;

        // Info Row (Natureza, Protocolo side by side or just simple info)
        drawBox(margin, y, 70, 25, "NÚMERO");
        doc.fontSize(10).text(ide.nNF, margin + 5, y + 12);

        drawBox(margin + 75, y, 40, 25, "SÉRIE");
        doc.fontSize(10).text(ide.serie, margin + 80, y + 12);

        drawBox(margin + 120, y, 320, 25, "NATUREZA DA OPERAÇÃO");
        doc
          .fontSize(9)
          .text((ide.natOp || "VENDA").substring(0, 50), margin + 125, y + 12);

        drawBox(margin + 445, y, contentWidth - 445, 25, "DATA DE EMISSÃO");
        doc
          .fontSize(10)
          .text(
            new Date(ide.dhEmi).toLocaleDateString("pt-BR"),
            margin + 450,
            y + 12,
          );

        y += 35;

        // Destinatario Section
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .text("DESTINATÁRIO / REMETENTE", margin, y);
        y += 10;

        // Row 1: Nome, CPF/CNPJ, Data Emissão (Again? Usually Data Saida)
        const destNameW = 350;
        drawBox(margin, y, destNameW, 25, "NOME / RAZÃO SOCIAL");
        doc
          .fontSize(9)
          .font("Helvetica")
          .text((dest.xNome || "").substring(0, 55), margin + 5, y + 12); // Truncate to avoid overlap

        drawBox(margin + destNameW, y, 120, 25, "CNPJ / CPF");
        doc
          .fontSize(9)
          .text(dest.CNPJ || dest.CPF || "", margin + destNameW + 5, y + 12);

        // Data Saida place
        drawBox(
          margin + destNameW + 120,
          y,
          contentWidth - (destNameW + 120),
          25,
          "DATA SAÍDA/ENTRADA",
        );
        // Assuming same date for simplicity or leave empty if not available
        doc.text(
          new Date(ide.dhEmi).toLocaleDateString("pt-BR"),
          margin + destNameW + 125,
          y + 12,
        );

        y += 25;

        // Row 2: Endereco, Bairro, CEP, Municipio, UF
        const enderDest = dest.enderDest || {};
        const addrW = 250;
        drawBox(margin, y, addrW, 25, "ENDEREÇO");
        doc.text(
          `${enderDest.xLgr || ""}, ${enderDest.nro || ""}`,
          margin + 5,
          y + 12,
        );

        drawBox(margin + addrW, y, 130, 25, "BAIRRO / DISTRITO");
        doc.text(
          (enderDest.xBairro || "").substring(0, 25),
          margin + addrW + 5,
          y + 12,
        );

        drawBox(margin + addrW + 130, y, 80, 25, "CEP");
        doc.text(enderDest.CEP || "", margin + addrW + 135, y + 12);

        drawBox(
          margin + addrW + 210,
          y,
          contentWidth - (addrW + 210),
          25,
          "MUNICÍPIO / UF",
        );
        doc.text(
          `${enderDest.xMun || ""} - ${enderDest.UF || ""}`,
          margin + addrW + 215,
          y + 12,
        );

        y += 35;

        // Products
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .text("DADOS DO PRODUTO / SERVIÇO", margin, y);
        y += 10;

        // Table Header
        const prodCols = {
          cod: { x: margin, w: 60, title: "CÓDIGO", align: "left" as const },
          desc: {
            x: margin + 60,
            w: 220,
            title: "DESCRIÇÃO",
            align: "left" as const,
          },
          ncm: { x: margin + 280, w: 50, title: "NCM", align: "left" as const },
          cst: { x: margin + 330, w: 30, title: "CST", align: "left" as const },
          cfop: {
            x: margin + 360,
            w: 30,
            title: "CFOP",
            align: "left" as const,
          },
          un: { x: margin + 390, w: 30, title: "UN", align: "left" as const },
          qtd: {
            x: margin + 420,
            w: 40,
            title: "QTD",
            align: "right" as const,
          },
          vunit: {
            x: margin + 460,
            w: 50,
            title: "V.UNIT",
            align: "right" as const,
          },
          vtot: {
            x: margin + 510,
            w: contentWidth - 510,
            title: "V.TOTAL",
            align: "right" as const,
          },
        };

        doc.rect(margin, y, contentWidth, 15).fill("#e5e7eb");
        doc.fillColor("black").fontSize(7).font("Helvetica-Bold");

        Object.values(prodCols).forEach((col) => {
          doc.text(col.title, col.x + 2, y + 5, {
            width: col.w - 4,
            align: col.align || "left",
          });
        });

        y += 15;
        doc.font("Helvetica");

        det.forEach((item: any, idx: number) => {
          const p = item.prod;
          const imp = item.imposto || {};

          // Simple zebra within items
          if (idx % 2 !== 0) {
            doc.rect(margin, y, contentWidth, 12).fill("#f9fafb");
            doc.fillColor("black");
          }

          const rowY = y + 3;
          doc.text(p.cProd, prodCols.cod.x + 2, rowY);
          doc.text(p.xProd.substring(0, 50), prodCols.desc.x + 2, rowY, {
            ellipsis: true,
          });
          doc.text(p.NCM, prodCols.ncm.x + 2, rowY);
          // Mock CST/CFOP if mostly standard or needs extract from imp
          doc.text("000", prodCols.cst.x + 2, rowY);
          doc.text(p.CFOP, prodCols.cfop.x + 2, rowY);
          doc.text(p.uCom, prodCols.un.x + 2, rowY);

          doc.text(
            parseFloat(p.qCom).toLocaleString("pt-BR"),
            prodCols.qtd.x,
            rowY,
            { width: prodCols.qtd.w, align: "right" },
          );
          doc.text(
            parseFloat(p.vUnCom).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            }),
            prodCols.vunit.x,
            rowY,
            { width: prodCols.vunit.w, align: "right" },
          );
          doc.text(
            parseFloat(p.vProd).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            }),
            prodCols.vtot.x,
            rowY,
            { width: prodCols.vtot.w, align: "right" },
          );

          y += 12;
        });

        // Footer / Totals
        y += 10;
        doc.rect(margin, y, contentWidth, 30).fill("#f3f4f6");
        doc.fillColor("black");

        const vTotTrib = total.vTotTrib
          ? `Trib Aprox: R$ ${total.vTotTrib}`
          : "";
        doc
          .fontSize(8)
          .text(
            "DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES",
            margin + 5,
            y + 5,
          );
        doc
          .fontSize(7)
          .text(
            `Inf. Adicionais: ${inf.infAdic?.infCpl || ""} ${vTotTrib}`,
            margin + 5,
            y + 15,
          );

        // Total Box to the right
        doc.rect(margin + 350, y, contentWidth - 350, 30).stroke();
        doc
          .fontSize(7)
          .font("Helvetica-Bold")
          .text("VALOR TOTAL DA NOTA", margin + 355, y + 5);
        doc.fontSize(12).text(
          "R$ " +
            parseFloat(total?.vNF || "0").toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            }),
          margin + 355,
          y + 15,
          { align: "right", width: contentWidth - 360 },
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  };

  public generatePdfFromNfXML = async (req: Request, res: Response) => {
    try {
      const { id } = req.body;
      const nfeRepository = AppDataSource.getRepository(NFE);
      const nfe = await nfeRepository.findOne({ where: { id: id } });

      if (!nfe) {
        res.status(404).json({ message: "NFE não encontrada" });
        return;
      }

      const pdfBuffer = await this.generateDanfe(nfe);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=nfe_${nfe.nNF}.pdf`,
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao gerar PDF." });
    }
  };
}

export default NFEController;
