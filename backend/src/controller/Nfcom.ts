import { create } from "xmlbuilder2";
import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import axios from "axios";
import * as https from "https";
import { gzipSync } from "zlib";
import { processarCertificado } from "../utils/certUtils";
import MkauthSource from "../database/MkauthSource";
import { ClientesEntities } from "../entities/ClientesEntities";
import { Faturas } from "../entities/Faturas";

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
      fone?: string;
      email?: string;
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
      xBairro: string;
      cMun: string;
      xMun: string;
      CEP: string;
      UF: string;
      fone?: string;
      email?: string;
    };
  };

  /** Bloco Assinante (assinante) */
  assinante: {
    iCodAssinante: string;
    tpAssinante: string;
    tpServUtil: string;
    NroTermPrinc?: string;
    cUFPrinc?: string;
    nContrato?: string;
    dContratoIni?: string;
    dContratoFim?: string;
  };

  /** Array de Detalhes de Produtos/Serviços (det) */
  det: Array<{
    nItem: string;
    prod: {
      cProd: string;
      xProd: string;
      cClass: string;
      CFOP?: string;
      uMed: string;
      qFaturada: string;
      vItem: string;
      vDesc?: string;
      vProd: string;
    };
    imposto: {
      indSemCST?: "1";
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
    dPerUsoIni?: string;
    dPerUsoFim?: string;
    codDebAuto?: string;
    codBanco?: string;
    codAgencia?: string;
  };

  /** Bloco de Responsável Técnico (gRespTec) */
  gRespTec?: {
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
  private homologacao: boolean = false;
  private WSDL_URL = "";

  public gerarNfcom = async (req: Request, res: Response): Promise<void> => {
    let { password, clientesSelecionados, service, reducao, ambiente } =
      req.body;

    if (ambiente === "homologacao") {
      this.homologacao = true;
      this.WSDL_URL =
        "https://nfcom-homologacao.svrs.rs.gov.br/WS/NFComRecepcao/NFComRecepcao.asmx";
    } else {
      this.homologacao = false;
      this.WSDL_URL =
        "https://nfcom.svrs.rs.gov.br/WS/NFComRecepcao/NFComRecepcao.asmx";
    }

    if (!reducao) reducao = 60;

    console.log(this.WSDL_URL);
    let reducaoStr = String(reducao);

    // 3. Agora você pode fazer a manipulação de string com segurança
    reducaoStr = reducaoStr.replace(",", ".").replace("%", "");

    reducao = Number(reducaoStr) / 100;

    // 1. Defina um array de Promises
    const promises = clientesSelecionados.map(async (item: any) => {
      // Repositórios não precisam ser criados a cada iteração, mas se for o padrão do seu ORM, mantenha.
      const ClientRepository = MkauthSource.getRepository(ClientesEntities);
      const FaturasRepository = MkauthSource.getRepository(Faturas);

      // Garante que o findOne seja feito por item.id (da requisição)
      const FaturasData = await FaturasRepository.findOne({
        where: { id: item.id },
      });

      // Verifica se a fatura foi encontrada antes de buscar o cliente
      if (!FaturasData || !FaturasData.login) {
        console.warn(`Fatura com ID ${item.id} não encontrada ou sem login.`);
        return null; // Retorna null para este item
      }

      const ClientData = await ClientRepository.findOne({
        where: { login: FaturasData.login },
      });

      // 2. O map deve retornar um objeto que você deseja usar
      // Se você deseja retornar os dados da NFCom, use a variável 'data'
      const data = {
        cliente: ClientData,
        fatura: FaturasData,
        // ... outros dados da NFCom
      };

      return data;
    });

    const resultados = await Promise.all(promises);

    // 4. Filtra resultados nulos (se algum item não foi encontrado)
    const dadosFinaisNFCom = resultados.filter((data) => data !== null);

    console.log(dadosFinaisNFCom);

    // const xml = this.gerarXml(data, password);
    // const response = await this.enviarNfcom(xml, password);
    // res.status(200).json(response);
    res.status(200).json({ message: "Nfcom gerada com sucesso" });
  };

  // public gerarNfcomWit(data: INFComData, password: string): string {
  //   const xml = this.gerarXml(data);
  //   return xml;
  // }

  public compactarXML(xmlString: string): string {
    let cleanXml = xmlString;

    // 1. Remove BOM (Byte Order Mark) se existir
    if (cleanXml.charCodeAt(0) === 0xfeff) {
      cleanXml = cleanXml.slice(1);
    }

    // 2. Remove declaração XML (<?xml...?>) se existir
    // A SEFAZ espera que o GZIP comece direto com a tag raiz
    cleanXml = cleanXml.replace(/^\s*<\?xml[^>]*\?>/i, "");

    // 3. ATENÇÃO: Removi o replace(/>\s+</g, "><") daqui.
    // A limpeza de espaços deve ser feita ANTES de assinar.
    // Se fizer depois, quebra o hash da assinatura (Erro 297).
    cleanXml = cleanXml.trim();

    // 4. Compactação
    const buffer = Buffer.from(cleanXml, "utf-8");
    const compressedBuffer = gzipSync(buffer);

    console.log(
      "Magic Bytes (GZIP Check - deve começar com 1f8b):",
      compressedBuffer.toString("hex").substring(0, 4)
    );

    return compressedBuffer.toString("base64");
  }

  public async enviarNfcom(xml: string, password: string): Promise<any> {
    try {
      const certPath = path.join(__dirname, "..", "files", "certificado.pfx");

      if (!fs.existsSync(certPath)) {
        throw new Error(`Certificado não encontrado em: ${certPath}`);
      }

      const tempDir = path.join(__dirname, "..", "temp");
      const processedCertPath = processarCertificado(
        certPath,
        password,
        tempDir
      );

      const pfxBuffer = fs.readFileSync(processedCertPath);

      const httpsAgent = new https.Agent({
        pfx: pfxBuffer,
        passphrase: password,
        rejectUnauthorized: false,
      });

      // URL sem ?wsdl para evitar erro 244/500
      const urlEnvio = this.WSDL_URL;

      console.log("Enviando para:", urlEnvio);

      const response = await axios.post(urlEnvio, xml, {
        httpsAgent,
        headers: {
          // Action minúscula conforme WSDL
          "Content-Type":
            'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfcom/wsdl/NFComRecepcao/nfcomRecepcao"',
        },
      });
      return response.data;
    } catch (error) {
      console.error("Erro ao enviar NFCom:", error);
      throw error;
    }
  }

  public gerarXml(data: INFComData, password: string): string {
    // 1. Gera Chave de Acesso
    const anoMes =
      data.ide.dhEmi.substring(2, 4) + data.ide.dhEmi.substring(5, 7);

    let chaveSemDV = `${data.ide.cUF}${anoMes}${data.emit.CNPJ.padStart(
      14,
      "0"
    )}62${data.ide.serie.padStart(3, "0")}${data.ide.nNF.padStart(9, "0")}${
      data.ide.tpEmis
    }${data.ide.nSiteAutoriz || "0"}${data.ide.cNF.padStart(7, "0")}`;

    const chaveAcessoCompleta = `${chaveSemDV}${data.ide.cDV}`;

    if (chaveAcessoCompleta.length !== 44) {
      throw new Error(
        `Chave de acesso gerada tem tamanho inválido: ${chaveAcessoCompleta.length} (esperado 44). Verifique cNF e nSiteAutoriz.`
      );
    }

    const id = `NFCom${chaveAcessoCompleta}`;

    // 2. Gera XML Interno
    const docInterno = create({ version: "1.0", encoding: "UTF-8" });

    // Namespace 'nfcom' minúsculo na tag raiz
    const nfCom = docInterno.ele("NFCom", {
      xmlns: "http://www.portalfiscal.inf.br/nfcom",
    });

    const infNFCom = nfCom.ele("infNFCom", {
      versao: "1.00",
      Id: id,
    });

    // --- Preenchimento dos dados ---
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
    if (data.assinante.nContrato) {
      assinante.ele("nContrato").txt(data.assinante.nContrato);
    }
    if (data.assinante.dContratoIni) {
      assinante.ele("dContratoIni").txt(data.assinante.dContratoIni);
    }
    if (data.assinante.dContratoFim) {
      assinante.ele("dContratoFim").txt(data.assinante.dContratoFim);
    }

    data.det.forEach((item) => {
      const det = infNFCom.ele("det", { nItem: item.nItem });
      const prod = det.ele("prod");
      prod.ele("cProd").txt(item.prod.cProd);
      prod.ele("xProd").txt(item.prod.xProd);
      prod.ele("cClass").txt(item.prod.cClass);
      if (item.prod.CFOP) prod.ele("CFOP").txt(item.prod.CFOP);
      prod.ele("uMed").txt(item.prod.uMed);
      prod.ele("qFaturada").txt(item.prod.qFaturada);
      prod.ele("vItem").txt(item.prod.vItem);
      prod.ele("vProd").txt(item.prod.vProd);
      const imposto = det.ele("imposto");
      imposto.ele("indSemCST").txt(item.imposto.indSemCST as string);
    });

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

    const gFat = infNFCom.ele("gFat");
    gFat.ele("CompetFat").txt(data.gFat.CompetFat);
    gFat.ele("dVencFat").txt(data.gFat.dVencFat);
    gFat.ele("codBarras").txt(data.gFat.codBarras);

    const infNFComSupl = nfCom.ele("infNFComSupl");
    // CDATA no QR Code
    infNFComSupl.ele("qrCodNFCom").dat(data.infNFComSupl.qrCodNFCom.trim());

    // 3. Serializa sem formatação (headless) para assinar
    // O 'headless: true' remove o <?xml ...?>
    const xmlInternoSemAssinatura = docInterno.end({
      prettyPrint: false,
      headless: true,
    });

    // 4. Assina (Passando o ID para o campo URI)
    let xmlInternoAssinado: string;
    try {
      xmlInternoAssinado = this.assinarXml(
        xmlInternoSemAssinatura,
        id,
        password
      );
    } catch (error) {
      console.error("Erro ao assinar XML:", error);
      xmlInternoAssinado = xmlInternoSemAssinatura;
    }

    // 5. Compacta GZIP
    const xmlComprimidoBase64 = this.compactarXML(xmlInternoAssinado);

    console.log(
      "Base64 gerado (inicio):",
      xmlComprimidoBase64.substring(0, 50)
    );

    // 6. Montagem MANUAL do Envelope SOAP (A alteração solicitada)
    // Isso garante que o namespace esteja correto e o Base64 não seja alterado
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <soap12:Body>
        <nfcomDadosMsg xmlns="http://www.portalfiscal.inf.br/nfcom/wsdl/NFComRecepcao">
            ${xmlComprimidoBase64}
        </nfcomDadosMsg>
    </soap12:Body>
</soap12:Envelope>`;

    return soapEnvelope;
  }

  private assinarXml(xml: string, idTag: string, password: string): string {
    const certPath = path.join(__dirname, "..", "files", "certificado.pfx");

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

    signer.canonicalizationAlgorithm =
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    signer.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";

    signer.addReference({
      xpath: "//*[local-name(.)='infNFCom']",
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      ],
      digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
      uri: "#" + idTag,
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
