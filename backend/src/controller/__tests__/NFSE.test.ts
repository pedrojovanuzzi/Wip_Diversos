import path from "path";
import AppDataSource from "../../database/DataSource";
import { Jobs } from "../../entities/Jobs";
import { NFSE } from "../../entities/NFSE";
import { FiorilliProvider } from "../../services/nfse/FiorilliProvider";
import NFSEController from "../NFSE";

describe("NFSE Controller", async () => {
  const certPath = path.resolve(__dirname, "../../files/certificado.pfx");
  const TEMP_DIR = path.resolve(__dirname, "../../files");

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

  it("Deve dar erro ao gerar NFSE", () => {
    const fiorili = new FiorilliProvider(certPath, TEMP_DIR, "");

    // const response = fiorili.sendSoapRequest();
  });
});
