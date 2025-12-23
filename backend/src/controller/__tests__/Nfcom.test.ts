import DataSource from "../../database/DataSource";
import AppDataSource from "../../database/MkauthSource";
import { ClientesEntities } from "../../entities/ClientesEntities";
import { Jobs } from "../../entities/Jobs";
import { NFCom } from "../../entities/NFCom";
import Nfcom from "../Nfcom";

describe("NFCOM Controller", async () => {
  it("Deve cancelar a NFCOM", async () => {
    const nfcom = new Nfcom();

    const req = {
      body: {
        id: 1,
        password: process.env.TEST_PASS,
      },
    } as any;

    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    vi.spyOn(DataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === Jobs) {
        return {
          update: vi.fn(),
          create: vi.fn().mockResolvedValue({
            name: "cancelarNFCom",
            description: "Cancelamento de NFCom",
            status: "pendente",
            total: 1,
            processados: 0,
            resultado: [],
          }),
          save: vi.fn(),
        } as any;
      } else if (entity === NFCom) {
        return {
          update: vi.fn(),
          find: vi.fn().mockResolvedValue([
            {
              id: 1,
              nNF: "10500",
              serie: "1",
              cpf_cnpj: "12.345.678/0001-90",
              tipo: "Assinatura",
              chave: "35231212345678000190550010000105001000105001", // 44 caracteres simulados
              xml: "<?xml version='1.0' encoding='UTF-8'?><NFCom>...</NFCom>",
              protocolo: "135230000001234",
              status: "autorizada",
              data_emissao: new Date("2023-12-01T10:00:00"),
              cliente_id: 42,
              fatura_id: 1001,
              qrcodeLink: "https://portal.sefaz.rs.gov.br/qrcode?ch=352312...",
              pppoe: "cliente_teste_fibra",
              value: 149.9,
              tpAmb: 1, // 1 = Produção, 2 = Homologação
              numeracao: 10500,
            },
          ]),
          findOne: vi.fn().mockResolvedValue([
            {
              id: 1,
              nNF: "10500",
              serie: "1",
              cpf_cnpj: "12.345.678/0001-90",
              tipo: "Assinatura",
              chave: "35231212345678000190550010000105001000105001", // 44 caracteres simulados
              xml: "<?xml version='1.0' encoding='UTF-8'?><NFCom>...</NFCom>",
              protocolo: "135230000001234",
              status: "autorizada",
              data_emissao: new Date("2023-12-01T10:00:00"),
              cliente_id: 42,
              fatura_id: 1001,
              qrcodeLink: "https://portal.sefaz.rs.gov.br/qrcode?ch=352312...",
              pppoe: "cliente_teste_fibra",
              value: 149.9,
              tpAmb: 1, // 1 = Produção, 2 = Homologação
              numeracao: 10500,
            },
          ]),
        } as any;
      }
    });

    vi.spyOn(AppDataSource, "getRepository").mockImplementation(
      (entity: any) => {
        if (entity === ClientesEntities) {
          return {
            update: vi.fn(),
            findOne: vi.fn().mockResolvedValue({
              id: 1,
              nome: "João da Silva",
              email: "joao.silva@email.com",
              endereco: "Rua das Flores",
              bairro: "Centro",
              cidade: "São Paulo",
              cep: "01001-000",
              estado: "SP",
              cpf_cnpj: "123.456.789-00",
              fone: "(11) 3333-3333",
              obs: "Cliente VIP",
              nascimento: "1990-01-01",
              estado_civil: "C", // Enum: 'S', 'C', 'D', 'V'
              cadastro: new Date("2023-01-15T00:00:00.000Z"),
              login: "joaosilva",
              tipo: "Física",
              night: "nao",
              aviso: "Sem avisos pendentes",
              foto: "perfil_1.jpg",
              venc: "10",
              mac: "AA:BB:CC:DD:EE:FF",
              complemento: "Apto 101",
              ip: "192.168.100.10",
              ramal: "101",
              rg: "12.345.678-9",
              isento: false,
              celular: "(11) 99999-9999",
              bloqueado: "nao", // Enum: 'sim', 'nao'
              autoip: "sim", // Enum
              automac: "sim", // Enum
              conta: "123456",
              ipvsix: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
              plano: "Plano Fibra 500MB",
              send: "ok",
              cli_ativado: "s", // Enum: 's', 'n'
              simultaneo: "nao",
              turbo: "nao",
              comodato: "sim",
              observacao: "nao", // Enum
              chavetipo: "wpa2",
              chave: "senha123wifi",
              contrato: "CONT-2023/001",
              ssid: "WIFI_JOAO",
              senha: "senha_segura",
              numero: "123",
              responsavel: "João da Silva",
              nome_pai: "José da Silva",
              nome_mae: "Maria da Silva",
              expedicao_rg: "SSP/SP",
              naturalidade: "São Paulo",
              acessacen: "sim",
              pessoa: "Física",
              endereco_res: "Rua das Flores",
              numero_res: "123",
              bairro_res: "Centro",
              cidade_res: "São Paulo",
              cep_res: "01001-000",
              estado_res: "SP",
              complemento_res: "Apto 101",
              desconto: 0.0,
              acrescimo: 0.0,
              equipamento: "ONU Huawei",
              vendedor: "Carlos Vendas",
              nextel: "",
              accesslist: "nao", // Enum
              resumo: "Cliente adimplente",
              grupo: "Residencial",
              codigo: "COD123",
              prilanc: "tot", // Enum: 'pro', 'tot'
              tipobloq: "aut", // Enum: 'aut', 'man'
              adesao: 0.0,
              mbdisco: 100,
              sms: "sim", // Enum
              ltrafego: 0,
              planodown: "Bloqueio Total",
              ligoudown: "nao",
              statusdown: "off", // Enum: 'on', 'off'
              statusturbo: "off", // Enum
              opcelular: "Vivo",
              nome_res: "João",
              coordenadas: "-23.550520, -46.633308",
              rem_obs: new Date(),
              valor_sva: 0.0,
              dias_corte: 15,
              user_ip: "admin",
              user_mac: "admin",
              data_ip: new Date(),
              data_mac: new Date(),
              last_update: new Date(),
              data_bloq: null,
              tags: "novo, fibra",
              tecnico: "Pedro Tech",
              data_ins: new Date("2023-01-10"),
              altsenha: "nao", // Enum
              geranfe: "sim", // Enum
              mesref: "now", // Enum
              ipfall: "10.0.0.1",
              tit_abertos: 0,
              parc_abertas: 0,
              tipo_pessoa: 1,
              celular2: "",
              mac_serial: "SN12345678",
              status_corte: "full", // Enum: 'full', 'down', 'bloq'
              plano15: "Plano Antigo",
              pgaviso: "nao", // Enum
              porta_olt: "1/1/1",
              caixa_herm: "CX-01",
              porta_splitter: "2",
              onu_ont: "Huawei HG8245",
              switch: "SW-Core",
              tit_vencidos: 0,
              pgcorte: "nao", // Enum
              interface: "vlan100",
              login_atend: "atendente1",
              cidade_ibge: "3550308",
              estado_ibge: "35",
              data_desbloq: null,
              pool_name: "pool_clientes",
              pool6: "pool_v6",
              rec_email: "sim", // Enum
              dot_ref: "REF-001",
              conta_cartao: 0,
              termo: "Aceito",
              opcelular2: "",
              tipo_cliente: 1,
              armario_olt: "Armario Central",
              plano_bloqc: "Bloqueio Parcial",
              uuid_cliente: "550e8400-e29b-41d4-a716-446655440000",
              data_desativacao: null,
              tipo_cob: "titulo", // Enum: 'titulo', 'carne'
              fortunus: 0,
              gsici: 0,
              local_dici: "u", // Enum: 'u', 'r'
            }),
          } as any;
        }
      }
    );

    const response = await nfcom.cancelarNFcom(req, res);

    // expect(res.json).toEqual(
    //   '<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">'
    // );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: undefined,
        message: "NFCom em processo de cancelamento!",
      })
    );
  });
});
