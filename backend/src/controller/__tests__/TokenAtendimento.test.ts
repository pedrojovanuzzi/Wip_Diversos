import { ClientesEntities } from "../../entities/ClientesEntities";
import TokenAtendimento from "../TokenAtendimento";
import { v4 as uuidv4 } from "uuid";
import moment from "moment-timezone";

describe("TokenAtendimento", () => {
  it("Deve gerar um pix de pagamento sem juros", async () => {
    const cliente = {
      id: 1,
      login: "PEDROGAMERBRTEST",
      cpf: "01450042872", // CPF DE TEST
      telefone: "12345678901",
      email: "test@example.com",
    };

    const tokenAtendimento = new TokenAtendimento();

    (tokenAtendimento as any).recordRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: 1,
        login: "Teste",
        valor: 100.0,
        datavenc: new Date(),
      }),
    };

    const req = {
      body: {
        login: cliente.login,
        cpf: cliente.cpf,
        perdoarJuros: false,
      },
    } as any;

    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    const pixResponse = await tokenAtendimento.gerarPixToken(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ link: expect.any(String) })
    );
  });

  it("Deve gerar um pix de pagamento com juros", async () => {
    const cliente = {
      id: 1,
      login: "PEDROGAMERBRTEST",
      cpf: "01450042872", // CPF DE TEST
      telefone: "12345678901",
      email: "test@example.com",
    };

    const tokenAtendimento = new TokenAtendimento();

    (tokenAtendimento as any).recordRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: 1,
        login: "Teste",
        valor: 100.0,
        datavenc: new Date(),
      }),
    };

    const req = {
      body: {
        login: cliente.login,
        cpf: cliente.cpf,
        perdoarJuros: false,
      },
    } as any;

    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    const pixResponse = await tokenAtendimento.gerarPixToken(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ link: expect.any(String) })
    );
  });

  it("Deve logar e buscar os cadastros", async () => {
    const tokenAtendimento = new TokenAtendimento();

    const req = {
      body: {
        cpf: "01450042872", // CPF DE TEST
      },
    } as any;

    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    const response = await tokenAtendimento.login(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          login: expect.stringContaining("PEDROGAMERBRTEST"),
        }),
      ])
    );
  });

  it("Deve escolher qual dos cadastros vai pegar o boleto com base no login", async () => {
    const tokenAtendimento = new TokenAtendimento();

    const req = {
      body: {
        login: "PEDROGAMERBRTEST",
      },
    } as any;

    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    const response = await tokenAtendimento.chooseHome(req, res);
    // const dadosEnviados = res.json.mock.calls[0][0];
    // console.log("Conteúdo do res.json:", dadosEnviados);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        login: expect.stringContaining("PEDROGAMERBRTEST"),
      })
    );
  });

  it("Deve criar um cadastro", async () => {
    const tokenAtendimento = new TokenAtendimento();

    // Mock do clienteRepo
    (tokenAtendimento as any).clienteRepo = {
      create: vi.fn().mockImplementation((data) => data),
      save: vi.fn().mockResolvedValue({}),
      find: vi.fn(),
      findOne: vi.fn(),
    };

    const session = {
      dadosCompleto: {
        nome: "PEDROGAMERTEST3",
        rg: "12.345.678-9",
        cpf: "123.456.789-01",
        email: " test@gmail.com ",
        cidade: "bauru",
        bairro: "centro",
        estado: "SP",
        dataNascimento: "01/01/2000",
        numero: " 123 ",
        rua: " rua exemplo ",
        cep: "17000000",
        celular: "14999999999",
        celularSecundario: "14888888888",
      },
      planoEscolhido: "Plano Teste",
      vencimentoEscolhido: " dia 10 ",
    };

    const addClient = {
      nome: (session.dadosCompleto.nome || "").toUpperCase(),
      login: (session.dadosCompleto.nome || "")
        .trim()
        .replace(/\s/g, "")
        .toUpperCase(),
      rg: session.dadosCompleto.rg.trim().replace(/\s/g, ""),
      cpf_cnpj: session.dadosCompleto.cpf.trim().replace(/\s/g, ""),
      uuid_cliente: `019b${uuidv4().slice(0, 32)}`,
      email: session.dadosCompleto.email.trim().replace(/\s/g, ""),
      cidade: `${session.dadosCompleto.cidade
        .trim()
        .slice(0, 1)
        .toUpperCase()}${session.dadosCompleto.cidade.trim().slice(1)}`,
      bairro: session.dadosCompleto.bairro.toUpperCase().trim(),
      estado: (session.dadosCompleto.estado || "")
        .toUpperCase()
        .replace(/\s/g, "")
        .slice(0, 2),
      nascimento: session.dadosCompleto.dataNascimento.replace(
        /(\d{2})\/(\d{2})\/(\d{4})/,
        "$3-$2-$1"
      ),
      numero: session.dadosCompleto.numero.trim().replace(/\s/g, ""),
      endereco: session.dadosCompleto.rua.toUpperCase().trim(),
      cep: `${session.dadosCompleto.cep
        .trim()
        .replace(/\s/g, "")
        .slice(0, 5)}-${session.dadosCompleto.cep
        .trim()
        .replace(/\s/g, "")
        .slice(5)}`,
      plano: session.planoEscolhido,
      fone: "(14)3296-1608",
      venc: (session.vencimentoEscolhido || "")
        .trim()
        .replace(/\s/g, "")
        .replace(/\D/g, ""),
      celular: `(${session.dadosCompleto.celular.slice(
        0,
        2
      )})${session.dadosCompleto.celular.slice(2)}`,
      celular2: `(${session.dadosCompleto.celularSecundario.slice(
        0,
        2
      )})${session.dadosCompleto.celularSecundario.slice(2)}`,
      estado_res: (session.dadosCompleto.estado || "")
        .toUpperCase()
        .replace(/\s/g, "")
        .slice(0, 2),
      bairro_res: session.dadosCompleto.bairro.toUpperCase().trim(),
      cidade_res: `${session.dadosCompleto.cidade
        .trim()
        .slice(0, 1)
        .toUpperCase()}${session.dadosCompleto.cidade.trim().slice(1)}`,
      cep_res: `${session.dadosCompleto.cep
        .trim()
        .replace(/\s/g, "")
        .slice(0, 5)}-${session.dadosCompleto.cep
        .trim()
        .replace(/\s/g, "")
        .slice(5)}`,
      numero_res: session.dadosCompleto.numero.trim().replace(/\s/g, ""),
      endereco_res: session.dadosCompleto.rua.toUpperCase().trim(),
      tipo_cob: "titulo",
      mesref: "now",
      prilanc: "tot",
      pessoa:
        session.dadosCompleto.cpf.replace(/\D/g, "").length <= 11
          ? "fisica"
          : "juridica",
      dias_corte: 80,
      cadastro: moment().format("DD-MM-YYYY").split("-").join("/"),
      data_ip: moment().format("YYYY-MM-DD HH:mm:ss"),
    };

    const req = {
      body: addClient,
    } as any;

    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    await tokenAtendimento.criarCadastro(req, res);

    expect((tokenAtendimento as any).clienteRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        login: expect.stringContaining("PEDROGAMERTEST3"),
      })
    );

    expect(res.json).toHaveBeenCalledWith({
      message: "Cadastro criado com sucesso",
    });
  });
});
