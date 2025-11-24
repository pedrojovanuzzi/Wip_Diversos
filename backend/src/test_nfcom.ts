import dotenv from "dotenv";
import path from "path";
import Nfcom, { INFComData } from "./controller/Nfcom";

// Carrega variáveis de ambiente
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const nfcom = new Nfcom();

const mockData: INFComData = {
  ide: {
    cUF: "35",
    tpAmb: "2",
    mod: "62",
    serie: "1",
    nNF: "1",
    cNF: "9999999",
    cDV: "9",
    dhEmi: "2025-11-22T09:00:00-03:00",
    tpEmis: "1",
    nSiteAutoriz: "0",
    cMunFG: "3550308",
    finNFCom: "0",
    tpFat: "0",
    verProc: "1.00",
  },
  emit: {
    CNPJ: "00000000000000",
    IE: "111111111111",
    CRT: "3",
    xNome: "EMPRESA DE COMUNICAÇÃO S.A.",
    xFant: "NETCOM",
    enderEmit: {
      xLgr: "AV. DAS EMPRESAS",
      nro: "1000",
      xBairro: "CENTRO",
      cMun: "3550308",
      xMun: "SAO PAULO",
      CEP: "01000000",
      UF: "SP",
    },
  },
  dest: {
    xNome: "CLIENTE PESSOA FISICA",
    CPF: "11111111111",
    indIEDest: "9",
    enderDest: {
      xLgr: "RUA DA CASA",
      nro: "100",
      xBairro: "JARDIM",
      cMun: "3550308",
      xMun: "SAO PAULO",
      CEP: "01000001",
      UF: "SP",
    },
  },
  assinante: {
    iCodAssinante: "123456789",
    tpAssinante: "3",
    tpServUtil: "4",
    NroTermPrinc: "11999998888",
    cUFPrinc: "35",
  },
  det: [
    {
      nItem: "1",
      prod: {
        cProd: "SERVICO001",
        xProd: "Serviço de Acesso à Internet - Plano Básico",
        cClass: "0000001",
        CFOP: "5301",
        uMed: "4",
        qFaturada: "1.0000",
        vItem: "80.00",
        vProd: "80.00",
      },
      imposto: {
        ICMS00: {
          CST: "00",
          vBC: "80.00",
          pICMS: "18.00",
          vICMS: "14.40",
        },
        PIS: {
          CST: "01",
          vBC: "80.00",
          pPIS: "0.65",
          vPIS: "0.52",
        },
        COFINS: {
          CST: "01",
          vBC: "80.00",
          pCOFINS: "3.00",
          vCOFINS: "2.40",
        },
      },
    },
  ],
  total: {
    vProd: "80.00",
    ICMSTot: {
      vBC: "80.00",
      vICMS: "14.40",
      vICMSDeson: "0.00",
      vFCP: "0.00",
    },
    vCOFINS: "2.40",
    vPIS: "0.52",
    vFUNTTEL: "0.00",
    vFUST: "0.00",
    vRetTribTot: {
      vRetPIS: "0.00",
      vRetCofins: "0.00",
      vRetCSLL: "0.00",
      vIRRF: "0.00",
    },
    vDesc: "0.00",
    vOutro: "0.00",
    vNF: "80.00",
  },
  gFat: {
    CompetFat: "202511",
    dVencFat: "2025-12-05",
    codBarras: "999999999999999999999999999999999999999999999999",
  },
  infNFComSupl: {
    qrCodNFCom:
      "https://dfe-portal.svrs.rs.gov.br/NFCom/Consulta?chNFCom=35251100000000000000620010000000019999999999&tpAmb=2",
  },
};

try {
  const xml = nfcom.gerarNfcomWit(mockData);
  console.log("XML Gerado com Sucesso. Enviando...");
  console.log(xml);
  // nfcom
  //   .enviarNfcom(xml)
  //   .then((response) => {
  //     console.log("Resposta do Servidor:", response);
  //   })
  //   .catch((error) => {
  //     console.error(
  //       "Erro no envio:",
  //       error.response ? error.response.data : error.message
  //     );
  //   });
} catch (error) {
  console.error("Erro fatal:", error);
}
