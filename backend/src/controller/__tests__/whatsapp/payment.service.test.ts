import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRepo = vi.hoisted(() => ({
  findOne: vi.fn(),
  save: vi.fn(),
}));

vi.mock("../../../database/MkauthSource", () => ({
  default: {
    getRepository: vi.fn().mockReturnValue(mockRepo),
  },
}));

vi.mock("moment-timezone", () => {
  const fn: any = () => ({ format: () => "03/2026" });
  fn.default = fn;
  return { default: fn };
});

vi.mock("uuid", () => ({
  v4: () => "aaaabbbbccccdddd1234567890abcdef",
}));

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    add = vi.fn().mockResolvedValue({});
  },
}));

vi.mock("../../whatsapp/config", () => ({
  url: "https://graph.facebook.com/v22.0/test/messages",
  urlMedia: "https://graph.facebook.com/v22.0/test/media",
  token: "test-token",
  redisOptions: { host: "localhost", port: 6379 },
  efiPayOptions: {},
  chave_pix: "test-pix-key",
}));

vi.mock("../../whatsapp/utils/logging", () => ({
  writeLog: vi.fn(),
}));

vi.mock("../../whatsapp/services/messaging.service", () => ({
  MensagensComuns: vi.fn().mockResolvedValue(undefined),
  MensagensDeMidia: vi.fn().mockResolvedValue(undefined),
}));

import { gerarLancamentoServico } from "../../whatsapp/services/payment.service";

describe("payment.service - gerarLancamentoServico", () => {
  beforeEach(() => {
    mockRepo.findOne.mockReset();
    mockRepo.save.mockReset();
    delete process.env.SERVIDOR_HOMOLOGACAO;
  });

  it("retorna undefined para tipoServico desconhecido", async () => {
    const result = await gerarLancamentoServico({ login: "user1" }, "servico_invalido");
    expect(result).toBeUndefined();
    expect(mockRepo.findOne).not.toHaveBeenCalled();
  });

  it("retorna undefined se cliente não for encontrado por login nem CPF", async () => {
    mockRepo.findOne.mockResolvedValue(null);
    const result = await gerarLancamentoServico(
      { login: "user1", cpf: "12345678901" },
      "instalacao",
    );
    expect(result).toBeUndefined();
  });

  it("cria lançamento de instalação com valor 350 em produção", async () => {
    mockRepo.findOne.mockResolvedValue({ login: "user1", nome: "João" });
    mockRepo.save.mockResolvedValue({ id: 99, login: "user1", valor: "350.00" });

    const result = await gerarLancamentoServico({ login: "user1" }, "instalacao");

    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        login: "user1",
        tipo: "servicos",
        valor: "350.00",
        status: "aberto",
        obs: expect.stringContaining("Instalação"),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 99 }));
  });

  it("cria lançamento de mudança de endereço com valor 200 em produção", async () => {
    mockRepo.findOne.mockResolvedValue({ login: "user2", nome: "Maria" });
    mockRepo.save.mockResolvedValue({ id: 50 });

    await gerarLancamentoServico({ login: "user2" }, "mudanca_endereco");

    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        valor: "200.00",
        obs: expect.stringContaining("Mudança de Endereço"),
      }),
    );
  });

  it("usa valor 1 em homologação para qualquer tipo de serviço", async () => {
    process.env.SERVIDOR_HOMOLOGACAO = "true";
    mockRepo.findOne.mockResolvedValue({ login: "user1", nome: "João" });
    mockRepo.save.mockResolvedValue({ id: 1 });

    await gerarLancamentoServico({ login: "user1" }, "mudanca_endereco");

    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ valor: "1.00" }),
    );
  });

  it("prioriza busca por login e não tenta CPF se login for encontrado", async () => {
    mockRepo.findOne.mockResolvedValue({ login: "user1", nome: "João" });
    mockRepo.save.mockResolvedValue({ id: 1 });

    await gerarLancamentoServico({ login: "user1", cpf: "12345678901" }, "instalacao");

    expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
    expect(mockRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { login: "user1", cli_ativado: "s" } }),
    );
  });

  it("tenta CPF se login não encontrar cliente", async () => {
    mockRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ login: "user_cpf", nome: "Maria" });
    mockRepo.save.mockResolvedValue({ id: 2 });

    const result = await gerarLancamentoServico(
      { login: "inexistente", cpf: "12345678901" },
      "instalacao",
    );

    expect(mockRepo.findOne).toHaveBeenCalledTimes(2);
    expect(mockRepo.findOne).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ cpf_cnpj: "12345678901" }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 2 }));
  });

  it("retorna null em caso de erro interno", async () => {
    mockRepo.findOne.mockRejectedValue(new Error("DB offline"));
    const result = await gerarLancamentoServico({ login: "user1" }, "instalacao");
    expect(result).toBeNull();
  });
});
