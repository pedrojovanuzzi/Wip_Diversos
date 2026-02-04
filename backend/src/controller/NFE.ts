import { Request, Response } from "express";
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

class NFEController {
  private homologacao: boolean = false;
  private certPath = path.resolve(__dirname, "../files/certificado.pfx");
  private TEMP_DIR = path.resolve(__dirname, "../files");

  public emitirSaidaComodato = async (req: Request, res: Response) => {
    try {
      const { clienteId, equipamentos, password, ambiente } = req.body;

      this.homologacao = ambiente === "homologacao";

      const clientRepository = MkauthSource.getRepository(ClientesEntities);
      const nfeRepository = AppDataSource.getRepository(NFE);

      const client = await clientRepository.findOne({
        where: { id: clienteId },
      });
      if (!client) {
        res.status(404).json({ message: "Cliente não encontrado" });
        return;
      }

      // 1. Determine next NFE number
      const lastNfe = await nfeRepository.findOne({
        where: { serie: this.homologacao ? "99" : "1" }, // Adjust serie logic as needed
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
            xNome: client.nome,
            enderDest: {
              xLgr: client.endereco,
              nro: client.numero || "S/N",
              xBairro: client.bairro,
              cMun: client.cidade_ibge || "3503406", // Needs fallback or correct mapping
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
              NCM: "85176259", // Default for router/equipment, verify!
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
                ICMSSN400: {
                  // Simples Nacional - Não tributado
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

      // 4. Generate XML string
      let xml = create(
        { encoding: "UTF-8" },
        { NFe: { "@xmlns": "http://www.portalfiscal.inf.br/nfe", ...nfeData } },
      ).end({ prettyPrint: true });

      // 5. Sign XML
      const signedXml = await this.assinarXml(
        xml,
        password,
        nfeData.infNFe["@Id"],
      );

      // 6. Send to SEFAZ (simplified for now, assumes synchronous response or handled by background job logic in future)
      // For now, let's just save the signed XML

      const nfeRecord = nfeRepository.create({
        nNF: nfeData.infNFe.ide.nNF,
        serie: nfeData.infNFe.ide.serie,
        chave: chave,
        xml: signedXml,
        status: "assinado", // Pending transmission
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
        message: "NFE Gerada e Assinada",
        id: nfeRecord.id,
        chave: chave,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao emitir NFE", error: error });
    }
  };

  public emitirEntradaComodato = async (req: Request, res: Response) => {
    try {
      const { clienteId, equipamentos, password, ambiente } = req.body;

      this.homologacao = ambiente === "homologacao";

      const clientRepository = MkauthSource.getRepository(ClientesEntities);
      const nfeRepository = AppDataSource.getRepository(NFE);

      const client = await clientRepository.findOne({
        where: { id: clienteId },
      });
      if (!client) {
        res.status(404).json({ message: "Cliente não encontrado" });
        return;
      }

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
}

export default NFEController;
