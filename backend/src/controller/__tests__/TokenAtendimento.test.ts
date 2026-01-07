import { ClientesEntities } from "../../entities/ClientesEntities";
import TokenAtendimento from "../TokenAtendimento";

describe("TokenAtendimento", () => {
  it("Deve gerar um pix de pagamento sem juros", async () => {
    const cliente = {
      id: 1,
      login: "PEDROGAMERBRTEST",
      cpf: "01450042872", // CPF DE TEST
      telefone: "12345678901",
      email: "test@example.com",
    };

    const tokenAtendimento = new TokenAtendimento();

    (tokenAtendimento as any).recordRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: 1,
        login: "Teste",
        valor: 100.0,
        datavenc: new Date(),
      }),
    };

    const req = {
      body: {
        login: cliente.login,
        cpf: cliente.cpf,
        perdoarJuros: false,
      },
    } as any;

    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    const pixResponse = await tokenAtendimento.gerarPixToken(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ link: expect.any(String) })
    );
  });

  it("Deve gerar um pix de pagamento com juros", async () => {
    const cliente = {
      id: 1,
      login: "PEDROGAMERBRTEST",
      cpf: "01450042872", // CPF DE TEST
      telefone: "12345678901",
      email: "test@example.com",
    };

    const tokenAtendimento = new TokenAtendimento();

    (tokenAtendimento as any).recordRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: 1,
        login: "Teste",
        valor: 100.0,
        datavenc: new Date(),
      }),
    };

    const req = {
      body: {
        login: cliente.login,
        cpf: cliente.cpf,
        perdoarJuros: false,
      },
    } as any;

    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    const pixResponse = await tokenAtendimento.gerarPixToken(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ link: expect.any(String) })
    );
  });

  it("Deve logar e buscar os cadastros", async () => {
    const tokenAtendimento = new TokenAtendimento();

    const req = {
      body: {
        cpf: "01450042872", // CPF DE TEST
      },
    } as any;

    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    const response = await tokenAtendimento.login(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          login: expect.stringContaining("PEDROGAMERBRTEST"),
        }),
      ])
    );
  });

  it("Deve escolher qual dos cadastros vai pegar o boleto", async () => {
    const tokenAtendimento = new TokenAtendimento();

    const req = {
      body: {
        login: "PEDROGAMERBRTEST",
      },
    } as any;

    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    const response = await tokenAtendimento.chooseHome(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        login: expect.stringContaining("PEDROGAMERBRTEST"),
      })
    );
  });
});
