import { Request, Response } from "express";
import { NFSEController } from "../NFSE"; // Ajuste o import conforme a exportação da classe no arquivo original
import { NFSE } from "../../entities/NFSE";
import { Jobs } from "../../entities/Jobs";
import { Faturas } from "../../entities/Faturas";
import { ClientesEntities } from "../../entities/ClientesEntities";

// --- Mocks das dependências externas ---

// Mock do TypeORM DataSource
const mockJobRepository = {
  create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 1 })),
  save: jest.fn().mockResolvedValue({ id: 1 }),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  findOne: jest.fn(),
};

const mockNFSERepository = {
  create: jest.fn().mockImplementation((dto) => dto || {}),
  save: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  find: jest.fn(),
};

jest.mock("../../database/DataSource", () => ({
  getRepository: jest.fn((entity) => {
    console.log("DataSource.getRepository called for:", entity.name || entity);
    if (entity.name === "Jobs") return mockJobRepository;
    if (entity.name === "NFSE") return mockNFSERepository;
    return {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };
  }),
}));

// Mock do MkauthSource (banco legado)
const mockFaturasRepository = {
  findOne: jest.fn().mockResolvedValue({
    id: 1,
    valor: "100.00",
    uuid_lanc: "uuid-123",
    login: "cliente_teste",
  }),
};

const mockClientesRepository = {
  findOne: jest.fn().mockResolvedValue({
    id: 1,
    login: "cliente_teste",
    nome: "Cliente Teste",
    cpf_cnpj: "12345678900",
    cidade: "3503406", // Código IBGE de exemplo
    endereco: "Rua Exemplo",
    numero: "123",
    bairro: "Centro",
    cep: "17000000",
    celular: "14999999999",
    email: "teste@email.com",
    desconto: 0,
  }),
};

jest.mock("../../database/MkauthSource", () => ({
  getRepository: jest.fn((entity) => {
    const name =
      entity.name ||
      (entity.constructor && entity.constructor.name) ||
      String(entity);
    console.log("MkauthSource.getRepository called for:", name);

    if (entity === Faturas || name === "Faturas") return mockFaturasRepository;
    if (entity === ClientesEntities || name === "ClientesEntities")
      return mockClientesRepository;

    throw new Error(
      `[MkauthSource] Unmocked entity requested: "${name}" (Type: ${typeof entity})`
    );
    return {
      findOne: jest.fn(),
    };
  }),
}));

// Mock do Axios
jest.mock("axios", () => ({
  get: jest.fn().mockResolvedValue({ data: { id: "3503406" } }),
  post: jest.fn(),
}));

// Mock do FS
jest.mock("fs", () => {
  const originalFs = jest.requireActual("fs");
  return {
    ...originalFs,
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    appendFileSync: jest.fn(),
    unlinkSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue(Buffer.from("DUMMY_CERT")),
  };
});

// Mock da XmlFactory e FiorilliProvider
// Como são classes instanciadas dentro da controller, precisamos mockar o módulo ou o construtor.
// O código original usa: import { NfseXmlFactory } from "../services/nfse/NfseXmlFactory";
// e import { FiorilliProvider } from "../services/nfse/FiorilliProvider";

const mockXmlFactoryInstance = {
  createLoteXml: jest.fn().mockReturnValue("<Lote>XML</Lote>"),
  createRpsXml: jest.fn().mockReturnValue("<Rps>XML</Rps>"),
  createEnviarLoteSoap: jest.fn().mockReturnValue("<Soap>XML</Soap>"),
  createPedidoCancelamentoXml: jest
    .fn()
    .mockReturnValue("<PedidoCanc>XML</PedidoCanc>"),
  createConsultaNfseSoap: jest
    .fn()
    .mockReturnValue("<ConsultaSoap>XML</ConsultaSoap>"),
  createConsultaNfseRpsEnvio: jest
    .fn()
    .mockReturnValue("<ConsultaEnvio>XML</ConsultaEnvio>"),
};

const mockFiorilliProviderInstance = {
  assinarXml: jest.fn().mockReturnValue("<RpsAssinado>XML</RpsAssinado>"),
  sendSoapRequest: jest.fn().mockResolvedValue(`
    <soap:Envelope>
      <soap:Body>
        <ns3:recepcionarLoteRpsSincronoResponse>
          <ns2:EnviarLoteRpsSincronoResposta>
            <ns2:ListaNfse>
               <ns2:CompNfse>Sucesso</ns2:CompNfse>
            </ns2:ListaNfse>
          </ns2:EnviarLoteRpsSincronoResposta>
        </ns3:recepcionarLoteRpsSincronoResponse>
      </soap:Body>
    </soap:Envelope>
  `),
};

jest.mock("../../services/nfse/NfseXmlFactory", () => {
  return {
    NfseXmlFactory: jest.fn().mockImplementation(() => mockXmlFactoryInstance),
  };
});

jest.mock("../../services/nfse/FiorilliProvider", () => {
  return {
    FiorilliProvider: jest
      .fn()
      .mockImplementation(() => mockFiorilliProviderInstance),
  };
});

describe("NFSE Controller", () => {
  let nfseController: any; // Usando any para facilitar acesso a métodos privados e spyOn
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    const { NFSEController } = require("../NFSE");
    nfseController = new NFSEController();

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;
  });

  describe("iniciar", () => {
    it("deve criar um job e iniciar o processamento em background", async () => {
      req = {
        body: {
          password: "123",
          clientesSelecionados: ["1"],
          aliquota: "5",
          service: "Teste",
          reducao: "0",
          ambiente: "homologacao",
          lastNfe: "100",
        },
      };

      // Spy no método processarGeracaoNfseJob para não executar lógica real dele neste teste unitário de 'iniciar'
      // Queremos apenas garantir que ele foi chamado.
      const processarJobSpy = jest
        .spyOn(nfseController, "processarGeracaoNfseJob")
        .mockImplementation(() => Promise.resolve());

      await nfseController.iniciar(req as Request, res as Response);

      expect(mockJobRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pendente",
          total: 1,
        })
      );
      expect(mockJobRepository.save).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Notas Sendo Geradas em Segundo Plano!",
        })
      );
      expect(processarJobSpy).toHaveBeenCalled();
    });
  });

  describe("processarGeracaoNfseJob", () => {
    it("deve processar o job, gerar XMLs e enviar SOAP", async () => {
      // Mock do getLastNfseNumber (privado/auxiliar)
      // Como não vi a implementação completa dele no view_file, vou assumir que ele retorna os números
      // Ou mockar se for método da classe
      nfseController.getLastNfseNumber = jest.fn().mockResolvedValue({
        nextNfseNumber: 101,
        nextRpsNumber: 50,
      });

      const job = { id: 1, status: "processando" } as unknown as Jobs;
      const ids = ["1"];
      const password = "123";

      await nfseController.processarGeracaoNfseJob(
        job,
        password,
        ids,
        "Action",
        "5.00",
        "homologacao",
        "Servico",
        0,
        100
      );

      // Verificações
      expect(nfseController.getLastNfseNumber).toHaveBeenCalled();
      expect(mockJobRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: "processando" })
      );

      // 1. Deve ter buscado dados do banco legado (via prepareRpsData -> mockRepositories)
      expect(mockFaturasRepository.findOne).toHaveBeenCalled();
      expect(mockClientesRepository.findOne).toHaveBeenCalled();

      // 2. Deve ter criado XML do RPS
      expect(mockXmlFactoryInstance.createRpsXml).toHaveBeenCalled();

      // 3. Deve ter assinado o XML
      expect(mockFiorilliProviderInstance.assinarXml).toHaveBeenCalledWith(
        "<Rps>XML</Rps>",
        "InfDeclaracaoPrestacaoServico",
        "123"
      );

      // 4. Deve ter criado o Lote
      expect(mockXmlFactoryInstance.createLoteXml).toHaveBeenCalled();

      // 5. Deve ter enviado o SOAP
      expect(mockFiorilliProviderInstance.sendSoapRequest).toHaveBeenCalled();

      // 6. Deve ter salvo as notas (sucesso mockado no SOAP response)
      expect(mockNFSERepository.save).toHaveBeenCalled();

      // 7. Deve ter atualizado o job ao final
      expect(mockJobRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: "concluido" })
      );
    });
  });

  describe("imprimirNFSE", () => {
    it("deve buscar detalhes da NFSE se encontrar no banco", async () => {
      req = {
        body: {
          id: [1],
          ambiente: "homologacao",
        },
      };

      // Mock findOne do NFSE no repositorio
      mockNFSERepository.findOne.mockResolvedValueOnce({
        id: 1,
        numeroRps: 50,
        serieRps: "S1",
        tipoRps: 1,
      });

      // Spy no BuscarNSFEDetalhes
      const buscarDetalhesSpy = jest
        .spyOn(nfseController, "BuscarNSFEDetalhes")
        .mockResolvedValue({ xml: "detalhes" });

      await nfseController.imprimirNFSE(req as Request, res as Response);

      expect(mockNFSERepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, ambiente: "homologacao" },
      });
      expect(buscarDetalhesSpy).toHaveBeenCalledWith(
        50,
        "S1",
        1,
        "homologacao"
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([{ xml: "detalhes" }]);
    });
  });

  describe("cancelarNfse", () => {
    it("deve criar job de cancelamento", async () => {
      req = {
        body: {
          id: [1],
          password: "123",
          ambiente: "homologacao",
        },
      };

      const processarCancelamentoSpy = jest
        .spyOn(nfseController, "processarCancelamentoNfseJob")
        .mockImplementation(() => Promise.resolve());

      await nfseController.cancelarNfse(req as Request, res as Response);

      expect(mockJobRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Cancelar Notas NFSe" })
      );
      expect(processarCancelamentoSpy).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });
});
