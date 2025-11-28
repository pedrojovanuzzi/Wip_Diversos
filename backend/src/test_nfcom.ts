import dotenv from "dotenv";
import path from "path";
import Nfcom, { INFComData } from "./controller/Nfcom";

// Carrega variáveis de ambiente
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const nfcom = new Nfcom();

const mockData: INFComData = {
  ide: {
    cUF: "35", // UF de São Paulo
    tpAmb: "2", // 1=Produção
    mod: "62", // Modelo NFCom
    serie: "1", // Série da Nota
    nNF: "3", // Número da Nota
    cNF: "0229297", // Código Numérico
    cDV: "4", // Dígito Verificador
    dhEmi: "2025-11-10T03:15:31-03:00", // Data e hora de emissão (com fuso)
    tpEmis: "1", // Tipo de Emissão (Normal)
    nSiteAutoriz: "0", // Site de Autorização
    cMunFG: "3503406", // Município de Arealva/SP
    finNFCom: "0", // Finalidade Normal
    tpFat: "0", // Tipo de Faturamento (Normal)
    verProc: "1", // Versão do Processo de Emissão
  },
  emit: {
    CNPJ: "20843290000142",
    IE: "183013286115",
    CRT: "1", // Regime Tributário Simples Nacional
    xNome: "WIP TELECOM MULTIMIDIA EIRELI ME",
    xFant: "WIP TELECOM MULTIMIDIA EIRELI ME",
    enderEmit: {
      xLgr: "Rua Emilio Carraro N 945",
      nro: "999",
      xBairro: "Altos da Cidade",
      cMun: "3503406",
      xMun: "Arealva",
      CEP: "17160380",
      UF: "SP",
      fone: "1432961608",
      email: "wiptelecom@wiptelecom.net.br",
    },
  },
  dest: {
    xNome: "PEDRO ARTUR JOVANUZZI",
    CPF: "52557942871",
    indIEDest: "9", // 9=Não Contribuinte
    enderDest: {
      xLgr: "RUA EMILIO CARRARO",
      nro: "945",
      xBairro: "ALTOS DA CIDADE",
      cMun: "3503406",
      xMun: "Arealva",
      CEP: "17160380",
      UF: "SP",
      fone: "14982332963",
      email: "wiptelecom@wiptelecom.net.br",
    },
  },
  assinante: {
    iCodAssinante: "MKA4100",
    tpAssinante: "3", // 3=Pessoa Física
    tpServUtil: "1", // 1=Serviço de Telecomunicações
    nContrato: "4100",
    dContratoIni: "2025-11-01",
    dContratoFim: "2025-11-30",
  },
  det: [
    {
      nItem: "1",
      prod: {
        cProd: "003088289238",
        xProd: "TEST",
        cClass: "0100401", // Classificação
        uMed: "4", // Unidade de medida (Unidade)
        qFaturada: "1",
        vItem: "1.00",
        vDesc: "0.00",
        vProd: "1.00",
      },
      imposto: {
        indSemCST: "1", // Indica item sem informação de CST (usado pelo Simples Nacional)
      },
    },
  ],
  total: {
    vProd: "1.00",
    ICMSTot: {
      vBC: "0.00",
      vICMS: "0.00",
      vICMSDeson: "0.00",
      vFCP: "0.00",
    },
    vCOFINS: "0.00",
    vPIS: "0.00",
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
    vNF: "1.00",
  },
  gFat: {
    CompetFat: "202511",
    dVencFat: "2025-11-30",
    dPerUsoIni: "2025-11-01",
    dPerUsoFim: "2025-11-30",
    codBarras: "36491000000000001000000400006009100000075833",
    codDebAuto: "364202511",
    codBanco: "364",
    codAgencia: "010101",
  },
  gRespTec: {
    // Grupo de Responsável Técnico
    CNPJ: "04347310000138",
    xContato: "MKA MIKROTIK SISTEMAS PARA WEB",
    email: "nfcom@mk-auth.com.br",
    fone: "85981601233",
  },
  infNFComSupl: {
    qrCodNFCom:
      "https://dfe-portal.svrs.rs.gov.br/NFCom/QRCode?chNFCom=35251120843290000142620010000000031002292974&tpAmb=1",
  },
};

try {
  const xml = nfcom.gerarNfcomWit(mockData);
  console.log("XML Gerado com Sucesso. Enviando...");
  console.log(xml);
  nfcom
    .enviarNfcom(xml)
    .then((response) => {
      console.log("Resposta do Servidor:", response);
    })
    .catch((error) => {
      console.error("Erro no envio:");
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Headers:", error.response.headers);
        console.error("Data:", error.response.data);
      } else {
        console.error("Message:", error.message);
      }
    });
} catch (error) {
  console.error("Erro fatal:", error);
}
