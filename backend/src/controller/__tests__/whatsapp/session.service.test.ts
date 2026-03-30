import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSave, mockDelete, mockFindOne } = vi.hoisted(() => ({
  mockSave: vi.fn(),
  mockDelete: vi.fn(),
  mockFindOne: vi.fn(),
}));

vi.mock("../../../database/API_MK", () => ({
  default: {
    getRepository: vi.fn().mockReturnValue({
      save: mockSave,
      delete: mockDelete,
      findOne: mockFindOne,
    }),
  },
}));

import {
  sessions,
  conversation,
  setConversation,
  saveSession,
  deleteSession,
  getActiveSessionsCount,
} from "../../whatsapp/services/session.service";

describe("session.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(sessions)) {
      delete sessions[key];
    }
  });

  describe("getActiveSessionsCount", () => {
    it("retorna 0 quando não há sessões", () => {
      expect(getActiveSessionsCount()).toBe(0);
    });

    it("retorna a quantidade correta de sessões ativas", () => {
      sessions["5511999990001"] = { stage: "options_start" };
      sessions["5511999990002"] = { stage: "awaiting_cpf" };
      expect(getActiveSessionsCount()).toBe(2);
    });
  });

  describe("setConversation", () => {
    it("atualiza o objeto conversation", () => {
      setConversation({ conv_id: 42, sender_id: 10, receiver_id: 1 });
      expect(conversation.conv_id).toBe(42);
      expect(conversation.sender_id).toBe(10);
    });
  });

  describe("saveSession", () => {
    it("persiste a sessão omitindo stage, inactivityTimer e last_message_id dos dados", async () => {
      const timer = setTimeout(() => {}, 10000);
      sessions["5511999990001"] = {
        stage: "awaiting_cpf",
        inactivityTimer: timer,
        last_message_id: "msg-123",
        cpf: "12345678901",
        nome: "Cliente Teste",
      };

      mockSave.mockResolvedValue({});
      await saveSession("5511999990001");

      expect(mockSave).toHaveBeenCalledWith({
        celular: "5511999990001",
        stage: "awaiting_cpf",
        dados: { cpf: "12345678901", nome: "Cliente Teste" },
        last_message_id: "msg-123",
      });

      clearTimeout(timer);
    });

    it("não chama o banco se a sessão não existe", async () => {
      await saveSession("5599999000000");
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  describe("deleteSession", () => {
    it("remove a sessão da memória e do banco", async () => {
      sessions["5511999990001"] = { stage: "options_start" };
      mockDelete.mockResolvedValue({});

      await deleteSession("5511999990001");

      expect(sessions["5511999990001"]).toBeUndefined();
      expect(mockDelete).toHaveBeenCalledWith({ celular: "5511999990001" });
    });

    it("chama o banco mesmo se a sessão não estava na memória", async () => {
      mockDelete.mockResolvedValue({});
      await deleteSession("5599999000000");
      expect(mockDelete).toHaveBeenCalledWith({ celular: "5599999000000" });
    });
  });
});
