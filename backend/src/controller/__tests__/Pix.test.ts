import { Mock } from "vitest";
import Pix from "../Pix";

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
});
