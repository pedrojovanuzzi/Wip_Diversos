import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQueueAdd = vi.hoisted(() => vi.fn());

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    add = mockQueueAdd;
  },
}));

vi.mock("../../whatsapp/config", () => ({
  token: "meu-token-secreto",
  isSandbox: false,
  logFilePath: "/tmp/test-log.json",
  manutencao: false,
  redisOptions: { host: "localhost", port: 6379 },
}));

vi.mock("../../whatsapp/utils/helpers", () => ({
  findOrCreate: vi.fn().mockResolvedValue([{ id: 1 }, false]),
}));

vi.mock("../../whatsapp/utils/logging", () => ({
  writeLog: vi.fn(),
}));

vi.mock("../../whatsapp/services/session.service", () => ({
  sessions: {},
  saveSession: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock("../../whatsapp/services/messaging.service", () => ({
  whatsappIncomingQueue: { add: mockQueueAdd },
  whatsappOutgoingQueue: { add: vi.fn() },
}));

vi.mock("../../../database/API_MK", () => ({
  default: {
    getRepository: vi.fn().mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue({}),
    }),
  },
}));

vi.mock("fs", () => ({
  default: {
    readFile: vi.fn((_path: any, _enc: any, cb: any) => cb(null, "[]")),
    writeFile: vi.fn((_path: any, _data: any, _enc: any, cb: any) => cb(null)),
  },
}));

import { verify, index } from "../../whatsapp/handlers/webhook.handler";

function makeReq(query: object = {}, body: object = {}): any {
  return { query, body };
}
function makeRes(): any {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    sendStatus: vi.fn().mockReturnThis(),
  };
}

describe("webhook.handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verify", () => {
    it("responde 200 com challenge quando mode=subscribe e token bate", async () => {
      const req = makeReq({
        "hub.mode": "subscribe",
        "hub.verify_token": "meu-token-secreto",
        "hub.challenge": "abc123",
      });
      const res = makeRes();

      await verify(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith("abc123");
    });

    it("responde 400 quando token não bate", async () => {
      const req = makeReq({
        "hub.mode": "subscribe",
        "hub.verify_token": "token-errado",
        "hub.challenge": "abc123",
      });
      const res = makeRes();

      await verify(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("responde 400 quando mode está ausente", async () => {
      const req = makeReq({ "hub.verify_token": "meu-token-secreto" });
      const res = makeRes();

      await verify(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("index", () => {
    it("responde 200 quando body não tem entry", async () => {
      const req = makeReq({}, { object: "whatsapp_business_account" });
      const res = makeRes();

      await index(req, res);

      expect(res.sendStatus).toHaveBeenCalledWith(200);
    });

    it("responde 200 imediatamente quando body tem reqbody, sem enfileirar", async () => {
      const req = makeReq({}, { reqbody: true, entry: [] });
      const res = makeRes();

      await index(req, res);

      expect(res.sendStatus).toHaveBeenCalledWith(200);
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it("enfileira mensagem de texto válida no incoming queue", async () => {
      mockQueueAdd.mockResolvedValue({});
      const req = makeReq(
        {},
        {
          entry: [
            {
              id: "production-id",
              changes: [
                {
                  value: {
                    messages: [
                      {
                        from: "5511999990001",
                        type: "text",
                        id: "msg-texto-001",
                        text: { body: "Olá" },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      );
      const res = makeRes();

      await index(req, res);

      expect(mockQueueAdd).toHaveBeenCalledWith(
        "process-message",
        expect.objectContaining({
          texto: "Olá",
          celular: "5511999990001",
          type: "text",
          messageId: "msg-texto-001",
        }),
        expect.any(Object),
      );
      expect(res.sendStatus).toHaveBeenCalledWith(200);
    });

    it("enfileira resposta de botão interativo com o título do botão", async () => {
      mockQueueAdd.mockResolvedValue({});
      const req = makeReq(
        {},
        {
          entry: [
            {
              id: "production-id",
              changes: [
                {
                  value: {
                    messages: [
                      {
                        from: "5511999990001",
                        type: "interactive",
                        id: "msg-btn-001",
                        interactive: {
                          type: "button_reply",
                          button_reply: { title: "Opção 1" },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      );
      const res = makeRes();

      await index(req, res);

      expect(mockQueueAdd).toHaveBeenCalledWith(
        "process-message",
        expect.objectContaining({ texto: "Opção 1", type: "interactive" }),
        expect.any(Object),
      );
    });

    it("ignora mensagem duplicada (mesmo messageId processado duas vezes)", async () => {
      mockQueueAdd.mockResolvedValue({});

      const body = {
        entry: [
          {
            id: "production-id",
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: "5511999990001",
                      type: "text",
                      id: "msg-dup-002",
                      text: { body: "Oi" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      await index(makeReq({}, body), makeRes());
      await index(makeReq({}, body), makeRes());

      expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    });
  });
});
