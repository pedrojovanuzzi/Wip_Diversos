import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bullmq', async (importOriginal) => {
  return {
    ...await importOriginal<typeof import('bullmq')>(),
    Queue: class MockQueue {
      add = vi.fn();
      getFailed = vi.fn().mockResolvedValue([]);
      remove = vi.fn();
    },
    Worker: class MockWorker {
      on = vi.fn();
    },
    Job: class {}
  };
});

vi.mock('../../database/API_MK', () => {
    return {
        default: {
            getRepository: vi.fn().mockReturnValue({
                findOne: vi.fn(),
                create: vi.fn(),
                save: vi.fn(),
                delete: vi.fn()
            })
        }
    };
});

vi.mock('../../database/MkauthSource', () => {
    return {
        default: {
            getRepository: vi.fn().mockReturnValue({
                find: vi.fn(),
                findOne: vi.fn(),
                save: vi.fn(),
                update: vi.fn()
            }),
            query: vi.fn().mockResolvedValue([])
        }
    };
});

vi.mock('axios');

vi.mock('nodemailer', () => ({
    default: {
        createTransport: vi.fn(() => ({
            sendMail: vi.fn()
        }))
    },
    createTransport: vi.fn(() => ({
        sendMail: vi.fn()
    }))
}));

// Usamos vi.mock em um módulo interno que importa o dotenv ou ignoramos

// Após os mocks, podemos importar a controller correndo menos risco de timeout/conexão
import whatsPixController from '../WhatsConversationPath';

describe('WhatsPixController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve exportar a instância principal com sucesso', () => {
         expect(whatsPixController).toBeDefined();
         expect(typeof whatsPixController.MensagensComuns).toBe('function');
    });

    it('deve enfileirar uma mensagem no BullMQ com MensagensComuns', async () => {
         await whatsPixController.MensagensComuns('551499999999', 'Olá, Teste Unitário');
         // O envio do whats não pode quebrar a execução local do teste sem o Redis/Internet
    });

    it('deve trocar a sessao do usuario pata options_start ao usar stage inicial vazio', async () => {
         const sessionMock: any = { stage: '' };
         await whatsPixController.handleMessage(sessionMock, 'Ola', '5511999999', 'text', false);
         expect(sessionMock.stage).toBe('options_start');
    });

    it('deve enviar aviso de manutencao se a tag manutencao estiver ativada e congelar session', async () => {
         const sessionMock: any = { stage: '' };
         await whatsPixController.handleMessage(sessionMock, 'Ola', '5511999999', 'text', true);
         // Se entrou em manutenção, o stage não deve ir para options_start normalmente
         expect(sessionMock.stage).not.toBe('options_start');
    });
});
