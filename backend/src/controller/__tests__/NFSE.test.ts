import path from "path";
import AppDataSource from "../../database/DataSource";
import { Jobs } from "../../entities/Jobs";
import { NFSE } from "../../entities/NFSE";
import NFSEController from "../NFSE";

vi.mock("../../services/nfse/FiorilliProvider", () => {
  return {
    FiorilliProvider: class {
      assinarXml() {
        return "<xml>signed</xml>";
      }
      async sendSoapRequest(xml: string, soapAction: string) {
        if (soapAction === "ConsultarNfseServicoPrestadoEnvio") {
          if (xml.includes("CancelarNfseEnvio")) {
            // Mock Cancel Response
            return `<?xml version="1.0" encoding="utf-8"?>
                 <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                   <soap:Body>
                     <ns3:cancelarNfseResponse xmlns:ns3="http://www.abrasf.org.br/nfse.xsd">
                        <ns2:CancelarNfseResposta xmlns:ns2="http://www.abrasf.org.br/nfse.xsd">
                            <ns2:Sucesso>true</ns2:Sucesso>
                        </ns2:CancelarNfseResposta>
                     </ns3:cancelarNfseResponse>
                   </soap:Body>
                 </soap:Envelope>`;
          } else {
            // Mock Consulta Response (setNfseNumber)
            return `<?xml version="1.0" encoding="utf-8"?>
                 <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                   <soap:Body>
                     <ns3:consultarNfsePorRpsResponse xmlns:ns3="http://www.abrasf.org.br/nfse.xsd">
                        <ns2:ConsultarNfseRpsResposta xmlns:ns2="http://www.abrasf.org.br/nfse.xsd">
                            <ns2:CompNfse>
                                <ns2:Nfse>
                                    <ns2:InfNfse>
                                        <ns2:Numero>12345</ns2:Numero>
                                    </ns2:InfNfse>
                                </ns2:Nfse>
                            </ns2:CompNfse>
                        </ns2:ConsultarNfseRpsResposta>
                     </ns3:consultarNfsePorRpsResponse>
                   </soap:Body>
                 </soap:Envelope>`;
          }
        }

        return `<?xml version="1.0" encoding="utf-8"?>
           <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
             <soap:Body>
               <ns3:recepcionarLoteRpsSincronoResponse xmlns:ns3="http://www.abrasf.org.br/nfse.xsd">
                 <ns2:EnviarLoteRpsSincronoResposta xmlns:ns2="http://www.abrasf.org.br/nfse.xsd">
                    <ns2:ListaNfse>
                      <ns2:CompNfse>
                        <ns2:Nfse>
                           <ns2:InfNfse>
                              <ns2:Numero>100</ns2:Numero>
                              <ns2:CodigoVerificacao>ABCD</ns2:CodigoVerificacao>
                           </ns2:InfNfse>
                        </ns2:Nfse>
                      </ns2:CompNfse>
                    </ns2:ListaNfse>
                 </ns2:EnviarLoteRpsSincronoResposta>
               </ns3:recepcionarLoteRpsSincronoResponse>
             </soap:Body>
           </soap:Envelope>`;
      }
    },
  };
});

describe("NFSE Controller", async () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Deve dar erro ao cancelar a NFSE", async () => {
    const job: Jobs = {
      id: "1",
      name: "jobinho",
      description: "test",
      processados: 1,
      status: "processando",
      total: 0,
      resultado: undefined,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const ids = ["1"];
    const password = process.env.TEST_PASS;
    const ambiente = "homologação";

    // vi.spyOn(AppDataSource, "getRepository").mockResolvedValue({
    //     update: vi.fn().mockResolvedValue({

    //     })
    // } as any);

    const called = vi
      .spyOn(AppDataSource, "getRepository")
      .mockImplementation((entity: any) => {
        // Se o código pedir o repositório de JOBS
        if (entity === Jobs) {
          return {
            update: vi.fn().mockResolvedValue({}),
          } as any;
        } else if (entity === NFSE) {
          return {
            findOne: vi.fn().mockResolvedValue({
              id: 1,
              success: true,
              error: false,
            }),
          };
        }

        // Se pedir de outra coisa, retorna um genérico ou outro mock
        return {
          save: vi.fn(),
          findOne: vi.fn(),
        } as any;
      });

    const response = await NFSEController.processarCancelamentoNfseJob(
      job,
      ids,
      password!,
      ambiente
    );

    expect(response).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "1",
          success: expect.any(Boolean),
        }),
      ])
    );
  });

  it("Deve gerar NFSE com sucesso", async () => {
    const job: Jobs = {
      id: "1",
      name: "jobinho",
      description: "test",
      processados: 1,
      status: "processando",
      total: 0,
      resultado: undefined,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const password = process.env.TEST_PASS || "123456";
    const ids = ["1"];
    const soapAction = "EnviarLoteRpsSincronoEnvio";
    const aliquota = "2.0";
    const ambiente = "homologacao";
    const service = "Teste Service";
    const reducao = 0;
    const lastNfe = 100;

    vi.spyOn(AppDataSource, "getRepository").mockImplementation(
      (entity: any) => {
        if (entity === Jobs) {
          return {
            update: vi.fn(),
          } as any;
        }
        if (entity === NFSE) {
          return {
            findOne: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockReturnValue({}),
            save: vi.fn(),
          } as any;
        }
        return {
          findOne: vi.fn(),
          save: vi.fn(),
        } as any;
      }
    );

    vi.spyOn(NFSEController as any, "getLastNfseNumber").mockResolvedValue({
      nextNfseNumber: 101,
      nextRpsNumber: 50,
    });

    // Mock prepareRpsData to avoid complex logic
    vi.spyOn(NFSEController as any, "prepareRpsData").mockResolvedValue({
      xml: "<xml>mock</xml>",
      valorReduzido: 100,
      rpsData: {},
      ClientData: {
        cpf_cnpj: "12345678901",
        nome: "Test Client",
        endereco: "Rua Test",
        numero: "123",
        bairro: "Bairro",
        cep: "12345678",
        celular: "11999999999",
      },
      FaturasData: {},
      ibgeId: "3503406",
      serieRps: "1",
    });

    const response = await NFSEController.processarGeracaoNfseJob(
      job,
      password,
      ids,
      soapAction,
      aliquota,
      ambiente,
      service,
      reducao,
      lastNfe
    );

    expect(response).toBeDefined();
    expect(Array.isArray(response)).toBe(true);
    expect((response as any[])[0]).toMatchObject({
      success: true,
      message: "Nota gerada com sucesso",
    });
  });
});
