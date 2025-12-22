import { Mock } from "vitest";
import Pix from "../Pix";
import { link } from "fs";

const pixController = new Pix();

// vi.mock("../../entities/ClientesEntities.ts", async () => {
//   const originals = await vi.importActual("../../entities/ClientesEntities.ts");

//   return {
//     ...originals,
//     findOne: vi.fn(() => {
//       desconto: 2.0;
//     }),
//   };
// });

describe("Pix Controller", () => {
  const dataHora = new Date();

  it("Deve gerar e aplicar desconto na mensalidade", async () => {
    const pixController = new Pix();

    const controllerAny = pixController as any;

    const called = vi
      .spyOn(controllerAny.clienteRepo, "findOne")
      .mockResolvedValue({
        login: "pedro",
        desconto: 2.0,
      });

    const response = await pixController.aplicarJuros_Desconto(
      50,
      "pedro",
      "2025-12-22"
    );

    expect(called).toHaveBeenCalled();
    expect(response).toBe(48.96);
  });

  it("Aplicar desconto", async () => {
    const pixController = new Pix();

    const controllerAny = pixController as any;

    const called = vi
      .spyOn(controllerAny.clienteRepo, "findOne")
      .mockResolvedValue({
        login: "pedro",
        desconto: 2.0,
      });

    const response = await pixController.aplicar_Desconto(35, "pedro");

    expect(called).toHaveBeenCalled();
    expect(response).toBe(33);
  });

  it("Deve gerar até 3 mensalidades para o cliente", async () => {
    const pixController = new Pix();

    const controllerPixAny = pixController as any;

    const calledOne = vi
      .spyOn(controllerPixAny.recordRepo, "find")
      .mockResolvedValue([
        {
          id: 12345,
          datavenc: dataHora,
          login: "PEDRO",
          valor: 50.0,
        },
        {
          id: 54321,
          datavenc: dataHora,
          login: "PEDRO",
          valor: 10.0,
        },
      ]);

    const calledTwo = vi
      .spyOn(controllerPixAny.clienteRepo, "findOne")
      .mockResolvedValue({
        cli_ativado: "s",
      });

    const req = {
      body: {
        pppoe: "pedro",
        cpf: process.env.OLHO_NO_IMPOSTO_CNPJ,
      },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn(),
    } as any;

    const response = await pixController.gerarPixAll(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        link: expect.stringContaining("https://pix.sejaefi.com.br/"),
        mensalidades: [
          {
            dataVenc: dataHora,
            id: 12345,
            valor: 50,
          },
          {
            dataVenc: dataHora,
            id: 54321,
            valor: 10,
          },
        ],
        pppoe: "pedro",
        valor: "60.00",
      })
    );
  });

  it("Deve gerar uma mensalidade para cada cadastro", async () => {
    const pixController = new Pix();

    const controllerPixAny = pixController as any;

    vi.spyOn(controllerPixAny.recordRepo, "find").mockResolvedValue([
      {
        id: 12345,
        datavenc: dataHora,
        login: "PEDRO",
        valor: 50.0,
      },
      {
        id: 54321,
        datavenc: dataHora,
        login: "JOSE",
        valor: 80.0,
      },
    ]);

    const req = {
      body: {
        nome_completo: "pedro",
        cpf: process.env.OLHO_NO_IMPOSTO_CNPJ,
        titulos: ["1", "2", "3"],
      },
    } as any;

    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    const response = await pixController.gerarPixVariasContas(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        link: expect.stringContaining("https://pix.sejaefi.com.br"),
        nome_completo: "PEDRO",
        titulos: [
          {
            dataVenc: dataHora,
            id: 12345,
            valor: 50,
          },
          {
            dataVenc: dataHora,
            id: 54321,
            valor: 80.0,
          },
        ],
        valor: "130.00",
      })
    );
  });
});
