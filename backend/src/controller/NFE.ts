import { Request, Response } from "express";
import { In, Between, IsNull, Like } from "typeorm";
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
import { SisProduto } from "../entities/SisProduto";
import { XMLParser } from "fast-xml-parser";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import JSZip from "jszip";
import { Jobs } from "../entities/Jobs";
import { type } from "os";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

class NFEController {
  private homologacao: boolean = false;
  private certPath = path.resolve(__dirname, "../files/certificado.pfx");
  private TEMP_DIR = path.resolve(__dirname, "../files");

  public emitirSaidaComodato = async (req: Request, res: Response) => {
    try {
      const { logins, password, ambiente } = req.body; // Changed validation to 'logins' array

      if (!logins || !Array.isArray(logins) || logins.length === 0) {
        res.status(400).json({ message: "Lista de logins não fornecida." });
        return;
      }

      // Create Job
      const job = AppDataSource.getRepository(Jobs).create({
        name: "Gerar NFE Saída Comodato",
        description: `Gerando ${logins.length} notas de Saída em Background`,
        status: "pendente",
        total: logins.length,
        processados: 0,
      });

      await AppDataSource.getRepository(Jobs).save(job);

      // Trigger background processing (fire and forget)
      this.processarFilaBackground(
        job,
        logins,
        password,
        ambiente,
        "saida",
      ).catch((err) =>
        console.error("Erro no processamento background (Saída):", err),
      );

      res.status(200).json({
        message: "Processamento iniciado em segundo plano.",
        job: job.id,
      });
    } catch (error: any) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Erro ao iniciar emissão", error: error.message });
    }
  };

  public emitirEntradaComodato = async (req: Request, res: Response) => {
    try {
      const { logins, password, ambiente } = req.body;

      if (!logins || !Array.isArray(logins) || logins.length === 0) {
        res.status(400).json({ message: "Lista de logins não fornecida." });
        return;
      }

      // Create Job
      const job = AppDataSource.getRepository(Jobs).create({
        name: "Gerar NFE Entrada Comodato",
        description: `Gerando ${logins.length} notas de Entrada em Background`,
        status: "pendente",
        total: logins.length,
        processados: 0,
      });

      await AppDataSource.getRepository(Jobs).save(job);

      // Trigger background processing (fire and forget)
      this.processarFilaBackground(
        job,
        logins,
        password,
        ambiente,
        "entrada",
      ).catch((err) =>
        console.error("Erro no processamento background (Entrada):", err),
      );

      res.status(200).json({
        message: "Processamento iniciado em segundo plano.",
        job: job.id,
      });
    } catch (error: any) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Erro ao iniciar emissão", error: error.message });
    }
  };

  private async processarFilaBackground(
    job: Jobs,
    logins: string[],
    password: string,
    ambiente: string,
    tipo: "saida" | "entrada",
  ) {
    const isHomologacao = ambiente === "homologacao";
    let contadorProcessados = 0;
    const responses: any[] = [];
    const clientRepository = MkauthSource.getRepository(ClientesEntities);
    const nfeRepository = AppDataSource.getRepository(NFE);
    const prodClienteRepository = MkauthSource.getRepository(Sis_prodCliente);
    const sisProdutoRepository = MkauthSource.getRepository(SisProduto);

    for (const login of logins) {
      let nfeRecord: NFE | null = null;
      let xmlToSave = "";

      try {
        contadorProcessados++;
        // Update job progress
        await AppDataSource.getRepository(Jobs).update(job.id, {
          processados: contadorProcessados,
          status: "processando",
        });

        // 1. Fetch Client
        const client = await clientRepository.findOne({
          where: { login: login },
        });

        if (!client) {
          throw new Error(`Cliente ${login} não encontrado.`);
        }

        // 2. Fetch Products
        const equipamentos = await prodClienteRepository.find({
          where: { cliente: client.login },
        });

        if (!equipamentos || equipamentos.length === 0) {
          throw new Error(`Produtos não encontrados para ${login}.`);
        }

        const productIds = equipamentos
          .map((eq) => eq.idprod)
          .filter((id) => id !== null && id !== undefined);

        const products = await sisProdutoRepository.findBy({
          id: In(productIds),
        });

        const productMap = new Map(products.map((p) => [p.id, p]));

        // 3. Determine Series and NFE Number & RESERVE IT WITH RETRY
        let reserved = false;
        let attempts = 0;
        let nfeData: any = {};

        while (!reserved && attempts < 5) {
          try {
            const effectiveSerie = isHomologacao ? "99" : "3";

            const result = await nfeRepository
              .createQueryBuilder("nfe")
              .select("MAX(CAST(nfe.nNF AS UNSIGNED))", "maxNfe")
              .where("nfe.serie = :serie", { serie: effectiveSerie })
              .getRawOne();

            const maxNfe = result?.maxNfe ? parseInt(result.maxNfe, 10) : 0;
            const nNF = maxNfe + 1;
            const serie = effectiveSerie;

            console.log(nNF);

            const dhEmi = moment()
              .tz("America/Sao_Paulo")
              .format("YYYY-MM-DDTHH:mm:ssZ");

            const cNF = Math.floor(Math.random() * 99999999)
              .toString()
              .padStart(8, "0");

            // 4. Build XML based on type
            const natOp =
              tipo === "saida" ? "REMESSA EM COMODATO" : "RETORNO DE COMODATO";
            const tpNF = tipo === "saida" ? "1" : "0";
            const cfop = tipo === "saida" ? "5908" : "1909";
            const xProdDefault =
              tipo === "saida"
                ? "EQUIPAMENTO EM COMODATO"
                : "DEVOLUCAO DE EQUIPAMENTO";

            nfeData = {
              infNFe: {
                "@Id": "",
                "@versao": "4.00",
                ide: {
                  cUF: "35",
                  cNF: cNF,
                  natOp: natOp,
                  mod: "55",
                  serie: serie,
                  nNF: nNF.toString(),
                  dhEmi: dhEmi,
                  dhSaiEnt: dhEmi,
                  tpNF: tpNF,
                  idDest: "1",
                  cMunFG: "3503406",
                  tpImp: "1",
                  tpEmis: "1",
                  cDV: "",
                  tpAmb: isHomologacao ? "2" : "1",
                  finNFe: "1",
                  indFinal: "1",
                  indPres: "1",
                  procEmi: "0",
                  verProc: "1.0",
                  // cRegTrib: "1", // If needed
                },
                emit: {
                  CNPJ: process.env.CPF_CNPJ?.replace(/\D/g, "") || "",
                  xNome: "WIP TELECOM MULTIMIDIA EIRELI",
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
                    client.cpf_cnpj.replace(/\D/g, "").length > 11
                      ? client.cpf_cnpj.replace(/\D/g, "")
                      : undefined,
                  CPF:
                    client.cpf_cnpj.replace(/\D/g, "").length <= 11
                      ? client.cpf_cnpj.replace(/\D/g, "")
                      : undefined,
                  xNome: isHomologacao
                    ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
                    : (client.nome || "CLIENTE SEM NOME").trim(),
                  enderDest: {
                    xLgr: (client.endereco || "Rua Sem Nome").trim(),
                    nro: (client.numero || "S/N").trim(),
                    xBairro: (client.bairro || "Bairro Padrão").trim(),
                    cMun: client.cidade_ibge || "3503406",
                    xMun: (client.cidade || "Arealva").trim(),
                    UF: client.estado || "SP",
                    CEP: client.cep
                      ? client.cep.replace(/\D/g, "")
                      : "17160000",
                    cPais: "1058",
                    xPais: "BRASIL",
                  },
                  indIEDest:
                    client.cpf_cnpj.replace(/\D/g, "").length > 11 &&
                    client.rg &&
                    client.rg.replace(/\D/g, "").length > 0
                      ? "1"
                      : "9",
                  IE:
                    client.cpf_cnpj.replace(/\D/g, "").length > 11 &&
                    client.rg &&
                    client.rg.replace(/\D/g, "").length > 0
                      ? client.rg.replace(/\D/g, "")
                      : undefined,
                },
                det: equipamentos.map((eq: any, index: number) => {
                  const product = eq.idprod ? productMap.get(eq.idprod) : null;
                  const valorProduto = product?.precoatual
                    ? parseFloat(product.precoatual as any).toFixed(2)
                    : "0.00";

                  return {
                    "@nItem": index + 1,
                    prod: {
                      cProd: eq.idprod,
                      cEAN: "SEM GTIN",
                      xProd: (
                        product?.nome ||
                        eq.descricao ||
                        xProdDefault
                      ).trim(),
                      NCM: product?.codigo || "85176259",
                      CFOP: cfop,
                      uCom: "UN",
                      qCom: "1.0000",
                      vUnCom: valorProduto,
                      vProd: valorProduto,
                      cEANTrib: "SEM GTIN",
                      uTrib: "UN",
                      qTrib: "1.0000",
                      vUnTrib: valorProduto,
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
                  };
                }),
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
                      .reduce((acc: number, cur: any) => {
                        const product = cur.idprod
                          ? productMap.get(cur.idprod)
                          : null;
                        const valor = product?.precoatual
                          ? parseFloat(product.precoatual as any)
                          : 0;
                        return acc + valor;
                      }, 0)
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
                      .reduce((acc: number, cur: any) => {
                        const product = cur.idprod
                          ? productMap.get(cur.idprod)
                          : null;
                        const valor = product?.precoatual
                          ? parseFloat(product.precoatual as any)
                          : 0;
                        return acc + valor;
                      }, 0)
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

            // --- SAVE RESERVATION START ---
            nfeRecord = nfeRepository.create({
              nNF: nfeData.infNFe.ide.nNF,
              serie: nfeData.infNFe.ide.serie,
              chave: chave,
              xml: "", // Will update later
              status: "processando", // Reserve status
              protocolo: "",
              data_emissao: new Date(),
              cliente_id: client.id,
              destinatario_nome: client.nome,
              destinatario_cpf_cnpj: client.cpf_cnpj,
              tipo_operacao:
                tipo === "saida" ? "saida_comodato" : "entrada_comodato",
              valor_total: parseFloat(nfeData.infNFe.total.ICMSTot.vNF),
              tpAmb: isHomologacao ? 2 : 1,
              tipo: ambiente,
            });

            await nfeRepository.save(nfeRecord);
            reserved = true;
          } catch (err: any) {
            attempts++;
            if (attempts >= 5) throw err;
            await new Promise((resolve) => setTimeout(resolve, 200 * attempts));
          }
        }
        // --- SAVE RESERVATION END ---

        // 5. Generate, Sign and Send
        let innerXml = create(
          { encoding: "UTF-8" },
          {
            NFe: {
              "@xmlns": "http://www.portalfiscal.inf.br/nfe",
              ...nfeData,
            },
          },
        ).end({ prettyPrint: false });

        // Capture unsigned XML for debugging if signing fails
        xmlToSave = innerXml;

        const signedXml = await this.assinarXml(
          innerXml,
          password,
          nfeData.infNFe["@Id"],
        );

        // Capture signed XML
        xmlToSave = signedXml;

        const loteXml = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>1</idLote><indSinc>1</indSinc>${signedXml.replace(/<\?xml.*?\?>/, "")}</enviNFe>`;

        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${loteXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;

        const { cert, key } = this.getCredentialsFromPfx(password);
        const httpsAgent = new https.Agent({
          cert,
          key,
          rejectUnauthorized: false,
        });

        const url = isHomologacao
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

        const responseBody = response.data;

        // Parse Response
        const protNFeMatch = responseBody.match(/<protNFe.*?>(.*?)<\/protNFe>/);
        const protNFeContent = protNFeMatch ? protNFeMatch[1] : "";

        let nProt = "";
        const nProtMatch = protNFeContent.match(/<nProt>(.*?)<\/nProt>/);
        nProt = nProtMatch ? nProtMatch[1] : "";

        let cStat = "";
        const cStatMatch = protNFeContent.match(/<cStat>(.*?)<\/cStat>/);
        cStat = cStatMatch ? cStatMatch[1] : "";

        let xMotivo = "";
        const xMotivoMatch = protNFeContent.match(/<xMotivo>(.*?)<\/xMotivo>/);
        xMotivo = xMotivoMatch ? xMotivoMatch[1] : "Erro desconhecido na SEFAZ";

        if (!cStat) {
          const cStatBatchMatch = responseBody.match(/<cStat>(.*?)<\/cStat>/);
          const xMotivoBatchMatch = responseBody.match(
            /<xMotivo>(.*?)<\/xMotivo>/,
          );
          if (cStatBatchMatch && cStatBatchMatch[1] !== "104") {
            cStat = cStatBatchMatch[1];
            xMotivo = xMotivoBatchMatch ? xMotivoBatchMatch[1] : "Erro no Lote";
          }
        }

        if (cStat !== "100") {
          throw new Error(`Erro SEFAZ: ${cStat} - ${xMotivo}`);
        }

        // 6. Update Success
        if (nfeRecord) {
          await nfeRepository.update(nfeRecord.id, {
            status: "autorizado",
            xml: signedXml, // Update with full signed XML
            protocolo: nProt,
          });
        }

        responses.push({
          success: true,
          id: nfeRecord?.id,
          message: `NFE ${nfeData.infNFe.ide.nNF} Autorizada`,
          nNF: nfeData.infNFe.ide.nNF,
        });
      } catch (error: any) {
        console.error(`Erro ao processar login ${login}:`, error);

        // --- DEBUG: Print XML on error ---
        if (xmlToSave) {
          console.log("\n========== XML COM ERRO ==========\n");
          console.log(xmlToSave);
          console.log("\n==================================\n");
        }

        // Update to error state if record was created
        if (nfeRecord) {
          await nfeRepository.update(nfeRecord.id, {
            status: "erro_emissao",
            xml: xmlToSave, // Save whatever XML we managed to generate (signed or unsigned)
          });
        }

        responses.push({
          success: false,
          login: login,
          message: error.message,
        });
      }
    }

    // Finish Job
    await AppDataSource.getRepository(Jobs).update(job.id, {
      status: "concluido",
      resultado: responses,
    });
  }

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
    if (cpf) w.cpf_cnpj = Like(`%${cpf}%`);
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
      w.comomodato = In(["sim"]);
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
          nome: true,
          fone: true,
          celular: true,
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
    w.cli_ativado = "s";
    w.comodato = "sim";
    let servicosFilter: string[] = ["mensalidade"];

    if (cpf) w.cpf_cnpj = Like(`%${cpf}%`);
    if (filters) {
      let { plano, vencimento, SCM, servicos } = filters;
      if (plano?.length) w.plano = In(plano);
      if (vencimento?.length) w.venc = In(vencimento);
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
          nome: true,
          desconto: true,
          fone: true,
          celular: true,
        },
        order: { id: "DESC" },
      });

      res.status(200).json(clientesResponse);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao buscar clientes" });
    }
  };

  public BuscarNFEs = async (req: Request, res: Response) => {
    try {
      const {
        cpf,
        serie,
        dateFilter,
        status,
        ambiente,
        tipo_operacao,
        page = 1,
        limit = 100,
      } = req.body;
      const nfeRepository = AppDataSource.getRepository(NFE);

      const where: any = {};

      if (cpf) {
        where.destinatario_cpf_cnpj = cpf.replace(/\D/g, "");
      }

      if (serie) {
        where.serie = serie;
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

      const take = Number(limit);
      const skip = (Number(page) - 1) * take;

      const [nfes, total] = await nfeRepository.findAndCount({
        where: where,
        order: { id: "DESC" },
        take: take,
        skip: skip,
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

      res.status(200).json({
        data: nfesWithProd,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / take),
      });
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
      const {
        id,
        cpf,
        dateFilter,
        status,
        ambiente,
        tipo_operacao,
        dataInicio,
        dataFim,
        serie,
      } = req.body;
      const nfeRepository = AppDataSource.getRepository(NFE);

      // Determine WHERE clause using QueryBuilder
      const query = nfeRepository.createQueryBuilder("nfe");

      if (id && id.length > 0) {
        query.where("nfe.id IN (:...ids)", { ids: id });
      } else {
        if (cpf) {
          query.andWhere("nfe.destinatario_cpf_cnpj = :cpf", {
            cpf: cpf.replace(/\D/g, ""),
          });
        }
        if (serie) {
          query.andWhere("nfe.serie = :serie", { serie });
        }

        // Handle both new dateFilter and old dataInicio/dataFim
        if (dateFilter && dateFilter.start && dateFilter.end) {
          const start = new Date(
            `${dateFilter.start.substring(0, 10)}T00:00:00.000Z`,
          );
          const end = new Date(
            `${dateFilter.end.substring(0, 10)}T23:59:59.999Z`,
          );
          query.andWhere("nfe.data_emissao BETWEEN :start AND :end", {
            start,
            end,
          });
        } else if (dataInicio && dataFim) {
          const [diaIni, mesIni, anoIni] = dataInicio.split("/");
          const [diaFim, mesFim, anoFim] = dataFim.split("/");
          const start = new Date(
            `${anoIni}-${mesIni}-${diaIni}T00:00:00.000-03:00`,
          );
          const end = new Date(
            `${anoFim}-${mesFim}-${diaFim}T23:59:59.999-03:00`,
          );
          query.andWhere("nfe.data_emissao BETWEEN :start AND :end", {
            start,
            end,
          });
        }

        if (status) query.andWhere("nfe.status = :status", { status });
        if (ambiente) {
          query.andWhere("nfe.tpAmb = :tpAmb", {
            tpAmb: ambiente === "homologacao" ? 2 : 1,
          });
        }
        if (tipo_operacao) {
          query.andWhere("nfe.tipo_operacao = :tipo_operacao", {
            tipo_operacao,
          });
        }
      }

      // 1. Check Count first
      const totalCount = await query.getCount();

      if (totalCount === 0) {
        res
          .status(404)
          .json({ message: "Nenhuma nota encontrada para o relatório." });
        return;
      }

      // Prepare Response for Streaming
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=relatorio_nfe.pdf",
      );

      const doc = new PDFDocument({ margin: 30, size: "A4" });
      doc.pipe(res);

      // --- Cabeçalho do Relatório ---
      doc.rect(0, 0, 595.28, 100).fill("#1e293b");
      doc.fillColor("white");

      doc.fontSize(20).text("Relatório de Notas Fiscais", 30, 30);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 30, 60);

      let periodoTexto = "Todo o período";
      if (dateFilter && dateFilter.start && dateFilter.end) {
        const fmt = (iso: string) => iso.split("-").reverse().join("/");
        periodoTexto = `${fmt(dateFilter.start)} a ${fmt(dateFilter.end)}`;
      } else if (dataInicio && dataFim) {
        periodoTexto = `${dataInicio} a ${dataFim}`;
      }

      doc.text(
        `Período: ${periodoTexto}${tipo_operacao ? ` - Tipo: ${tipo_operacao}` : ""}`,
        30,
        75,
      );
      doc.text(`Total de Notas: ${totalCount}`, 400, 60, { align: "right" });

      doc.fillColor("black");
      doc.moveDown();
      doc.y = 120;

      // --- Tabela Setup ---
      const startX = 30;
      let currentY = doc.y;

      const cols = {
        numero: { x: 30, w: 45, title: "NÚMERO", align: "left" as const },
        serie: { x: 75, w: 25, title: "SÉR", align: "left" as const },
        tipo: { x: 100, w: 50, title: "TIPO", align: "left" as const },
        produto: { x: 150, w: 90, title: "PRODUTO", align: "left" as const },
        dest: { x: 240, w: 120, title: "DESTINATÁRIO", align: "left" as const },
        emissao: { x: 360, w: 55, title: "EMISSÃO", align: "left" as const },
        valor: { x: 415, w: 65, title: "VALOR", align: "right" as const },
        status: { x: 480, w: 80, title: "STATUS", align: "left" as const },
      };

      const drawHeader = (y: number) => {
        doc.rect(startX, y, 535, 20).fill("#e2e8f0");
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

      // --- Streaming Loop ---
      let totalValor = 0;
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: false,
      });

      const batchSize = 200; // Larger batch for simple DB reads
      let processed = 0;

      // Add Sorting
      query.orderBy("CAST(nfe.nNF AS UNSIGNED)", "ASC");

      while (processed < totalCount) {
        const batch = await query.skip(processed).take(batchSize).getMany();

        for (let i = 0; i < batch.length; i++) {
          const nfe = batch[i];
          const globalIndex = processed + i;

          if (currentY > 750) {
            doc.addPage();
            currentY = 30;
            drawHeader(currentY);
            currentY += 20;
            doc.font("Helvetica").fontSize(8);
          }

          if (globalIndex % 2 !== 0) {
            doc.rect(startX, currentY, 535, 20).fill("#f8fafc");
            doc.fillColor("black");
          }

          let xProd = "-";
          try {
            if (nfe.xml) {
              const parsed = parser.parse(nfe.xml);
              const root = parsed.nfeProc?.NFe || parsed.NFe;
              const det = root?.infNFe?.det;
              const firstItem = Array.isArray(det) ? det[0] : det;
              xProd = firstItem?.prod?.xProd || "-";
            }
          } catch (e) {}

          const dateStr = new Date(nfe.data_emissao).toLocaleDateString(
            "pt-BR",
          );
          const valor = parseFloat(nfe.valor_total.toString());
          totalValor += valor;

          const textY = currentY + 6;
          doc.text(nfe.nNF.toString(), cols.numero.x + 5, textY);
          doc.text(nfe.serie.toString(), cols.serie.x + 5, textY);

          let tipo =
            nfe.tipo_operacao === "entrada_comodato"
              ? "ENTRADA"
              : nfe.tipo_operacao === "saida_comodato"
                ? "SAIDA"
                : "OUTRO";
          doc.text(tipo, cols.tipo.x + 5, textY);

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

          doc.save();
          if (nfe.status === "autorizado") doc.fillColor("green");
          else if (nfe.status === "cancelado" || nfe.status.includes("erro"))
            doc.fillColor("red");
          else doc.fillColor("blue");
          doc.text(nfe.status.toUpperCase(), cols.status.x + 5, textY);
          doc.restore();

          currentY += 20;
        }

        processed += batch.length;
        // Allow event loop to breathe
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      doc.moveDown();
      if (currentY > 750) {
        doc.addPage();
        currentY = 30;
      }
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
      console.log("Iniciando geração de ZIP...");
      const { id, cpf, serie, dateFilter, status, ambiente, tipo_operacao } =
        req.body;
      const nfeRepository = AppDataSource.getRepository(NFE);

      // Determine WHERE clause using QueryBuilder
      const query = nfeRepository.createQueryBuilder("nfe");

      if (id && id.length > 0) {
        query.where("nfe.id IN (:...ids)", { ids: id });
      } else {
        if (cpf) {
          query.andWhere("nfe.destinatario_cpf_cnpj = :cpf", {
            cpf: cpf.replace(/\D/g, ""),
          });
        }
        if (serie) {
          query.andWhere("nfe.serie = :serie", { serie });
        }
        if (dateFilter && dateFilter.start && dateFilter.end) {
          const start = new Date(
            `${dateFilter.start.substring(0, 10)}T00:00:00.000Z`,
          );
          const end = new Date(
            `${dateFilter.end.substring(0, 10)}T23:59:59.999Z`,
          );
          query.andWhere("nfe.data_emissao BETWEEN :start AND :end", {
            start,
            end,
          });
        }
        if (status) query.andWhere("nfe.status = :status", { status });
        if (ambiente) {
          query.andWhere("nfe.tpAmb = :tpAmb", {
            tpAmb: ambiente === "homologacao" ? 2 : 1,
          });
        }
        if (tipo_operacao) {
          query.andWhere("nfe.tipo_operacao = :tipo_operacao", {
            tipo_operacao,
          });
        }
      }

      // Count total first to ensure we have something to download
      const totalCount = await query.getCount();
      console.log(`Total de notas para ZIP: ${totalCount}`);

      if (totalCount === 0) {
        res.status(404).json({ message: "Nenhuma nota encontrada." });
        return;
      }

      // Initialize Archiver
      const archiver = require("archiver");
      const archive = archiver("zip", { zlib: { level: 9 } });

      // Handle Archive Errors
      archive.on("error", (err: any) => {
        console.error("Erro no Archiver:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: err.message });
        } else {
          res.end();
        }
      });

      // Handle Client Disconnect
      res.on("close", () => {
        console.log("Cliente cancelou o download do ZIP.");
        archive.abort();
      });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=nfes_export.zip",
      );

      archive.pipe(res);

      // Fetch and process in batches to avoid OOM
      const batchSize = 10;
      let processed = 0;

      // Add Sorting
      query.orderBy("CAST(nfe.nNF AS UNSIGNED)", "ASC");

      while (processed < totalCount) {
        // Stop if response is closed
        if (res.writableEnded || res.closed) break;

        const batch = await query.skip(processed).take(batchSize).getMany();

        for (const nfe of batch) {
          const nomeArquivo = `NFe_${nfe.nNF}_Serie_${nfe.serie}`;

          // Add XML
          if (nfe.xml) {
            archive.append(nfe.xml, { name: `xmls/${nomeArquivo}.xml` });
          }

          // Add PDF
          try {
            const pdfBuffer = await this.generateDanfe(nfe);
            archive.append(pdfBuffer, { name: `pdfs/${nomeArquivo}.pdf` });
          } catch (err) {
            console.error(`Erro ao gerar PDF da nota ${nfe.nNF}:`, err);
            archive.append(`Erro: ${err}`, {
              name: `pdfs/ERRO_${nomeArquivo}.txt`,
            });
          }
        }

        processed += batch.length;
        console.log(`Processado ${processed}/${totalCount}`);

        // Minimal delay to allow event loop to handle I/O
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      console.log("Finalizando arquivo ZIP.");
      await archive.finalize();
    } catch (error) {
      console.error("Erro geral no baixarZipXml:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Erro ao gerar ZIP." });
      }
    }
  };

  public generateDanfe = async (nfe: NFE): Promise<Buffer> => {
    return new Promise<Buffer>(async (resolve, reject) => {
      try {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "",
          parseTagValue: false,
        });

        const xmlString = nfe.xml;
        const parsed = parser.parse(xmlString);

        // Handle NFE structure variations (nfeProc vs NFe)
        let root = parsed.nfeProc?.NFe || parsed.NFe;
        const protNFe = parsed.nfeProc?.protNFe || null;

        if (!root) throw new Error("XML inválido ou formato desconhecido");

        const inf = root.infNFe;
        if (!inf) throw new Error("infNFe não encontrado");

        // Mapping fields
        const ide = inf.ide;
        const emit = inf.emit;
        const dest = inf.dest;
        const det = Array.isArray(inf.det) ? inf.det : [inf.det];
        const total = inf.total?.ICMSTot;
        const transp = inf.transp;
        const infAdic = inf.infAdic;

        // Extract Chave and Protocol from XML if available
        let chave = inf["@Id"] ? inf["@Id"].replace("NFe", "") : nfe.chave;
        let protocolo = protNFe?.infProt?.nProt || nfe.protocolo || "";
        let dataHoraEmissao = ide.dhEmi;
        let dataHoraSaida = ide.dhSaiEnt || ide.dhEmi; // Fallback to emission if not present

        const doc = new PDFDocument({ margin: 10, size: "A4" });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));

        // Fonts
        doc.font("Helvetica");

        // --- Layout Constants ---
        const margin = 10;
        const pageWidth = 595.28;
        const contentWidth = pageWidth - margin * 2;
        let y = margin;
        const lineHeight = 10;

        // --- Helpers ---
        const drawBox = (
          x: number,
          y: number,
          w: number,
          h: number,
          title: string,
          value: string = "",
          align: "left" | "center" | "right" = "left",
          fontSize: number = 8,
          boldValue: boolean = false,
        ) => {
          doc.rect(x, y, w, h).lineWidth(0.5).stroke();
          doc
            .fontSize(5)
            .font("Helvetica")
            .text(title.toUpperCase(), x + 2, y + 2, { width: w - 4 });

          if (value) {
            doc
              .fontSize(fontSize)
              .font(boldValue ? "Helvetica-Bold" : "Helvetica")
              .text(value, x + 2, y + 8, {
                width: w - 4,
                align: align === "left" ? undefined : align,
              });
          }
        };

        const drawSectionTitle = (title: string, yPos: number) => {
          doc.font("Helvetica-Bold").fontSize(7).text(title, margin, yPos);
          return yPos + 8;
        };

        // --- 1. Header (Canhoto + Emitente) ---

        // Canhoto
        doc.rect(margin, y, contentWidth, 25).lineWidth(0.5).stroke();

        // Row 1: Receipt Text
        doc
          .fontSize(6)
          .text(
            "RECEBEMOS DE " +
              emit.xNome.substring(0, 60) +
              " OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO",
            margin + 2,
            y + 2,
            { width: 440, align: "left" },
          );

        // Row 1.5: Extra Info (Emissao, Valor, Destinatario)
        let totalVal = total?.vNF || "0,00"; // Should be formatted number
        if (typeof totalVal === "number") totalVal = totalVal.toFixed(2);
        const formattedTotal = totalVal.replace(".", ",");

        doc.fontSize(5).text(
          `EMISSÃO: ${new Date(dataHoraEmissao).toLocaleDateString("pt-BR")}   VALOR TOTAL: R$ ${formattedTotal}   DESTINATÁRIO: ${dest.xNome.substring(0, 50)}`,
          margin + 2,
          y + 9, // Just below the first line
          { width: 440, align: "left" },
        );

        // Horizontal line separator
        doc
          .moveTo(margin, y + 15)
          .lineTo(margin + 450, y + 15)
          .stroke();

        // Row 2: Data & Signature
        doc
          .moveTo(margin + 130, y + 15)
          .lineTo(margin + 130, y + 25)
          .stroke();
        doc.fontSize(6).text("DATA DE RECEBIMENTO", margin + 2, y + 17);

        doc
          .moveTo(margin + 450, y)
          .lineTo(margin + 450, y + 25)
          .stroke(); // Right border of Canhoto section (left border of NF-e box)

        doc
          .fontSize(6)
          .text(
            "IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR",
            margin + 132,
            y + 17,
          );

        // Adjusted top-right block to fit text inside 25px height
        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .text("NF-e", margin + 450, y + 2, { width: 125, align: "center" });
        doc
          .fontSize(7)
          .font("Helvetica")
          .text(`Nº ${ide.nNF}`, margin + 450, y + 10, {
            width: 125,
            align: "center",
          });
        doc.text(`SÉRIE ${ide.serie}`, margin + 450, y + 17, {
          width: 125,
          align: "center",
        });

        y += 30; // Gap for cut line
        doc
          .dash(2, { space: 2 })
          .moveTo(margin, y - 2)
          .lineTo(pageWidth - margin, y - 2)
          .stroke()
          .undash();

        // Emitente Area
        const logoHeight = 85;
        const emitenteBoxWidth = 230; // Reduced slightly to give space to DANFE

        // Logo / Identificacao Emitente
        drawBox(margin, y, emitenteBoxWidth, logoHeight, ""); // Placeholder for logo/text
        // Simulate Logo or Text
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .text(emit.xNome, margin + 5, y + 10, {
            width: emitenteBoxWidth - 10,
            align: "center",
          });
        doc
          .font("Helvetica")
          .fontSize(8)
          .text(emit.xFant || "", margin + 5, y + 30, {
            width: emitenteBoxWidth - 10,
            align: "center",
          });

        const ender = emit.enderEmit;
        const enderString = `${ender.xLgr}, ${ender.nro} ${ender.xCpl ? "- " + ender.xCpl : ""}
${ender.xBairro} - ${ender.xMun} - ${ender.UF}
CEP: ${ender.CEP} - Fone: ${ender.fone || ""}`;
        doc.fontSize(7).text(enderString, margin + 5, y + 45, {
          width: emitenteBoxWidth - 10,
          align: "center",
        });

        // DANFE Label Block - INCREASED WIDTH from 35 to 80
        const danfeX = margin + emitenteBoxWidth;
        const danfeW = 90;
        drawBox(danfeX, y, danfeW, logoHeight, "");
        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .text("DANFE", danfeX, y + 5, { width: danfeW, align: "center" });
        doc
          .fontSize(8) // Increased font size for readability
          .text(
            "Documento Auxiliar da Nota Fiscal Eletrônica",
            danfeX,
            y + 20,
            { width: danfeW, align: "center" },
          );
        doc.fontSize(8).text("0 - Entrada", danfeX + 5, y + 45);
        doc.fontSize(8).text("1 - Saída", danfeX + 5, y + 55);
        doc
          .fontSize(12)
          .rect(danfeX + 55, y + 42, 25, 20) // Adjusted box position
          .stroke()
          .text(ide.tpNF, danfeX + 55, y + 47, { width: 25, align: "center" });

        // Barcode Block
        const barCodeX = danfeX + danfeW;
        const barCodeW = contentWidth - (emitenteBoxWidth + danfeW);
        const code128Height = 50;

        drawBox(barCodeX, y, barCodeW, logoHeight, "");

        // Generate Barcode
        try {
          const bwipjs = require("bwip-js");
          const png = await bwipjs.toBuffer({
            bcid: "code128", // Barcode type
            text: chave.replace(/\D/g, ""), // Text to encode
            scale: 3, // 3x scaling factor
            height: 10, // Bar height, in millimeters
            includetext: false, // Show human-readable text
            textxalign: "center", // Always good to set this
          });
          doc.image(png, barCodeX + 10, y + 5, {
            height: 45,
            width: barCodeW - 20,
          });
        } catch (e) {
          doc.text("Erro Barcode", barCodeX + 5, y + 20);
        }

        // Chave de Acesso
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .text("CHAVE DE ACESSO", barCodeX + 5, y + 55);
        const chaveFmt = chave
          .replace(/\D/g, "")
          .replace(/(\d{4})/g, "$1 ")
          .trim();
        doc
          .fontSize(9)
          .font("Helvetica")
          .text(chaveFmt, barCodeX + 5, y + 68);

        y += logoHeight;

        // Nat Op / Protocolo
        drawBox(
          margin,
          y,
          350,
          25,
          "NATUREZA DA OPERAÇÃO",
          ide.natOp || "VENDA",
          "left",
          9,
        );
        drawBox(
          margin + 350,
          y,
          contentWidth - 350,
          25,
          "PROTOCOLO DE AUTORIZAÇÃO DE USO",
          `${protocolo || ""} - ${new Date(dataHoraEmissao).toLocaleDateString("pt-BR")}`,
          "center",
          9,
        );
        y += 25;

        drawBox(margin, y, 190, 25, "INSCRIÇÃO ESTADUAL", emit.IE);
        drawBox(
          margin + 190,
          y,
          190,
          25,
          "INSCRIÇÃO ESTADUAL DO SUBST. TRIB.",
          "",
        );
        drawBox(margin + 380, y, contentWidth - 380, 25, "CNPJ", emit.CNPJ);
        y += 30; // Spacing

        // --- 2. Destinatario ---
        y = drawSectionTitle("DESTINATÁRIO / REMETENTE", y);
        drawBox(
          margin,
          y,
          350,
          25,
          "NOME / RAZÃO SOCIAL",
          dest.xNome,
          "left",
          9,
          true,
        );
        drawBox(margin + 350, y, 110, 25, "CNPJ / CPF", dest.CNPJ || dest.CPF);
        drawBox(
          margin + 460,
          y,
          contentWidth - 460,
          25,
          "DATA DA EMISSÃO",
          new Date(dataHoraEmissao).toLocaleDateString("pt-BR"),
          "center",
        );
        y += 25;

        const destEnd = dest.enderDest;
        drawBox(
          margin,
          y,
          270,
          25,
          "ENDEREÇO",
          `${destEnd.xLgr}, ${destEnd.nro}`,
        );
        drawBox(margin + 270, y, 140, 25, "BAIRRO / DISTRITO", destEnd.xBairro);
        drawBox(margin + 410, y, 50, 25, "CEP", destEnd.CEP);
        drawBox(
          margin + 460,
          y,
          contentWidth - 460,
          25,
          "DATA SAÍDA/ENTRADA",
          new Date(dataHoraSaida).toLocaleDateString("pt-BR"),
          "center",
        ); // replicate emission for now
        y += 25;

        drawBox(margin, y, 20, 25, "UF", destEnd.UF); // Fixed width for UF
        drawBox(margin + 20, y, 200, 25, "MUNICÍPIO", destEnd.xMun);
        drawBox(margin + 220, y, 100, 25, "FONE / FAX", destEnd.fone);
        drawBox(margin + 320, y, 140, 25, "INSCRIÇÃO ESTADUAL", dest.IE);
        drawBox(
          margin + 460,
          y,
          contentWidth - 460,
          25,
          "HORA SAÍDA",
          new Date(dataHoraSaida).toLocaleTimeString("pt-BR").substring(0, 5),
          "center",
        );
        y += 30;

        // --- 3. Imposto ---
        // Simplified for now assuming Mock data or 0 if not present, as usually tax calc is complex
        y = drawSectionTitle("CÁLCULO DO IMPOSTO", y);

        const wBase = contentWidth / 5;
        // Row 1
        drawBox(
          margin,
          y,
          wBase,
          25,
          "BASE DE CÁLCULO DO ICMS",
          total.vBC || "0,00",
          "right",
        );
        drawBox(
          margin + wBase,
          y,
          wBase,
          25,
          "VALOR DO ICMS",
          total.vICMS || "0,00",
          "right",
        );
        drawBox(
          margin + wBase * 2,
          y,
          wBase,
          25,
          "BASE DE CÁLC. ICMS S.T.",
          total.vBCST || "0,00",
          "right",
        );
        drawBox(
          margin + wBase * 3,
          y,
          wBase,
          25,
          "VALOR DO ICMS SUBST.",
          total.vST || "0,00",
          "right",
        );
        drawBox(
          margin + wBase * 4,
          y,
          wBase,
          25,
          "VALOR TOTAL DOS PRODUTOS",
          total.vProd || "0,00",
          "right",
          9,
          true,
        );
        y += 25;

        // Row 2
        drawBox(
          margin,
          y,
          wBase,
          25,
          "VALOR DO FRETE",
          total.vFrete || "0,00",
          "right",
        );
        drawBox(
          margin + wBase,
          y,
          wBase,
          25,
          "VALOR DO SEGURO",
          total.vSeg || "0,00",
          "right",
        );
        drawBox(
          margin + wBase * 2,
          y,
          wBase,
          25,
          "DESCONTO",
          total.vDesc || "0,00",
          "right",
        );
        drawBox(
          margin + wBase * 3,
          y,
          wBase,
          25,
          "OUTRAS DESPESAS ACESS.",
          total.vOutro || "0,00",
          "right",
        );
        drawBox(
          margin + wBase * 4,
          y,
          wBase,
          25,
          "VALOR TOTAL DA NOTA",
          total.vNF || "0,00",
          "right",
          10,
          true,
        );
        y += 30;

        // --- 4. Transportador ---
        y = drawSectionTitle("TRANSPORTADOR / VOLUMES TRANSPORTADOS", y);
        const modFrete = transp.modFrete || "9";
        const modFreteText =
          modFrete === "0"
            ? "0 - Remetente (CIF)"
            : modFrete === "1"
              ? "1 - Destinatário (FOB)"
              : "9 - Sem Frete";

        drawBox(
          margin,
          y,
          250,
          25,
          "NOME / RAZÃO SOCIAL",
          transp.transporta?.xNome || "",
          "left",
        );
        drawBox(
          margin + 250,
          y,
          120,
          25,
          "FRETE POR CONTA",
          modFreteText,
          "left",
          7,
        );
        drawBox(margin + 370, y, 80, 25, "CÓDIGO ANTT", "");
        drawBox(margin + 450, y, 80, 25, "PLACA DO VEÍC", "");
        drawBox(margin + 530, y, 45, 25, "UF", "");
        y += 25;

        // Vol row
        drawBox(
          margin,
          y,
          250,
          25,
          "ENDEREÇO",
          transp.transporta?.xEnder || "",
        );
        drawBox(
          margin + 250,
          y,
          120,
          25,
          "MUNICÍPIO",
          transp.transporta?.xMun || "",
        );
        drawBox(margin + 370, y, 30, 25, "UF", transp.transporta?.UF || "");
        drawBox(
          margin + 400,
          y,
          contentWidth - 400,
          25,
          "INSCRIÇÃO ESTADUAL",
          "",
        );
        y += 25;

        // Vol row 2
        const vol = transp.vol
          ? Array.isArray(transp.vol)
            ? transp.vol[0]
            : transp.vol
          : {};
        drawBox(margin, y, 50, 25, "QUANTIDADE", vol.qVol || "");
        drawBox(margin + 50, y, 100, 25, "ESPÉCIE", vol.esp || "");
        drawBox(margin + 150, y, 100, 25, "MARCA", vol.marca || "");
        drawBox(margin + 250, y, 100, 25, "NUMERAÇÃO", vol.nVol || "");
        drawBox(
          margin + 350,
          y,
          110,
          25,
          "PESO BRUTO",
          vol.pesoB || "0.000",
          "right",
        );
        drawBox(
          margin + 460,
          y,
          contentWidth - 460,
          25,
          "PESO LÍQUIDO",
          vol.pesoL || "0.000",
          "right",
        );
        y += 30;

        // --- 5. Dados Produto ---
        y = drawSectionTitle("DADOS DO PRODUTO / SERVIÇO", y);

        // Columns
        // CÓDIGO | DESCRIÇÃO | NCM | CST | CFOP | UN | QTD | V.UNIT | V.TOT | BC ICMS | V.ICMS | V.IPI | ALIQ.ICMS | ALIQ.IPI
        // Simplified based on user image request typically showing less columns or squeezing them

        const cols = {
          cod: { x: margin, w: 40, t: "CÓD" },
          desc: { x: margin + 40, w: 180, t: "DESCRIÇÃO DO PRODUTO/SERVIÇO" },
          ncm: { x: margin + 220, w: 40, t: "NCM" },
          cst: { x: margin + 260, w: 25, t: "CST" },
          cfop: { x: margin + 285, w: 25, t: "CFOP" },
          un: { x: margin + 310, w: 20, t: "UN" },
          qtd: { x: margin + 330, w: 40, t: "QTD" },
          vunit: { x: margin + 370, w: 45, t: "V.UNIT" },
          vtot: { x: margin + 415, w: 45, t: "V.TOTAL" },
          bcicms: { x: margin + 460, w: 40, t: "BC.ICMS" },
          vicms: { x: margin + 500, w: 35, t: "V.ICMS" },
          vipi: { x: margin + 535, w: 20, t: "V.IPI" }, // squeezed
          aliqicms: { x: margin + 555, w: 20, t: "%ICMS" },
        };

        // Header
        const hHeight = 15;
        doc.rect(margin, y, contentWidth, hHeight).stroke();
        doc.fontSize(6).font("Helvetica-Bold");
        Object.values(cols).forEach((c) => {
          doc.text(c.t, c.x + 1, y + 5, { width: c.w - 2, align: "center" });
          doc
            .moveTo(c.x + c.w, y)
            .lineTo(c.x + c.w, y + hHeight)
            .stroke();
        });

        y += hHeight;

        // Items
        doc.font("Helvetica").fontSize(7);
        det.forEach((item: any) => {
          const p = item.prod;
          const imp = item.imposto || {};
          const icms00 = imp.ICMS?.ICMS00 || imp.ICMS?.ICMSSN102 || {};

          // Dynamic height based on desc
          const descHeight = doc.heightOfString(p.xProd, {
            width: cols.desc.w - 4,
          });
          const rowH = Math.max(12, descHeight + 4);

          // Check Page Break
          if (y + rowH > 750) {
            doc.addPage();
            y = margin + 20; // simplified header for next pages
            // redraw header? usually yes, but let's keep simple
          }

          // Vertical lines
          doc.rect(margin, y, contentWidth, rowH).stroke(); // outer box

          const txt = (val: string, col: any, align: string = "center") => {
            doc.text(val, col.x + 1, y + 4, {
              width: col.w - 2,
              align: align as any,
            });
            doc
              .moveTo(col.x + col.w, y)
              .lineTo(col.x + col.w, y + rowH)
              .stroke(); // vertical separator
          };

          txt(p.cProd, cols.cod);
          txt(p.xProd, cols.desc, "left");
          txt(p.NCM, cols.ncm);
          txt(icms00.CST || icms00.CSOSN || "", cols.cst);
          txt(p.CFOP, cols.cfop);
          txt(p.uCom, cols.un);
          txt(p.qCom, cols.qtd, "right");
          txt(p.vUnCom, cols.vunit, "right");
          txt(p.vProd, cols.vtot, "right");
          txt(icms00.vBC || "0,00", cols.bcicms, "right");
          txt(icms00.vICMS || "0,00", cols.vicms, "right");
          txt("0,00", cols.vipi, "right");
          txt(icms00.pICMS || "0,00", cols.aliqicms, "right");

          y += rowH;
        });

        y += 30;

        // --- 6. Dados Adicionais ---
        drawSectionTitle("DADOS ADICIONAIS", y);
        y += 8;

        const infoCompH = 60;
        const defaultInfCpl =
          "NAO INCIDENCIA DO ICMS, CONFORME ARTIGO 7, INCISO IX E XIV - DECRETO 45.490/00. NAO INCIDENCIA DO IPI NOS TERMOS DO ARTIGO 37, INCISO II, DECRETO N 5.544/02. Documento emitido por ME ou EPP optante do Simples Nacional.";

        drawBox(
          margin,
          y,
          380,
          infoCompH,
          "INFORMAÇÕES COMPLEMENTARES",
          infAdic?.infCpl || defaultInfCpl,
          "left",
          7,
        );
        drawBox(
          margin + 380,
          y,
          contentWidth - 380,
          infoCompH,
          "RESERVADO AO FISCO",
        );

        y += infoCompH;

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
