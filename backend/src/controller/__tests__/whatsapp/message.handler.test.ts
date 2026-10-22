import { describe, it, expect, vi, beforeEach } from "vitest";

const mensagens = vi.hoisted(() => ({
  MensagensComuns: vi.fn(),
  MensagemBotao: vi.fn(),
  MensagemLista: vi.fn(),
  MensagemFlow: vi.fn(),
  MensagemTermos: vi.fn(),
  boasVindas: vi.fn(),
  PodeMePassarOCpf: vi.fn(),
  Finalizar: vi.fn(),
}));
const enviarBoleto = vi.hoisted(() => vi.fn());
const clientesFind = vi.hoisted(() => vi.fn());

vi.mock("../../whatsapp/services/messaging.service", () => mensagens);
vi.mock("../../whatsapp/services/payment.service", () => ({ enviarBoleto }));
vi.mock("../../whatsapp/services/email.service", () => ({ sendServiceEmail: vi.fn() }));
vi.mock("../../whatsapp/services/plano.service", () => ({ getPlanosDoSistema: vi.fn() }));
vi.mock("../../whatsapp/services/session.service", () => ({
  deleteSession: vi.fn(),
  getActiveSessionsCount: vi.fn().mockResolvedValue(0),
  conversation: {},
  setConversation: vi.fn(),
}));
vi.mock("../../whatsapp/utils/helpers", () => ({
  findOrCreate: vi.fn().mockResolvedValue([{ id: 7 }, false]),
}));
vi.mock("../../whatsapp/utils/logging", () => ({ writeLog: vi.fn() }));
vi.mock("../../whatsapp/handlers/termoSva.handler", () => ({ handleTermoSva: vi.fn() }));
vi.mock("../../whatsapp/handlers/cadastro.handler", () => ({}));
vi.mock("../../whatsapp/handlers/servicos.handler", () => ({}));
vi.mock("../../whatsapp/handlers/mudanca-endereco.handler", () => ({ iniciarMudanca: vi.fn() }));
vi.mock("../../../database/API_MK", () => ({
  default: {
    getRepository: vi.fn().mockReturnValue({
      findOne: vi.fn().mockResolvedValue({ conv_id: 3 }),
      findOneBy: vi.fn().mockResolvedValue({ id: 3 }),
      save: vi.fn().mockResolvedValue({ id: 3 }),
    }),
  },
}));
vi.mock("../../../database/MkauthSource", () => ({
  default: { getRepository: vi.fn().mockReturnValue({ find: clientesFind }) },
}));
vi.mock("../../../entities/ClientesEntities", () => ({ ClientesEntities: class {} }));

import { handleMessage } from "../../whatsapp/handlers/message.handler";

const CEL = "5514999990000";

function textosEnviados() {
  return mensagens.MensagensComuns.mock.calls.map((c) => String(c[1]));
}

describe("message.handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["início", "Inicio ", "INÍCIO"])(
    "'%s' volta ao menu de qualquer etapa e esquece os passos",
    async (texto) => {
      const session: any = {
        stage: "watch_tv",
        watchTvStep: "ask_cpf",
        trocaPlanoStep: "ask_cpf",
        endHandled: true,
      };
      await handleMessage(session, texto, CEL, "text", false);

      expect(session.stage).toBe("options_start");
      expect(session.watchTvStep).toBeUndefined();
      expect(session.trocaPlanoStep).toBeUndefined();
      expect(mensagens.boasVindas).toHaveBeenCalledWith(CEL);
    },
  );

  it("avisa quando o CPF do boleto é inválido", async () => {
    const session: any = { stage: "awaiting_cpf" };
    await handleMessage(session, "123", CEL, "text", false);

    expect(session.stage).toBe("awaiting_cpf");
    expect(textosEnviados().some((t) => t.includes("inválido"))).toBe(true);
  });

  it.each(["0", "3", "-1"])(
    "seleção de cadastro '%s' fora da lista responde em vez de quebrar",
    async (texto) => {
      const session: any = {
        stage: "awaiting_selection",
        structuredData: [
          { index: 1, login: "a" },
          { index: 2, login: "b" },
        ],
      };
      await handleMessage(session, texto, CEL, "text", false);

      expect(enviarBoleto).not.toHaveBeenCalled();
      expect(session.stage).toBe("awaiting_selection");
      expect(textosEnviados().some((t) => t.includes("inválida"))).toBe(true);
    },
  );

  it("seleção válida envia o boleto do cadastro escolhido", async () => {
    const session: any = {
      stage: "awaiting_selection",
      structuredData: [
        { index: 1, login: "a", endereco: "Rua A", cpf: "1" },
        { index: 2, login: "b", endereco: "Rua B", cpf: "1" },
      ],
    };
    await handleMessage(session, "2", CEL, "text", false);

    expect(enviarBoleto).toHaveBeenCalledWith("b", CEL, "Rua B", "1");
    expect(session.stage).toBe("end");
  });

  it("'continuar' no fim responde mesmo com endHandled de um atendimento anterior", async () => {
    const session: any = { stage: "end", endHandled: true };
    await handleMessage(session, "continuar", CEL, "text", false);

    expect(session.stage).toBe("end_talk");
    expect(textosEnviados().some((t) => t.includes("Ainda Precisa de Ajuda"))).toBe(true);
  });
});
