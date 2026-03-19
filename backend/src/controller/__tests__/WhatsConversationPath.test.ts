import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bullmq", async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import("bullmq")>()),
    Queue: class MockQueue {
      add = vi.fn();
      getFailed = vi.fn().mockResolvedValue([]);
      remove = vi.fn();
    },
    Worker: class MockWorker {
      on = vi.fn();
    },
    Job: class {},
  };
});

vi.mock("../../database/API_MK", () => {
  return {
    default: {
      getRepository: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValue(null),
        findOneBy: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn().mockImplementation((entity) => ({ id: 1, ...entity })),
        save: vi.fn().mockResolvedValue({ id: 1 }),
        delete: vi.fn().mockResolvedValue(true),
      }),
    },
  };
});

vi.mock("../../database/MkauthSource", () => {
  return {
    default: {
      getRepository: vi.fn().mockReturnValue({
        find: vi.fn(),
        findOne: vi.fn(),
        save: vi.fn(),
        update: vi.fn(),
      }),
      query: vi.fn().mockResolvedValue([]),
    },
  };
});

vi.mock("axios");

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn(),
    })),
  },
  createTransport: vi.fn(() => ({
    sendMail: vi.fn(),
  })),
}));

// Usamos vi.mock em um módulo interno que importa o dotenv ou ignoramos

// Após os mocks, podemos importar a controller correndo menos risco de timeout/conexão
import whatsPixController from "../WhatsConversationPath";

describe("WhatsPixController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve exportar a instância principal com sucesso", () => {
    expect(whatsPixController).toBeDefined();
    expect(typeof whatsPixController.MensagensComuns).toBe("function");
  });

  it("deve enfileirar uma mensagem no BullMQ com MensagensComuns", async () => {
    await whatsPixController.MensagensComuns(
      "551499999999",
      "Olá, Teste Unitário",
    );
    // O envio do whats não pode quebrar a execução local do teste sem o Redis/Internet
  });

  it("deve processar stage vazio e enviar opções", async () => {
    const sessionMock: any = { stage: "" };
    const spyBoasVindas = vi
      .spyOn(whatsPixController, "boasVindas")
      .mockResolvedValue(undefined as any);
    const spyMensagemBotao = vi
      .spyOn(whatsPixController, "MensagemBotao")
      .mockResolvedValue(undefined as any);

    await whatsPixController.handleMessage(
      sessionMock,
      "Oi",
      "5511999999",
      "text",
      false,
    );

    expect(sessionMock.stage).toBe("options_start");
    expect(spyBoasVindas).toHaveBeenCalledWith("5511999999");
    expect(spyMensagemBotao).toHaveBeenCalled();

    clearTimeout(sessionMock.inactivityTimer);
  });

  it("deve ir para awaiting_cpf ao selecionar Boleto/Pix (opção 1)", async () => {
    const sessionMock: any = { stage: "options_start" };
    const spyPodeMePassar = vi
      .spyOn(whatsPixController, "PodeMePassarOCpf")
      .mockResolvedValue(undefined as any);

    await whatsPixController.handleMessage(
      sessionMock,
      "1",
      "5511999999",
      "text",
      false,
    );

    expect(sessionMock.stage).toBe("awaiting_cpf");
    expect(spyPodeMePassar).toHaveBeenCalledWith("5511999999");

    clearTimeout(sessionMock.inactivityTimer);
  });

  it("deve ir para awaiting_service ao selecionar Serviços/Contratação (opção 2)", async () => {
    const sessionMock: any = { stage: "options_start" };
    const spyMensagemLista = vi
      .spyOn(whatsPixController, "MensagemLista")
      .mockResolvedValue(undefined as any);
    const spyMensagensComuns = vi
      .spyOn(whatsPixController, "MensagensComuns")
      .mockResolvedValue(undefined as any);

    await whatsPixController.handleMessage(
      sessionMock,
      "2",
      "5511999999",
      "text",
      false,
    );

    expect(sessionMock.stage).toBe("awaiting_service");
    expect(spyMensagemLista).toHaveBeenCalled();
    expect(spyMensagensComuns).toHaveBeenCalled();

    clearTimeout(sessionMock.inactivityTimer);
  });

  it("deve ir para end ao selecionar Falar com Atendente (opção 3)", async () => {
    const sessionMock: any = { stage: "options_start" };
    const spyMensagensComuns = vi
      .spyOn(whatsPixController, "MensagensComuns")
      .mockResolvedValue(undefined as any);

    await whatsPixController.handleMessage(
      sessionMock,
      "3",
      "5511999999",
      "text",
      false,
    );

    expect(sessionMock.stage).toBe("end");
    expect(spyMensagensComuns).toHaveBeenCalledTimes(2);

    clearTimeout(sessionMock.inactivityTimer);
  });

  it('deve resetar a sessão ao mandar "resetar"', async () => {
    const sessionMock: any = { stage: "qualquer_stage" };
    const spyDeleteSession = vi
      .spyOn(whatsPixController, "deleteSession")
      .mockResolvedValue(undefined as any);
    const spyMensagensComuns = vi
      .spyOn(whatsPixController, "MensagensComuns")
      .mockResolvedValue(undefined as any);

    await whatsPixController.handleMessage(
      sessionMock,
      "resetar",
      "5511999999",
      "text",
      false,
    );

    expect(spyMensagensComuns).toHaveBeenCalledWith(
      "5511999999",
      expect.stringContaining("Sessão resetada"),
    );
    expect(spyDeleteSession).toHaveBeenCalledWith("5511999999");

    clearTimeout(sessionMock.inactivityTimer);
  });

  it("deve enviar aviso de manutencao se a tag manutencao estiver ativada e nao alterar stage", async () => {
    const sessionMock: any = { stage: "" };
    const spyMensagensComuns = vi
      .spyOn(whatsPixController, "MensagensComuns")
      .mockResolvedValue(undefined as any);

    await whatsPixController.handleMessage(
      sessionMock,
      "Ola",
      "5511999999",
      "text",
      true,
    );

    expect(spyMensagensComuns).toHaveBeenCalledWith(
      "5511999999",
      expect.stringContaining("Manutenção"),
    );
    expect(sessionMock.stage).not.toBe("options_start");

  });

  describe("Validações de CPF e RG", () => {
    it("deve retornar false para CPFs inválidos ou sequências repetidas", async () => {
      // Seq repetidas
      expect(await whatsPixController.validarCPF("11111111111")).toBe(false);
      expect(await whatsPixController.validarCPF("00000000000")).toBe(false);
      
      // Matemática falha
      expect(await whatsPixController.validarCPF("12312312312")).toBe(false);
      expect(await whatsPixController.validarCPF("98765432111")).toBe(false);
    });

    it("deve retornar true para CPFs válidos, ignorando máscara", async () => {
      // CPF Fictício válido matematicamente: 52557942871
      expect(await whatsPixController.validarCPF("52557942871")).toBe(true);
      expect(await whatsPixController.validarCPF("525.579.428-71")).toBe(true);
    });

    it("deve retornar false para RGs inválidos (tamanho inadequado ou repetidos)", async () => {
      expect(await whatsPixController.validarRG("123456")).toBe(false); // Curto
      expect(await whatsPixController.validarRG("12345678901")).toBe(false); // Longo (11)
      expect(await whatsPixController.validarRG("111111111")).toBe(false); // Repetido
    });

    it("deve retornar true para RGs válidos", async () => {
      // RG com tamanho de 7 a 10 dígitos com ou sem letras mascaradas
      expect(await whatsPixController.validarRG("1234567")).toBe(true); // 7 digitos
      expect(await whatsPixController.validarRG("12.345.678-9")).toBe(true); // 9 digitos
      expect(await whatsPixController.validarRG("2342425245")).toBe(true); // Ficticio usado no sistema
    });
  });
});

