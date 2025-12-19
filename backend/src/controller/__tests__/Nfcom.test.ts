import Nfcom from "../Nfcom";
import { Request, Response } from "express";

jest.mock("../../database/MkauthSource", () => ({
  initialize: jest.fn(),
  getRepository: jest.fn().mockReturnValue({
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockResolvedValue({ id: 1 }),
    findOne: jest.fn().mockResolvedValue({
      id: 1,
      login: "cliente_teste",
      nome: "Fulano",
      cpf_cnpj: "12345678900",
      desconto: 0,
      valor: "100.00",
    }),
    find: jest.fn().mockResolvedValue([{ id: 1, nNF: "100" }]),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  }),
  manager: {},
}));

jest.mock("../../database/DataSource", () => ({
  initialize: jest.fn(),
  getRepository: jest.fn().mockReturnValue({
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockResolvedValue({ id: 1 }),
    findOne: jest.fn().mockResolvedValue({
      id: 1,
      login: "cliente_teste",
      nome: "Fulano",
      cpf_cnpj: "12345678900",
      desconto: 0,
      valor: "100.00",
    }),
    find: jest.fn().mockResolvedValue([{ id: 1, nNF: "100" }]),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  }),
  manager: {},
}));

jest.mock("axios");
jest.mock("fs", () => {
  const originalFs = jest.requireActual("fs");
  return {
    ...originalFs,
    existsSync: jest.fn((pathArg) => {
      if (typeof pathArg === "string" && pathArg.includes("certificado.pfx"))
        return true;
      return originalFs.existsSync(pathArg);
    }),
    readFileSync: jest.fn((pathArg, options) => {
      if (
        typeof pathArg === "string" &&
        (pathArg.includes("certificado.pfx") || pathArg === "dummy_path")
      ) {
        return Buffer.from("DUMMY_CERT_CONTENT");
      }
      return originalFs.readFileSync(pathArg, options);
    }),
  };
});
jest.mock("../../utils/certUtils", () => ({
  processarCertificado: jest.fn().mockReturnValue("dummy_path"),
}));

describe("Nfcom Controller", () => {
  let nfcom: Nfcom;

  // Silenciar logs durante testes
  //   beforeAll(() => {
  //     jest.spyOn(console, "log").mockImplementation(() => {});
  //     jest.spyOn(console, "error").mockImplementation(() => {});
  //   });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    nfcom = new Nfcom(); // Cria uma nova instância para cada teste
    jest.clearAllMocks();
  });

  test("gerarNfcom deve executar com sucesso", async () => {
    const request = {
      body: {
        password: "123",
        clientesSelecionados: [1],
        reducao: 40,
        ambiente: "homologacao",
        lastNfcomId: 122,
      },
    } as Partial<Request>;

    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    const response = {
      json: jsonMock,
      status: statusMock,
    } as unknown as Response;

    // Spy on the private method using 'as any' to avoid TS2341
    const processarFilaBackgroundSpy = jest
      .spyOn(nfcom as any, "processarFilaBackground")
      .mockImplementation(() => Promise.resolve());

    await nfcom.gerarNfcom(request as Request, response);

    // Verificamos se respondeu com status 200 (sucesso)
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/Sendo Geradas/i),
      })
    );

    // Verify background processing was triggered
    expect(processarFilaBackgroundSpy).toHaveBeenCalled();
  });

  test("cancelarNfcom deve executar com sucesso", async () => {
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    const job: any = { id: 1, processados: 0, total: 1 };
    const jobRepository = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue({ id: 1 }),
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
      find: jest.fn().mockResolvedValue([{ id: 1 }]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const NFComRepository = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue({ id: 1 }),
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
      find: jest.fn().mockResolvedValue([{ id: 1 }]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    // Spy on assinarXmlCancelamento to avoid PKCS#12 error
    jest
      .spyOn(nfcom as any, "assinarXmlCancelamento")
      .mockReturnValue("<xml>Assinado</xml>");

    // Mock Axios response for the SOAP call
    const axios = require("axios");
    axios.post.mockResolvedValue({
      data: `
        <soap:Body>
            <nfeResultMsg>
                <retConsReciNFe>
                    <cStat>135</cStat>
                    <xMotivo>Evento registrado e vinculado a NF-e</xMotivo>
                </retConsReciNFe>
            </nfeResultMsg>
        </soap:Body>
      `,
    });

    const result = await (nfcom as any).cancelarNoBackground(
      "1",
      "cliente_teste",
      "1",
      "123",
      NFComRepository,
      jobRepository,
      job
    );

    expect(jobRepository.save).toHaveBeenCalled();
    expect(NFComRepository.save).toHaveBeenCalled();
    expect(job.status).toBe("processando"); // Based on current implementation for cStat 135
  });

  test("processarFilaBackground deve processar itens com sucesso", async () => {
    // 1. Setup Mock Data
    const mockItem = {
      nfComData: {
        ide: { nNF: "", serie: "", cDV: "", dhEmi: "2023-01-01" },
        emit: { CNPJ: "123" },
        dest: {},
        total: { vNF: "100" },
        gFat: {},
        assinante: { iCodAssinante: "10" },
      },
      clientLogin: "login_test",
      faturaId: 123,
      clientType: "Fisica",
      cpf_cnpj: "11122233344",
    };

    const dadosFinaisNFCom = [mockItem];
    const job = { id: 1, processados: 0, total: 1 };
    const password = "123";
    const responses: any[] = [];

    // 2. Mock Internal Private Methods
    // We cast to 'any' to spy on private methods
    const calcularDVSpy = jest
      .spyOn(nfcom as any, "calcularDV")
      .mockReturnValue("9");
    const gerarXmlSpy = jest.spyOn(nfcom as any, "gerarXml").mockResolvedValue({
      soapEnvelope: "<soap>...</soap>",
      xmlAssinado: "<xml>...</xml>",
    });
    // Mocking response with cStat 100 (Success) and a valid protocol
    const mockSoapResponse = `
      <soap:Body>
        <nfeResultMsg>
          <retConsReciNFe>
            <cStat>100</cStat>
            <xMotivo>Autorizado</xMotivo>
            <protNFCom>
              <nProt>123456789</nProt>
            </protNFCom>
          </retConsReciNFe>
        </nfeResultMsg>
      </soap:Body>
    `;
    const enviarNfcomSpy = jest
      .spyOn(nfcom as any, "enviarNfcom")
      .mockResolvedValue(mockSoapResponse);
    const inserirDadosBancoSpy = jest
      .spyOn(nfcom as any, "inserirDadosBanco")
      .mockResolvedValue(undefined);

    // 3. Call the Private Method Directly
    await (nfcom as any).processarFilaBackground(
      dadosFinaisNFCom,
      job,
      password,
      responses
    );

    // 4. Verification

    // Should verify next number was assigned
    expect(mockItem.nfComData.ide.nNF).not.toBe("");

    // Should have called the mocks
    expect(calcularDVSpy).toHaveBeenCalled();
    expect(gerarXmlSpy).toHaveBeenCalled();
    expect(enviarNfcomSpy).toHaveBeenCalled();
    expect(inserirDadosBancoSpy).toHaveBeenCalled();

    // Should have updated job status in database (mocked globally)
    // Accessing the mocked repository from existing mocks
    // We need to import DataSource to check mocking if we want strict check,
    // but we can trust the flow if 'enviarNfcom' was called
    // or checks 'responses' array
    console.log(responses);

    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({
      success: true,
      message: "NFCom autorizada com sucesso",
    });
  });

  test("gerarXML", async () => {
    const xml = await nfcom.gerarXml(
      {
        ide: {
          cUF: "35",
          tpAmb: "1",
          mod: "62",
          serie: "1",
          nNF: "1",
          cNF: "1",
          cDV: "1",
          dhEmi: "2023-01-01",
          tpEmis: "1",
          nSiteAutoriz: "0",
          cMunFG: "3503406",
          finNFCom: "0",
          tpFat: "0",
          verProc: "1",
        },
        emit: {
          CNPJ: "123",
          IE: "123",
          CRT: "1",
          xNome: "WIP TELECOM MULTIMIDIA EIRELI ME",
          xFant: "WIP TELECOM MULTIMIDIA EIRELI ME",
          enderEmit: {
            xLgr: "Rua Emilio Carraro N 945",
            nro: "945",
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
          xNome: "WIP TELECOM MULTIMIDIA EIRELI ME",
          CPF: "123",
          CNPJ: "123",
          indIEDest: "1",
          IE: "123",
          enderDest: {
            xLgr: "Rua Emilio Carraro N 945",
            nro: "945",
            xBairro: "Altos da Cidade",
            cMun: "3503406",
            xMun: "Arealva",
            CEP: "17160380",
            UF: "SP",
            fone: "1432961608",
            email: "wiptelecom@wiptelecom.net.br",
          },
        },
        assinante: {
          iCodAssinante: "123",
          tpAssinante: "1",
          tpServUtil: "1",
          NroTermPrinc: "123",
          cUFPrinc: "123",
          nContrato: "123",
          dContratoIni: "123",
          dContratoFim: "123",
        },
        det: [],
        total: {
          vProd: "123",
          ICMSTot: {
            vBC: "123",
            vICMS: "123",
            vICMSDeson: "123",
            vFCP: "123",
          },
          vCOFINS: "123",
          vPIS: "123",
          vFUNTTEL: "123",
          vFUST: "123",
          vRetTribTot: {
            vRetPIS: "123",
            vRetCofins: "123",
            vRetCSLL: "123",
            vIRRF: "123",
          },
          vDesc: "123",
          vOutro: "123",
          vNF: "123",
        },
        gFat: {
          CompetFat: "123",
          dVencFat: "123",
          codBarras: "123",
          dPerUsoIni: "123",
          dPerUsoFim: "123",
          codDebAuto: "123",
          codBanco: "123",
          codAgencia: "123",
        },
        gRespTec: {
          CNPJ: "123",
          xContato: "123",
          email: "123",
          fone: "123",
        },
        infNFComSupl: {
          qrCodNFCom: "123",
        },
      },
      "123"
    );
    expect(xml.xmlAssinado).toContain("<NFCom"); // Sem fechar > pois tem namespaces
    expect(xml.xmlAssinado).toContain("<infNFCom");
    expect(xml.xmlAssinado).toContain("<ide>");
    expect(xml.xmlAssinado).toContain("<emit>");
    expect(xml.xmlAssinado).toContain("<dest>");
    expect(xml.xmlAssinado).toContain("<assinante>");
    expect(xml.xmlAssinado).toContain("<total>");
    expect(xml.xmlAssinado).toContain("<gFat>");
    expect(xml.xmlAssinado).toContain("<infNFComSupl>");

    // --- Grupo IDE (Identificação) ---
    expect(xml.xmlAssinado).toContain("<cUF>");
    expect(xml.xmlAssinado).toContain("<tpAmb>");
    expect(xml.xmlAssinado).toContain("<mod>");
    expect(xml.xmlAssinado).toContain("<serie>");
    expect(xml.xmlAssinado).toContain("<nNF>");
    expect(xml.xmlAssinado).toContain("<cNF>");
    expect(xml.xmlAssinado).toContain("<cDV>");
    expect(xml.xmlAssinado).toContain("<dhEmi>");
    expect(xml.xmlAssinado).toContain("<tpEmis>");
    expect(xml.xmlAssinado).toContain("<nSiteAutoriz>");
    expect(xml.xmlAssinado).toContain("<cMunFG>");
    expect(xml.xmlAssinado).toContain("<finNFCom>");
    expect(xml.xmlAssinado).toContain("<tpFat>");
    expect(xml.xmlAssinado).toContain("<verProc>");

    // --- Grupo EMIT (Emitente) ---
    expect(xml.xmlAssinado).toContain("<CNPJ>");
    expect(xml.xmlAssinado).toContain("<IE>");
    expect(xml.xmlAssinado).toContain("<CRT>");
    expect(xml.xmlAssinado).toContain("<xNome>");
    expect(xml.xmlAssinado).toContain("<xFant>");
    expect(xml.xmlAssinado).toContain("<enderEmit>");

    // --- Grupo DEST (Destinatário) ---
    // Nota: Seu XML de exemplo tem tanto CPF quanto CNPJ no dest
    expect(xml.xmlAssinado).toMatch(/<CNPJ>|<CPF>/);
    expect(xml.xmlAssinado).toContain("<indIEDest>");
    expect(xml.xmlAssinado).toContain("<enderDest>");

    // --- Endereço (Comum a Emit e Dest) ---
    expect(xml.xmlAssinado).toContain("<xLgr>");
    expect(xml.xmlAssinado).toContain("<nro>");
    expect(xml.xmlAssinado).toContain("<xBairro>");
    expect(xml.xmlAssinado).toContain("<cMun>");
    expect(xml.xmlAssinado).toContain("<xMun>");
    expect(xml.xmlAssinado).toContain("<CEP>");
    expect(xml.xmlAssinado).toContain("<UF>");

    // --- Grupo ASSINANTE ---
    expect(xml.xmlAssinado).toContain("<iCodAssinante>");
    expect(xml.xmlAssinado).toContain("<tpAssinante>");
    expect(xml.xmlAssinado).toContain("<tpServUtil>");
    expect(xml.xmlAssinado).toContain("<NroTermPrinc>");
    expect(xml.xmlAssinado).toContain("<cUFPrinc>");
    expect(xml.xmlAssinado).toContain("<nContrato>");
    expect(xml.xmlAssinado).toContain("<dContratoIni>");
    expect(xml.xmlAssinado).toContain("<dContratoFim>");

    // --- Grupo TOTAL (Valores) ---
    expect(xml.xmlAssinado).toContain("<vProd>");
    expect(xml.xmlAssinado).toContain("<ICMSTot>");
    expect(xml.xmlAssinado).toContain("<vBC>");
    expect(xml.xmlAssinado).toContain("<vICMS>");
    expect(xml.xmlAssinado).toContain("<vICMSDeson>");
    expect(xml.xmlAssinado).toContain("<vFCP>");
    expect(xml.xmlAssinado).toContain("<vCOFINS>");
    expect(xml.xmlAssinado).toContain("<vPIS>");
    expect(xml.xmlAssinado).toContain("<vFUNTTEL>");
    expect(xml.xmlAssinado).toContain("<vFUST>");
    expect(xml.xmlAssinado).toContain("<vRetTribTot>");
    expect(xml.xmlAssinado).toContain("<vRetPIS>");
    expect(xml.xmlAssinado).toContain("<vRetCofins>");
    expect(xml.xmlAssinado).toContain("<vRetCSLL>");
    expect(xml.xmlAssinado).toContain("<vIRRF>");
    expect(xml.xmlAssinado).toContain("<vDesc>");
    expect(xml.xmlAssinado).toContain("<vOutro>");
    expect(xml.xmlAssinado).toContain("<vNF>");

    // --- Grupo FATURA ---
    expect(xml.xmlAssinado).toContain("<CompetFat>");
    expect(xml.xmlAssinado).toContain("<dVencFat>");
    expect(xml.xmlAssinado).toContain("<codBarras>");

    // --- Suplementar ---
    expect(xml.xmlAssinado).toContain("<qrCodNFCom>");
    expect(xml.soapEnvelope).toBeDefined();
    expect(xml.soapEnvelope).toContain("nfcomDadosMsg");
  });

  test("criarXMLCancelamento deve criar um XML de cancelamento com sucesso", () => {
    const xml = (nfcom as any).criarXMLCancelamento(
      "123",
      "123",
      "123",
      "123",
      1
    );
    expect(xml).toBeDefined();
    expect(xml).toContain("<eventoNFCom");
    expect(xml).toContain("<infEvento");
    expect(xml).toContain("<cOrgao>");
    expect(xml).toContain("<chNFCom>");
    expect(xml).toMatch(/<CNPJ>|<CPF>/);
    expect(xml).toContain("<tpAmb>");
    expect(xml).toContain("<dhEvento>");
    expect(xml).toContain("<tpEvento>");
    expect(xml).toContain("<nSeqEvento>");
    expect(xml).toContain("<detEvento");
    expect(xml).toContain("<evCancNFCom>");
    expect(xml).toContain("<descEvento>");
    expect(xml).toContain("<nProt>");
    expect(xml).toContain("<xJust>");
  });
});
