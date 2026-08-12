import ZapSign from "../ZapSign";
import ApiMkDataSource from "../../database/API_MK";
import ZapSignTemplates from "../../entities/APIMK/ZapSignTemplates";
import {
  getPlanosDoSistema,
  getPlanosWifiExtendido,
} from "../whatsapp/services/plano.service";

export type TipoCampo =
  | "text"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "textarea";

export type CampoServico = {
  name: string;
  label: string;
  type: TipoCampo;
  required?: boolean;
  maxChars?: number;
  ajuda?: string;
  /** Opções fixas; para listas dinâmicas use `fonte`. */
  opcoes?: Array<{ id: string; title: string }>;
  /** Lista resolvida no servidor na hora de montar o formulário. */
  fonte?: "planos" | "planos_wifi" | "estados" | "vencimentos";
};

export type Termo = {
  id: string;
  titulo: string;
  /** Texto do aceite, no mesmo tom das mensagens do bot. */
  texto: string;
  /** Rota do PDF no site (/doc/:arquivo). */
  url: string;
};

/**
 * Termos pedidos no início de qualquer atendimento do bot (LGPD e contrato
 * SCM registrado em cartório). Valem para todos os serviços.
 */
export const TERMOS_GERAIS: Termo[] = [
  {
    id: "privacidade",
    titulo: "Termos LGPD",
    texto:
      "Li e aceito os termos de tratamento dos meus dados pessoais, de acordo com a LGPD.",
    url: "/doc/privacidade",
  },
  {
    id: "contrato",
    titulo: "Contrato SCM",
    texto:
      "Li o contrato para provedores de serviços SCM, devidamente registrado em cartório.",
    url: "/doc/contrato",
  },
];

export type ServicoWeb = {
  id: string;
  /**
   * Chave em `zapsign_templates.nome_servico`. É essa tabela que diz quais
   * serviços existem e como se chamam; o resto (formulário, preço, termos)
   * é regra de negócio e fica aqui.
   */
  nomeServicoTemplate: string;
  nome: string;
  descricao: string;
  /** Assunto usado ao abrir o chamado no MKAUTH. */
  assuntoChamado: string;
  /** Termos específicos do serviço, somados aos gerais. */
  termos?: Termo[];
  /** Valor cobrado quando o cliente escolhe pagar. 0 = serviço sem cobrança. */
  valor: number;
  /** Permite a opção "grátis" com renovação contratual de 12 meses. */
  permiteGratisFidelidade: boolean;
  /**
   * O atendimento pode combinar outro preço ao gerar o link. Sem isso, vale
   * sempre o valor daqui.
   */
  permiteValorCustomizado?: boolean;
  /**
   * Na opção paga não há contrato a assinar — mesma regra do bot para a
   * Mudança de Cômodo. O termo continua saindo na opção grátis.
   */
  semContratoNaOpcaoPaga?: boolean;
  /** Chave usada por gerarLancamentoServico ao lançar a cobrança no MKAUTH. */
  tipoLancamento?: "mudanca_comodo" | "mudanca_endereco";
  campos: CampoServico[];
  /** Cria o contrato no ZapSign. Recebe o payload achatado do serviço. */
  criarContrato?: (params: Record<string, any>) => Promise<any>;
  /**
   * Serviço para quem ainda não é cliente: não há cadastro no MKAUTH para
   * consultar, então o formulário começa direto e coleta os dados do titular.
   */
  clienteNovo?: boolean;
  /**
   * A solicitação fica aguardando análise interna (consulta de CPF, decisão
   * grátis/paga). Cobrança e contrato saem depois, pela tela de solicitações.
   */
  analiseManual?: boolean;
};

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
].map((uf) => ({ id: uf, title: uf }));

const VENCIMENTOS = ["05", "10", "15", "20", "25"].map((d) => ({
  id: d,
  title: `Dia ${d}`,
}));

const CAMPO_OBSERVACAO: CampoServico = {
  name: "observacao",
  label: "Observação",
  type: "textarea",
  required: false,
  maxChars: 300,
};

export const CATALOGO: ServicoWeb[] = [
  {
    id: "instalacao",
    nomeServicoTemplate: "Instalação",
    nome: "Instalação",
    descricao:
      "Solicitação de instalação para quem ainda não é cliente. Os dados passam por análise antes da liberação.",
    assuntoChamado: "INSTALAÇÃO",
    termos: [
      {
        id: "contratacao",
        titulo: "Informações da contratação",
        texto:
          "Li atenciosamente as informações da contratação e não restam dúvidas sobre o serviço.",
        url: "/doc/contratação",
      },
    ],
    valor: 350,
    permiteGratisFidelidade: false,
    permiteValorCustomizado: true,
    clienteNovo: true,
    analiseManual: true,
    campos: [
      { name: "nome", label: "Nome completo", type: "text", required: true },
      { name: "cpf", label: "CPF ou CNPJ", type: "number", required: true },
      { name: "rg", label: "RG ou IE (opcional)", type: "text", required: false },
      { name: "dataNascimento", label: "Data de nascimento", type: "date", required: true },
      { name: "celular", label: "Celular (com DDD)", type: "phone", required: true },
      { name: "celularSecundario", label: "Celular secundário", type: "phone", required: false },
      { name: "email", label: "E-mail", type: "email", required: true },
      {
        name: "cep",
        label: "CEP",
        type: "number",
        required: true,
        ajuda: "Preenchemos cidade, bairro e estado a partir do CEP.",
      },
      { name: "rua", label: "Rua", type: "text", required: true },
      { name: "numero", label: "Número", type: "text", required: true },
      { name: "bairro", label: "Bairro", type: "text", required: true },
      { name: "cidade", label: "Cidade", type: "text", required: true },
      { name: "estado", label: "Estado", type: "select", required: true, fonte: "estados" },
      {
        name: "plano_escolhido",
        label: "Escolha o plano",
        type: "select",
        required: true,
        fonte: "planos",
      },
      {
        name: "vencimento",
        label: "Dia do vencimento",
        type: "select",
        required: true,
        fonte: "vencimentos",
      },
      CAMPO_OBSERVACAO,
    ],
  },
  {
    id: "mudanca_comodo",
    nomeServicoTemplate: "Mudança de Cômodo",
    nome: "Mudança de Cômodo",
    descricao:
      "Mudança do ponto de internet de um cômodo para outro dentro da mesma residência.",
    assuntoChamado: "MUDANÇA DE CÔMODO",
    termos: [
      {
        id: "mudanca_comodo",
        titulo: "Termo de Mudança de Cômodo",
        texto: "Li e aceito o Termo de Mudança de Cômodo.",
        url: "/doc/mudanca_comodo",
      },
    ],
    valor: 200,
    permiteGratisFidelidade: true,
    permiteValorCustomizado: true,
    semContratoNaOpcaoPaga: true,
    tipoLancamento: "mudanca_comodo",
    campos: [
      {
        name: "observacao",
        label: "Descreva a mudança",
        type: "textarea",
        required: true,
        maxChars: 200,
        ajuda: "Ex.: do quarto para a sala, da sala para o quarto.",
      },
    ],
    criarContrato: (params) => ZapSign.createContractMudancaComodo(params),
  },
  {
    id: "mudanca_endereco",
    nomeServicoTemplate: "Mudança de Endereço",
    nome: "Mudança de Endereço",
    descricao: "Transferência da instalação para um novo endereço.",
    assuntoChamado: "MUDANÇA DE ENDEREÇO",
    termos: [
      {
        id: "mudanca_endereco",
        titulo: "Termo de Mudança de Endereço",
        texto: "Li e aceito o Termo de Mudança de Endereço.",
        url: "/doc/mudanca_endereco",
      },
    ],
    valor: 200,
    permiteGratisFidelidade: true,
    permiteValorCustomizado: true,
    tipoLancamento: "mudanca_endereco",
    campos: [
      { name: "cep", label: "CEP", type: "number", required: true },
      { name: "rua", label: "Novo endereço (rua)", type: "text", required: true },
      { name: "numero", label: "Número (ou S/N)", type: "text", required: true },
      { name: "bairro", label: "Novo bairro", type: "text", required: true },
      { name: "cidade", label: "Cidade", type: "text", required: true },
      {
        name: "estado",
        label: "Estado",
        type: "select",
        required: true,
        fonte: "estados",
      },
      CAMPO_OBSERVACAO,
    ],
    criarContrato: (params) => ZapSign.createContractMudancaEndereco(params),
  },
  {
    id: "alteracao_plano",
    nomeServicoTemplate: "Alteração de Plano",
    nome: "Alteração de Plano",
    descricao: "Troca do plano contratado por outro disponível.",
    assuntoChamado: "ALTERAÇÃO DE PLANO",
    termos: [
      {
        id: "altera_plano",
        titulo: "Termo de Alteração de Plano",
        texto: "Li e aceito o Termo de Alteração de Plano.",
        url: "/doc/altera_plano",
      },
    ],
    valor: 0,
    permiteGratisFidelidade: false,
    campos: [
      {
        name: "plano_escolhido",
        label: "Escolha o novo plano",
        type: "select",
        required: true,
        fonte: "planos",
      },
      CAMPO_OBSERVACAO,
    ],
    criarContrato: (params) => ZapSign.createContractAlteracaoPlano(params),
  },
  {
    id: "wifi_extendido",
    nomeServicoTemplate: "Wifi Extendido",
    nome: "Wifi Extendido",
    descricao:
      "Contratação de ponto adicional de Wifi Extendido para ampliar a cobertura.",
    assuntoChamado: "WIFI EXTENDIDO",
    termos: [
      {
        id: "wifi_extendido",
        titulo: "Termo de Wifi Extendido",
        texto: "Li e aceito o Termo de Wifi Extendido.",
        url: "/doc/wifi_extendido",
      },
    ],
    valor: 0,
    permiteGratisFidelidade: false,
    campos: [
      {
        name: "plano_escolhido",
        label: "Escolha o plano de Wifi Extendido",
        type: "select",
        required: true,
        fonte: "planos_wifi",
      },
      CAMPO_OBSERVACAO,
    ],
    criarContrato: (params) => ZapSign.createContractWifiExtendido(params),
  },
  {
    id: "troca_titularidade",
    nomeServicoTemplate: "Troca de Titularidade",
    nome: "Troca de Titularidade",
    descricao:
      "Transferência do contrato para um novo titular, com os dados e a contratação do novo responsável.",
    assuntoChamado: "TROCA DE TITULARIDADE",
    termos: [
      {
        id: "troca_de_titularidade",
        titulo: "Termo de Alteração de Titularidade",
        texto: "Li e aceito o Termo de Alteração de Titularidade.",
        url: "/doc/troca_de_titularidade",
      },
    ],
    valor: 0,
    permiteGratisFidelidade: false,
    campos: [
      { name: "nome", label: "Nome completo do novo titular", type: "text", required: true },
      { name: "cpf", label: "CPF ou CNPJ do novo titular", type: "number", required: true },
      { name: "rg", label: "RG ou IE (opcional)", type: "text", required: false },
      { name: "dataNascimento", label: "Data de nascimento", type: "date", required: true },
      { name: "celular", label: "Celular (com DDD)", type: "phone", required: true },
      { name: "celularSecundario", label: "Celular secundário", type: "phone", required: false },
      { name: "email", label: "E-mail", type: "email", required: true },
      { name: "cep", label: "CEP", type: "number", required: true },
      { name: "rua", label: "Rua", type: "text", required: true },
      { name: "numero", label: "Número", type: "text", required: true },
      { name: "bairro", label: "Bairro", type: "text", required: true },
      { name: "cidade", label: "Cidade", type: "text", required: true },
      { name: "estado", label: "Estado", type: "select", required: true, fonte: "estados" },
      {
        name: "plano_escolhido",
        label: "Escolha o plano",
        type: "select",
        required: true,
        fonte: "planos",
      },
      {
        name: "vencimento",
        label: "Dia do vencimento",
        type: "select",
        required: true,
        fonte: "vencimentos",
      },
      CAMPO_OBSERVACAO,
    ],
    criarContrato: (params) =>
      ZapSign.createContractTrocaTitularidadeTitular(params),
  },
];

export function buscarServico(id: string): ServicoWeb | undefined {
  return CATALOGO.find((s) => s.id === id);
}

/**
 * Serviços realmente disponíveis, segundo a tabela `zapsign_templates`.
 * Quem não tiver template cadastrado não aparece para gerar link, e o nome
 * exibido é o que estiver lá — renomear na tela de templates reflete aqui.
 *
 * Se o banco da API não responder, cai no catálogo estático para não
 * derrubar um atendimento em andamento.
 */
export async function listarServicos(): Promise<ServicoWeb[]> {
  try {
    const templates = await ApiMkDataSource.getRepository(
      ZapSignTemplates,
    ).find();

    const nomes = new Map<string, string>();
    for (const t of templates) {
      const chave = (t.nome_servico || "").trim().toLowerCase();
      if (chave) nomes.set(chave, t.nome_servico.trim());
    }

    return CATALOGO.filter((s) =>
      nomes.has(s.nomeServicoTemplate.toLowerCase()),
    ).map((s) => ({
      ...s,
      nome: nomes.get(s.nomeServicoTemplate.toLowerCase()) ?? s.nome,
    }));
  } catch (error) {
    console.error(
      "[catalogo] Falha ao ler zapsign_templates; usando catálogo estático:",
      error,
    );
    return CATALOGO;
  }
}

/** Igual a `listarServicos`, mas para um serviço só. */
export async function resolverServico(
  id: string,
): Promise<ServicoWeb | undefined> {
  const servicos = await listarServicos();
  return servicos.find((s) => s.id === id);
}

/** Todos os termos que o cliente precisa aceitar: gerais + os do serviço. */
export function termosDoServico(servico: ServicoWeb): Termo[] {
  return [...TERMOS_GERAIS, ...(servico.termos ?? [])];
}

/** Resolve as listas dinâmicas (planos, estados) para o formulário do cliente. */
export async function resolverCampos(
  servico: ServicoWeb,
): Promise<CampoServico[]> {
  const campos: CampoServico[] = [];
  for (const campo of servico.campos) {
    if (!campo.fonte) {
      campos.push(campo);
      continue;
    }
    let opcoes: Array<{ id: string; title: string }> = [];
    if (campo.fonte === "planos") opcoes = await getPlanosDoSistema();
    else if (campo.fonte === "planos_wifi") opcoes = await getPlanosWifiExtendido();
    else if (campo.fonte === "estados") opcoes = ESTADOS;
    else if (campo.fonte === "vencimentos") opcoes = VENCIMENTOS;
    campos.push({ ...campo, opcoes });
  }
  return campos;
}

/** Formas de pagamento disponíveis para o serviço. */
export function formasPagamento(servico: ServicoWeb) {
  // A cobrança da instalação só é definida depois da análise interna.
  if (servico.analiseManual) return [];
  if (servico.valor <= 0) {
    return [{ id: "sem_custo", titulo: "Sem custo adicional", valor: 0 }];
  }
  const formas: Array<{ id: string; titulo: string; valor: number }> = [];
  if (servico.permiteGratisFidelidade) {
    formas.push({
      id: "gratis",
      titulo: "Grátis com renovação contratual de 12 meses",
      valor: 0,
    });
  }
  formas.push({
    id: "pix",
    titulo: `Pagamento via Pix - R$ ${servico.valor.toFixed(2).replace(".", ",")}`,
    valor: servico.valor,
  });
  return formas;
}
