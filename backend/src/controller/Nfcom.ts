import { create } from "xmlbuilder2";
import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import axios from "axios";
import * as https from "https";
import { processarCertificado } from "../utils/certUtils";

// Interfaces para tipagem dos dados da NFCom
export interface INFComData {
  /** Bloco de Identificação da NFCom (ide) */
  ide: {
    cUF: string;
    tpAmb: string;
    mod: "62"; // Modelo NFCom
    serie: string;
    nNF: string;
    cNF: string;
    cDV: string;
    dhEmi: string;
    tpEmis: string;
    nSiteAutoriz: string;
    cMunFG: string;
    finNFCom: string;
    tpFat: string;
    verProc: string;
  };

  /** Bloco do Emitente (emit) */
  emit: {
    CNPJ: string;
    IE: string;
    CRT: string;
    xNome: string;
    xFant: string;
    enderEmit: {
      xLgr: string;
      nro: string;
      xBairro: string;
      cMun: string;
      xMun: string;
      CEP: string;
      UF: string;
      fone?: string; // Opcional (presente no XML de exemplo)
      email?: string; // Opcional (presente no XML de exemplo)
    };
  };

  /** Bloco do Destinatário (dest) */
  dest: {
    xNome: string;
    CPF?: string;
    CNPJ?: string;
    indIEDest: string;
    enderDest: {
      xLgr: string;
      nro: string;
      xCpl?: string; // Complemento (Opcional, presente no XML de exemplo)
      xBairro: string;
      cMun: string;
      xMun: string;
      CEP: string;
      UF: string;
      fone?: string; // Opcional (presente no XML de exemplo)
      email?: string; // Opcional (presente no XML de exemplo)
    };
  };

  /** Bloco Assinante (assinante) */
  assinante: {
    iCodAssinante: string;
    tpAssinante: string;
    tpServUtil: string;
    NroTermPrinc?: string; // Opcional
    cUFPrinc?: string; // Opcional
    nContrato?: string; // Opcional (presente no XML de exemplo)
    dContratoIni?: string; // Opcional (presente no XML de exemplo)
    dContratoFim?: string; // Opcional (presente no XML de exemplo)
  };

  /** Array de Detalhes de Produtos/Serviços (det) */
  det: Array<{
    nItem: string;
    prod: {
      cProd: string;
      xProd: string;
      cClass: string;
      CFOP?: string; // Opcional (foi removido no XML simplificado)
      uMed: string;
      qFaturada: string;
      vItem: string;
      vDesc?: string; // Opcional (presente no XML de exemplo)
      vProd: string;
    };
    imposto: {
      /** Imposto normal (usado fora do Simples Nacional) */
      ICMS00?: {
        CST: string;
        vBC: string;
        pICMS: string;
        vICMS: string;
      };
      PIS?: {
        CST: string;
        vBC: string;
        pPIS: string;
        vPIS: string;
      };
      COFINS?: {
        CST: string;
        vBC: string;
        pCOFINS: string;
        vCOFINS: string;
      };
      /** Imposto simplificado (usado no Simples Nacional - CRT 1) */
      indSemCST?: "1"; // Opcional (presente no XML de exemplo)
    };
  }>;

  /** Bloco de Valores Totais (total) */
  total: {
    vProd: string;
    ICMSTot: {
      vBC: string;
      vICMS: string;
      vICMSDeson: string;
      vFCP: string;
    };
    vCOFINS: string;
    vPIS: string;
    vFUNTTEL: string;
    vFUST: string;
    vRetTribTot: {
      vRetPIS: string;
      vRetCofins: string;
      vRetCSLL: string;
      vIRRF: string;
    };
    vDesc: string;
    vOutro: string;
    vNF: string;
  };

  /** Bloco de Faturamento (gFat) */
  gFat: {
    CompetFat: string;
    dVencFat: string;
    codBarras: string;
    dPerUsoIni?: string; // Opcional (presente no XML de exemplo)
    dPerUsoFim?: string; // Opcional (presente no XML de exemplo)
    codDebAuto?: string; // Opcional (presente no XML de exemplo)
    codBanco?: string; // Opcional (presente no XML de exemplo)
    codAgencia?: string; // Opcional (presente no XML de exemplo)
  };

  /** Bloco de Responsável Técnico (gRespTec) */
  gRespTec?: {
    // Opcional (presente no XML de exemplo)
    CNPJ: string;
    xContato: string;
    email: string;
    fone: string;
  };

  /** Bloco Suplementar (infNFComSupl) */
  infNFComSupl: {
    qrCodNFCom: string;
  };
}

class Nfcom {
  public gerarNfcom(req: Request, res: Response): string {
    const data: INFComData = req.body;
    const xml = this.gerarXml(data);
    return xml;
  }

  public gerarNfcomWit(data: INFComData): string {
    const xml = this.gerarXml(data);
    return xml;
  }

  public async enviarNfcom(xml: string): Promise<any> {
    try {
      const certPath = path.join(__dirname, "..", "files", "certificado.pfx");
      const password = process.env.FACILITA_PASS || "";

      if (!fs.existsSync(certPath)) {
        throw new Error(`Certificado não encontrado em: ${certPath}`);
      }

      // Define o diretório temporário para o certificado processado
      const tempDir = path.join(__dirname, "..", "temp");

      // Processa o certificado usando a utilidade
      const processedCertPath = processarCertificado(
        certPath,
        password,
        tempDir
      );

      // Lê o certificado processado
      const pfxBuffer = fs.readFileSync(processedCertPath);

      const httpsAgent = new https.Agent({
        pfx: pfxBuffer,
        passphrase: password,
        rejectUnauthorized: false,
      });

      const response = await axios.post(
        "https://nfcom.svrs.rs.gov.br/WS/NFComRecepcao/NFComRecepcao.asmx?wsdl",
        xml,
        {
          httpsAgent,
          headers: {
            "Content-Type":
              'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfcom/wsdl/NFComRecepcao/nfcomRecepcao"',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Erro ao enviar NFCom:", error);
      throw error;
    }
  }

  /**
   * Gera o XML da NFCom (Modelo 62) com base nos dados fornecidos e assina digitalmente.
   * @param data Dados da NFCom tipados conforme interface INFComData
   * @returns String contendo o XML assinado
   */
  public gerarXml(data: INFComData): string {
    // Extrai o ano e mês da emissão para a chave de acesso (YYMM)
    // Supondo dhEmi no formato ISO: YYYY-MM-DDThh:mm:ss...
    const anoMes =
      data.ide.dhEmi.substring(2, 4) + data.ide.dhEmi.substring(5, 7);

    // Monta a chave de acesso
    const chaveAcesso = `${data.ide.cUF}${anoMes}${data.emit.CNPJ.padStart(
      14,
      "0"
    )}62${data.ide.serie.padStart(3, "0")}${data.ide.nNF.padStart(9, "0")}${
      data.ide.tpEmis
    }${data.ide.cNF.padStart(8, "0")}`;

    // O ID deve ser "NFCom" + chave de acesso
    const id = `NFCom${chaveAcesso}`;

    // Cria o documento XML
    const doc = create({ version: "1.0", encoding: "UTF-8" });

    const soapEnvelope = doc.ele("soap:Envelope", {
      "xmlns:soap": "http://www.w3.org/2003/05/soap-envelope",
    });

    const soapBody = soapEnvelope.ele("soap:Body");

    const nfcomProc = soapBody.ele("nfcomProc", {
      xmlns: "http://www.portalfiscal.inf.br/nfcom",
      versao: "1.00",
    });

    // Elemento raiz NFCom
    const nfCom = nfcomProc.ele("NFCom", {
      xmlns: "http://www.portalfiscal.inf.br/nfcom",
      // versao: "1.00", // Removido da raiz
    });

    // Elemento infNFCom (filho de NFCom)
    const infNFCom = nfCom.ele("infNFCom", {
      versao: "1.00", // Adicionado em infNFCom
      Id: id,
    });

    // Grupo de Identificação da NFCom
    const ide = infNFCom.ele("ide");
    ide.ele("cUF").txt(data.ide.cUF);
    ide.ele("tpAmb").txt(data.ide.tpAmb);
    ide.ele("mod").txt(data.ide.mod);
    ide.ele("serie").txt(data.ide.serie);
    ide.ele("nNF").txt(data.ide.nNF);
    ide.ele("cNF").txt(data.ide.cNF);
    ide.ele("cDV").txt(data.ide.cDV);
    ide.ele("dhEmi").txt(data.ide.dhEmi);
    ide.ele("tpEmis").txt(data.ide.tpEmis);
    ide.ele("nSiteAutoriz").txt(data.ide.nSiteAutoriz);
    ide.ele("cMunFG").txt(data.ide.cMunFG);
    ide.ele("finNFCom").txt(data.ide.finNFCom);
    ide.ele("tpFat").txt(data.ide.tpFat);
    ide.ele("verProc").txt(data.ide.verProc);

    // Grupo de Emitente
    const emit = infNFCom.ele("emit");
    emit.ele("CNPJ").txt(data.emit.CNPJ);
    emit.ele("IE").txt(data.emit.IE);
    emit.ele("CRT").txt(data.emit.CRT);
    emit.ele("xNome").txt(data.emit.xNome);
    emit.ele("xFant").txt(data.emit.xFant);
    const enderEmit = emit.ele("enderEmit");
    enderEmit.ele("xLgr").txt(data.emit.enderEmit.xLgr);
    enderEmit.ele("nro").txt(data.emit.enderEmit.nro);
    enderEmit.ele("xBairro").txt(data.emit.enderEmit.xBairro);
    enderEmit.ele("cMun").txt(data.emit.enderEmit.cMun);
    enderEmit.ele("xMun").txt(data.emit.enderEmit.xMun);
    enderEmit.ele("CEP").txt(data.emit.enderEmit.CEP);
    enderEmit.ele("UF").txt(data.emit.enderEmit.UF);

    // Grupo de Destinatário
    const dest = infNFCom.ele("dest");
    dest.ele("xNome").txt(data.dest.xNome);
    if (data.dest.CPF) dest.ele("CPF").txt(data.dest.CPF);
    if (data.dest.CNPJ) dest.ele("CNPJ").txt(data.dest.CNPJ);
    dest.ele("indIEDest").txt(data.dest.indIEDest);
    const enderDest = dest.ele("enderDest");
    enderDest.ele("xLgr").txt(data.dest.enderDest.xLgr);
    enderDest.ele("nro").txt(data.dest.enderDest.nro);
    enderDest.ele("xBairro").txt(data.dest.enderDest.xBairro);
    enderDest.ele("cMun").txt(data.dest.enderDest.cMun);
    enderDest.ele("xMun").txt(data.dest.enderDest.xMun);
    enderDest.ele("CEP").txt(data.dest.enderDest.CEP);
    enderDest.ele("UF").txt(data.dest.enderDest.UF);

    // Grupo de Assinante
    const assinante = infNFCom.ele("assinante");
    assinante.ele("iCodAssinante").txt(data.assinante.iCodAssinante);
    assinante.ele("tpAssinante").txt(data.assinante.tpAssinante);
    assinante.ele("tpServUtil").txt(data.assinante.tpServUtil);
    if (data.assinante.NroTermPrinc) {
      assinante.ele("NroTermPrinc").txt(data.assinante.NroTermPrinc);
    }
    if (data.assinante.cUFPrinc) {
      assinante.ele("cUFPrinc").txt(data.assinante.cUFPrinc);
    }

    // Itens (Detalhes)
    data.det.forEach((item) => {
      const det = infNFCom.ele("det", { nItem: item.nItem });

      const prod = det.ele("prod");
      prod.ele("cProd").txt(item.prod.cProd);
      prod.ele("xProd").txt(item.prod.xProd);
      prod.ele("cClass").txt(item.prod.cClass);
      if (item.prod.CFOP) {
        prod.ele("CFOP").txt(item.prod.CFOP);
      }
      prod.ele("uMed").txt(item.prod.uMed);
      prod.ele("qFaturada").txt(item.prod.qFaturada);
      prod.ele("vItem").txt(item.prod.vItem);
      prod.ele("vProd").txt(item.prod.vProd);

      const imposto = det.ele("imposto");

      if (item.imposto.ICMS00) {
        const icms = imposto.ele("ICMS00");
        icms.ele("CST").txt(item.imposto.ICMS00.CST);
        icms.ele("vBC").txt(item.imposto.ICMS00.vBC);
        icms.ele("pICMS").txt(item.imposto.ICMS00.pICMS);
        icms.ele("vICMS").txt(item.imposto.ICMS00.vICMS);
      }

      if (item.imposto.PIS) {
        const pis = imposto.ele("PIS");
        pis.ele("CST").txt(item.imposto.PIS.CST);
        pis.ele("vBC").txt(item.imposto.PIS.vBC);
        pis.ele("pPIS").txt(item.imposto.PIS.pPIS);
        pis.ele("vPIS").txt(item.imposto.PIS.vPIS);
      }

      if (item.imposto.COFINS) {
        const cofins = imposto.ele("COFINS");
        cofins.ele("CST").txt(item.imposto.COFINS.CST);
        cofins.ele("vBC").txt(item.imposto.COFINS.vBC);
        cofins.ele("pCOFINS").txt(item.imposto.COFINS.pCOFINS);
        cofins.ele("vCOFINS").txt(item.imposto.COFINS.vCOFINS);
      }
    });

    // Totais
    const total = infNFCom.ele("total");
    total.ele("vProd").txt(data.total.vProd);

    const icmsTot = total.ele("ICMSTot");
    icmsTot.ele("vBC").txt(data.total.ICMSTot.vBC);
    icmsTot.ele("vICMS").txt(data.total.ICMSTot.vICMS);
    icmsTot.ele("vICMSDeson").txt(data.total.ICMSTot.vICMSDeson);
    icmsTot.ele("vFCP").txt(data.total.ICMSTot.vFCP);

    total.ele("vCOFINS").txt(data.total.vCOFINS);
    total.ele("vPIS").txt(data.total.vPIS);
    total.ele("vFUNTTEL").txt(data.total.vFUNTTEL);
    total.ele("vFUST").txt(data.total.vFUST);

    const vRetTribTot = total.ele("vRetTribTot");
    vRetTribTot.ele("vRetPIS").txt(data.total.vRetTribTot.vRetPIS);
    vRetTribTot.ele("vRetCofins").txt(data.total.vRetTribTot.vRetCofins);
    vRetTribTot.ele("vRetCSLL").txt(data.total.vRetTribTot.vRetCSLL);
    vRetTribTot.ele("vIRRF").txt(data.total.vRetTribTot.vIRRF);

    total.ele("vDesc").txt(data.total.vDesc);
    total.ele("vOutro").txt(data.total.vOutro);
    total.ele("vNF").txt(data.total.vNF);

    // Grupo de Fatura
    const gFat = infNFCom.ele("gFat");
    gFat.ele("CompetFat").txt(data.gFat.CompetFat);
    gFat.ele("dVencFat").txt(data.gFat.dVencFat);
    gFat.ele("codBarras").txt(data.gFat.codBarras);

    // Informações Suplementares (QR Code)
    const infNFComSupl = nfCom.ele("infNFComSupl");
    infNFComSupl.ele("qrCodNFCom").txt(data.infNFComSupl.qrCodNFCom);

    // Gera o XML sem assinatura
    const xmlSemAssinatura = doc.end({ prettyPrint: false });

    // Assina o XML
    try {
      return this.assinarXml(xmlSemAssinatura);
    } catch (error) {
      console.error("Erro ao assinar XML:", error);
      return xmlSemAssinatura;
    }
  }

  private assinarXml(xml: string): string {
    const certPath = path.join(__dirname, "..", "files", "certificado.pfx");
    const password = process.env.CANCELAR_NFSE_SENHA || "";

    if (!fs.existsSync(certPath)) {
      throw new Error(`Certificado não encontrado em: ${certPath}`);
    }

    const pfxBuffer = fs.readFileSync(certPath);
    const pfxAsn1 = forge.asn1.fromDer(
      forge.util.createBuffer(pfxBuffer.toString("binary"))
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
        "Não foi possível extrair certificado ou chave privada do PFX."
      );
    }

    const certPem = forge.pki.certificateToPem(certBags[0]!.cert!);
    const keyPem = forge.pki.privateKeyToPem(keyBags[0]!.key!);

    const signer = new SignedXml();
    signer.privateKey = keyPem;
    signer.publicCert = certPem;

    // Alterado para C14N Inclusivo (padrão NFe)
    signer.canonicalizationAlgorithm =
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    signer.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";

    signer.addReference({
      xpath: "//*[local-name(.)='infNFCom']",
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/TR/2001/REC-xml-c14n-20010315", // Alterado para C14N Inclusivo
      ],
      digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    });

    signer.computeSignature(xml, {
      location: {
        reference: "//*[local-name(.)='infNFComSupl']",
        action: "after",
      },
    });

    return signer.getSignedXml();
  }
}

export default Nfcom;
