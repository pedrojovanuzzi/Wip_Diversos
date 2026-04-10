import { Request, Response } from "express";
import { whatsappOutgoingQueue } from "../services/messaging.service";
import { handleMessage } from "./message.handler";
import MkauthDataSource from "../../../database/MkauthSource";
import { ClientesEntities } from "../../../entities/ClientesEntities";

interface FlowStep {
  input: string;
  type: "interactive" | "text";
  label?: string;
}

interface FlowDefinition {
  name: string;
  description: string;
  requiresLogin: boolean;
  steps: FlowStep[];
}

interface ClienteData {
  login: string;
  nome: string;
  cpf_cnpj: string;
  rg: string;
  email: string;
  celular: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  plano: string;
  venc: string;
}

function getFlows(cliente: ClienteData | null): FlowDefinition[] {
  const cpf = cliente?.cpf_cnpj || "00000000000";

  return [
    {
      name: "Boleto/Pix",
      description: "Consulta de boleto via CPF do cliente",
      requiresLogin: true,
      steps: [
        { input: "", type: "text", label: "Início da conversa" },
        { input: "Boleto/Pix", type: "interactive", label: "Seleciona Boleto/Pix" },
        { input: cpf, type: "interactive", label: `Informa CPF (${cpf})` },
        { input: "continuar", type: "interactive", label: "Continuar" },
        { input: "Não", type: "interactive", label: "Encerra atendimento" },
      ],
    },
    {
      name: "Instalação",
      description: "Fluxo de nova instalação (até formulário)",
      requiresLogin: false,
      steps: [
        { input: "", type: "text", label: "Início da conversa" },
        { input: "Serviços/Contratação", type: "interactive", label: "Seleciona Serviços" },
        { input: "Instalação", type: "interactive", label: "Seleciona Instalação" },
        { input: "Sim Aceito", type: "interactive", label: "Aceita LGPD" },
      ],
    },
    {
      name: "Mudança de Endereço",
      description: "Fluxo de mudança de endereço",
      requiresLogin: false,
      steps: [
        { input: "", type: "text", label: "Início da conversa" },
        { input: "Serviços/Contratação", type: "interactive", label: "Seleciona Serviços" },
        { input: "Mudança de Endereço", type: "interactive", label: "Seleciona Mudança de Endereço" },
      ],
    },
    {
      name: "Mudança de Cômodo",
      description: "Fluxo de mudança de cômodo",
      requiresLogin: false,
      steps: [
        { input: "", type: "text", label: "Início da conversa" },
        { input: "Serviços/Contratação", type: "interactive", label: "Seleciona Serviços" },
        { input: "Mudança de Cômodo", type: "interactive", label: "Seleciona Mudança de Cômodo" },
      ],
    },
    {
      name: "Alteração Titularidade",
      description: "Fluxo de troca de titularidade (até LGPD)",
      requiresLogin: false,
      steps: [
        { input: "", type: "text", label: "Início da conversa" },
        { input: "Serviços/Contratação", type: "interactive", label: "Seleciona Serviços" },
        { input: "Alteração Titularidade", type: "interactive", label: "Seleciona Titularidade" },
        { input: "Sim Aceito", type: "interactive", label: "Aceita LGPD" },
      ],
    },
    {
      name: "Alteração de Plano",
      description: "Fluxo de troca de plano (até LGPD)",
      requiresLogin: false,
      steps: [
        { input: "", type: "text", label: "Início da conversa" },
        { input: "Serviços/Contratação", type: "interactive", label: "Seleciona Serviços" },
        { input: "Alteração de Plano", type: "interactive", label: "Seleciona Troca de Plano" },
        { input: "Sim Aceito", type: "interactive", label: "Aceita LGPD" },
      ],
    },
    {
      name: "Recusa LGPD",
      description: "Fluxo onde o usuário recusa os termos LGPD",
      requiresLogin: false,
      steps: [
        { input: "", type: "text", label: "Início da conversa" },
        { input: "Serviços/Contratação", type: "interactive", label: "Seleciona Serviços" },
        { input: "Instalação", type: "interactive", label: "Seleciona Instalação" },
        { input: "Não", type: "interactive", label: "Recusa LGPD" },
      ],
    },
    {
      name: "Falar com Atendente",
      description: "Fluxo de encaminhamento para atendente",
      requiresLogin: false,
      steps: [
        { input: "", type: "text", label: "Início da conversa" },
        { input: "Falar com Atendente", type: "interactive", label: "Seleciona Atendente" },
        { input: "Não", type: "interactive", label: "Encerra" },
      ],
    },
    {
      name: "Resetar Sessão",
      description: "Testa o comando de resetar sessão",
      requiresLogin: false,
      steps: [
        { input: "", type: "text", label: "Início da conversa" },
        { input: "resetar", type: "interactive", label: "Reseta sessão" },
      ],
    },
  ];
}

interface CapturedMessage {
  jobName: string;
  text: string;
  type: string;
}

function extractMessageContent(jobName: string, data: any): CapturedMessage {
  const payload = data?.payload;
  let text = "";
  let type = jobName;

  if (!payload) return { jobName, text: "[payload vazio]", type };

  switch (jobName) {
    case "send-message":
      text = payload.text?.body || "";
      type = "texto";
      break;
    case "send-template":
      text = `[Template: ${payload.template?.name}]`;
      type = "template";
      break;
    case "send-button": {
      const body = payload.interactive?.body?.text || "";
      const buttons = (payload.interactive?.action?.buttons || [])
        .map((b: any) => b.reply?.title)
        .filter(Boolean);
      text = `${body}\n[Botões: ${buttons.join(" | ")}]`;
      type = "botão";
      break;
    }
    case "send-list": {
      const listBody = payload.interactive?.body?.text || "";
      const rows = (payload.interactive?.action?.sections || [])
        .flatMap((s: any) => s.rows || [])
        .map((r: any) => r.title)
        .filter(Boolean);
      text = `${listBody}\n[Lista: ${rows.join(" | ")}]`;
      type = "lista";
      break;
    }
    case "send-flow": {
      const flowBody = payload.interactive?.body?.text || "";
      const flowName =
        payload.interactive?.action?.parameters?.flow_name ||
        payload.interactive?.action?.parameters?.flow_id ||
        "";
      text = `${flowBody}\n[Flow: ${flowName}]`;
      type = "flow";
      break;
    }
    case "send-terms": {
      const termsHeader = payload.interactive?.header?.text || "";
      const termsBody = payload.interactive?.body?.text || "";
      const termsUrl =
        payload.interactive?.action?.parameters?.url || "";
      text = `${termsHeader}: ${termsBody}\n[Link: ${termsUrl}]`;
      type = "termos";
      break;
    }
    case "send-media":
      text = `[Mídia: ${payload.document?.filename || "arquivo"}]`;
      type = "mídia";
      break;
    default:
      text = JSON.stringify(payload).substring(0, 200);
  }

  return { jobName, text, type };
}

async function fetchCliente(login: string): Promise<ClienteData | null> {
  const cliente = await MkauthDataSource.getRepository(ClientesEntities).findOne({
    select: {
      login: true, nome: true, cpf_cnpj: true, rg: true,
      email: true, celular: true, endereco: true, numero: true,
      bairro: true, cidade: true, estado: true, cep: true,
      plano: true, venc: true,
    },
    where: { login },
  });
  return cliente as ClienteData | null;
}

export async function simulateFlow(req: Request, res: Response) {
  try {
    const { flowName, login } = req.body;

    // Fetch client data if login provided
    let cliente: ClienteData | null = null;
    if (login) {
      cliente = await fetchCliente(login);
      if (!cliente) {
        return res.status(404).json({ error: `Cliente "${login}" não encontrado no MKAuth.` });
      }
    }

    const flows = getFlows(cliente);

    // If no flowName, return available flows
    if (!flowName) {
      return res.json({
        flows: flows.map((f) => ({ name: f.name, description: f.description, requiresLogin: f.requiresLogin })),
      });
    }

    const flow = flows.find((f) => f.name === flowName);
    if (!flow) {
      return res.status(400).json({ error: `Fluxo "${flowName}" não encontrado.` });
    }

    if (flow.requiresLogin && !cliente) {
      return res.status(400).json({ error: `O fluxo "${flowName}" requer um login válido.` });
    }

    const testPhone = "5500000000000";
    const captured: CapturedMessage[] = [];
    const stepResults: Array<{
      step: number;
      label: string;
      userInput: string;
      botMessages: CapturedMessage[];
      sessionStage: string;
      status: "ok" | "error";
      error?: string;
    }> = [];

    // Monkey-patch the queue's add method to capture messages
    const originalAdd = whatsappOutgoingQueue.add.bind(whatsappOutgoingQueue);
    (whatsappOutgoingQueue as any).add = async (
      name: string,
      data: any,
      _opts?: any,
    ) => {
      captured.push(extractMessageContent(name, data));
    };

    try {
      const session: any = { stage: "" };

      for (let i = 0; i < flow.steps.length; i++) {
        const step = flow.steps[i];
        captured.length = 0;

        try {
          await handleMessage(
            session,
            step.input,
            testPhone,
            step.type === "interactive" ? "interactive" : "text",
            false,
          );

          stepResults.push({
            step: i + 1,
            label: step.label || `Passo ${i + 1}`,
            userInput: step.input || "[início]",
            botMessages: [...captured],
            sessionStage: session.stage || "(vazio)",
            status: "ok",
          });
        } catch (err: any) {
          stepResults.push({
            step: i + 1,
            label: step.label || `Passo ${i + 1}`,
            userInput: step.input || "[início]",
            botMessages: [...captured],
            sessionStage: session.stage || "(vazio)",
            status: "error",
            error: err.message || String(err),
          });
        }

        if (session._deleted) break;
      }
    } finally {
      (whatsappOutgoingQueue as any).add = originalAdd;
    }

    res.json({
      flow: flow.name,
      description: flow.description,
      totalSteps: stepResults.length,
      cliente: cliente ? { login: cliente.login, nome: cliente.nome, cpf_cnpj: cliente.cpf_cnpj } : null,
      steps: stepResults,
    });
  } catch (err: any) {
    console.error("Erro na simulação:", err);
    res.status(500).json({ error: err.message || "Erro interno na simulação." });
  }
}

export async function listFlows(_req: Request, res: Response) {
  const flows = getFlows(null);
  res.json(
    flows.map((f) => ({ name: f.name, description: f.description, requiresLogin: f.requiresLogin })),
  );
}

export async function buscarCliente(req: Request, res: Response) {
  try {
    const { login } = req.params;
    const cliente = await fetchCliente(login);
    if (!cliente) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }
    res.json(cliente);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
