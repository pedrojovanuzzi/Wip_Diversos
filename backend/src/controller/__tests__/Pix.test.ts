import { ClientesEntities } from "../../entities/ClientesEntities";
import { Faturas } from "../../entities/Faturas";

const mockFaturasRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
};

const mockClientesRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
};

jest.mock("../../database/MkauthSource", () => {
  return {
    getRepository: jest.fn((entity) => {
      const name =
        entity.name ||
        (entity.constructor && entity.constructor.name) ||
        String(entity);
      console.log("MkauthSource.getRepository called for:", name);

      if (entity === Faturas || name === "Faturas")
        return mockFaturasRepository;
      if (entity === ClientesEntities || name === "ClientesEntities")
        return mockClientesRepository;

      throw new Error(
        `[MkauthSource] Unmocked entity requested: "${name}" (Type: ${typeof entity})`
      );
    }),
  };
});

describe("Pix Controller", () => {
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let pixController: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    const { Pix } = require("../Pix");
    pixController = new Pix();

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;
  });

  describe("gerarPix", () => {
    it("Tem que gerar o pix com os respectivos dados", async () => {
      const req = {
        body: {
          pppoe: "123456",
          cpf: 100,
          perdoarjuros: true,
        },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnValue({ json: jest.fn() }),
        json: jest.fn(),
      } as unknown as Response;

      await pixController.gerarPix(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith({
        message: "Pix gerado com sucesso",
      });
    });
  });
});
