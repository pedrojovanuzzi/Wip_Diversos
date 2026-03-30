import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQueueAdd = vi.hoisted(() => vi.fn());

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    add = mockQueueAdd;
  },
}));

vi.mock("../../whatsapp/config", () => ({
  url: "https://graph.facebook.com/v22.0/test/messages",
  token: "test-token",
  redisOptions: { host: "localhost", port: 6379 },
}));

vi.mock("../../../database/API_MK", () => ({
  default: {
    getRepository: vi.fn().mockReturnValue({
      save: vi.fn().mockResolvedValue({}),
    }),
  },
}));

vi.mock("../../whatsapp/services/session.service", () => ({
  conversation: { conv_id: null, sender_id: null, receiver_id: 1 },
  sessions: {},
  deleteSession: vi.fn(),
}));

import {
  MensagensComuns,
  enviarNotificacaoServico,
} from "../../whatsapp/services/messaging.service";

describe("messaging.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("MensagensComuns", () => {
    it("enfileira mensagem de texto com payload correto", async () => {
      mockQueueAdd.mockResolvedValue({});
      await MensagensComuns("5511999990001", "Olá, tudo bem?");

      expect(mockQueueAdd).toHaveBeenCalledWith(
        "send-message",
        expect.objectContaining({
          url: "https://graph.facebook.com/v22.0/test/messages",
          payload: expect.objectContaining({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: "5511999990001",
            type: "text",
            text: expect.objectContaining({ body: "Olá, tudo bem?" }),
          }),
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        }),
        expect.any(Object),
      );
    });

    it("converte msg para string ao enfileirar", async () => {
      mockQueueAdd.mockResolvedValue({});
      await MensagensComuns("5511999990001", 12345);

      const call = mockQueueAdd.mock.calls[0];
      expect(call[1].payload.text.body).toBe("12345");
    });

    it("não lança erro se a fila falhar", async () => {
      mockQueueAdd.mockRejectedValue(new Error("Redis offline"));
      await expect(
        MensagensComuns("5511999990001", "Teste"),
      ).resolves.not.toThrow();
    });
  });

  describe("enviarNotificacaoServico", () => {
    it("enfileira template notificacao_servico com destinatário correto", async () => {
      mockQueueAdd.mockResolvedValue({});
      await enviarNotificacaoServico("5511999990002");

      expect(mockQueueAdd).toHaveBeenCalledWith(
        "send-template",
        expect.objectContaining({
          payload: expect.objectContaining({
            to: "5511999990002",
            type: "template",
            template: expect.objectContaining({
              name: "notificacao_servico",
              language: { code: "pt_BR" },
            }),
          }),
        }),
        expect.any(Object),
      );
    });

    it("não lança erro se a fila falhar", async () => {
      mockQueueAdd.mockRejectedValue(new Error("Redis offline"));
      await expect(
        enviarNotificacaoServico("5511999990002"),
      ).resolves.not.toThrow();
    });
  });
});
