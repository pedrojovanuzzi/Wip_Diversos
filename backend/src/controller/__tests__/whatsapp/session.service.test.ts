import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUpdate, mockSave, mockDelete, mockCount } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockSave: vi.fn(),
  mockDelete: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock("../../../database/API_MK", () => ({
  default: {
    getRepository: vi.fn().mockReturnValue({
      update: mockUpdate,
      save: mockSave,
      delete: mockDelete,
      count: mockCount,
    }),
  },
}));

import {
  conversation,
  setConversation,
  saveSession,
  deleteSession,
  getActiveSessionsCount,
} from "../../whatsapp/services/session.service";

describe("session.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setConversation", () => {
    it("atualiza o objeto conversation", () => {
      setConversation({ conv_id: 42, sender_id: 10, receiver_id: 1 });
      expect(conversation.conv_id).toBe(42);
      expect(conversation.sender_id).toBe(10);
    });
  });

  describe("getActiveSessionsCount", () => {
    it("retorna a contagem do banco", async () => {
      mockCount.mockResolvedValue(3);
      const count = await getActiveSessionsCount();
      expect(count).toBe(3);
      expect(mockCount).toHaveBeenCalled();
    });
  });

  describe("saveSession", () => {
    it("atualiza registro existente com messageId", async () => {
      mockUpdate.mockResolvedValue({ affected: 1 });

      await saveSession("5511999990001", {
        stage: "awaiting_cpf",
        inactivityTimer: setTimeout(() => {}, 10000),
        cpf: "12345678901",
        nome: "Cliente Teste",
      }, "msg-123");

      expect(mockUpdate).toHaveBeenCalledWith(
        { celular: "5511999990001" },
        {
          stage: "awaiting_cpf",
          dados: { cpf: "12345678901", nome: "Cliente Teste" },
          last_message_id: "msg-123",
        },
      );
      expect(mockSave).not.toHaveBeenCalled();
    });

    it("insere novo registro quando update não encontra linha", async () => {
      mockUpdate.mockResolvedValue({ affected: 0 });
      mockSave.mockResolvedValue({});

      await saveSession("5599999000000", { stage: "options_start" });

      expect(mockSave).toHaveBeenCalledWith({
        celular: "5599999000000",
        stage: "options_start",
        dados: {},
      });
    });

    it("não inclui last_message_id quando messageId é null", async () => {
      mockUpdate.mockResolvedValue({ affected: 1 });

      await saveSession("5511999990001", { stage: "awaiting_cpf", cpf: "111" }, null);

      expect(mockUpdate).toHaveBeenCalledWith(
        { celular: "5511999990001" },
        { stage: "awaiting_cpf", dados: { cpf: "111" } },
      );
    });

    it("exclui _deleted e inactivityTimer dos dados salvos", async () => {
      mockUpdate.mockResolvedValue({ affected: 1 });

      await saveSession("5511999990001", {
        stage: "end",
        _deleted: true,
        inactivityTimer: setTimeout(() => {}, 0),
        cpf: "111",
      });

      const updateData = mockUpdate.mock.calls[0][1];
      expect(updateData.dados).not.toHaveProperty("_deleted");
      expect(updateData.dados).not.toHaveProperty("inactivityTimer");
    });
  });

  describe("deleteSession", () => {
    it("remove a sessão do banco", async () => {
      mockDelete.mockResolvedValue({});
      await deleteSession("5511999990001");
      expect(mockDelete).toHaveBeenCalledWith({ celular: "5511999990001" });
    });
  });
});
