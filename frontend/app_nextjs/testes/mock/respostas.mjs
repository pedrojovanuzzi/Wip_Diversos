/**
 * Respostas do backend de mentira usado nos testes das páginas.
 *
 * Cada entrada: [método, caminho (string exata ou RegExp, sem o /api), resposta].
 * A resposta pode ser um valor (vira JSON) ou uma função (req, corpo, url) que
 * devolve { status, json }, só o valor, ou { invalido: "motivo" } quando o
 * pedido veio errado (o teste da página falha com o motivo).
 *
 * Tela nova chamando uma rota que não está aqui → o teste dela falha com
 * "rota sem mock". Acrescente a rota abaixo, no formato que a API devolve.
 */

// Usuários de teste: o token decide o nível (o cookie "user" guarda o token).
export const USUARIOS = {
  "teste-n0": { id: 900, login: "teste.n0", permission: 0 },
  "teste-n1": { id: 901, login: "teste.n1", permission: 1 },
  "teste-n2": { id: 902, login: "teste.n2", permission: 2 },
  "teste-n5": { id: 905, login: "teste.n5", permission: 5 },
};

const HOJE = "2026-11-26";
const funcionario = { id: 1, name: "Fulano Teste", role: "Técnico", cpf: "00000000000", active: true };

const titulo = {
  id: 501, tipo: "mensalidade", status: "aberto", datavenc: "2026-12-10", datapag: null,
  nossonum: "123", valor: "99.90", valorpag: null, coletor: null, formapag: null,
  num_retornos: 0, linhadig: null, uuid_lanc: "u-501", obs: null, recibo: null,
  referencia: "12/2026", percmulta: "2", percmora: "1", atrelados: [], valorTotal: 99.9,
  notas: 0, bolix: null,
};

// ---------- gráfico de instalações ----------
const CAT = { instalacao: 3, renovacao: 1, migracao: 0, mudanca: 1, troca: 0, cancelamento: 1 };
const CRESC = { instalacao: 10, renovacao: null, migracao: null, mudanca: 0, troca: null, cancelamento: -5 };
const meses12 = (f) => Array.from({ length: 12 }, (_, i) => f(i + 1));
const bloco = { range: { start: "2026-10-01", end: "2026-10-31" }, totals: CAT, growth: CRESC };
const serieAno = (year) => ({ year, totals: CAT, netGrowth: 2, cancellationRate: 10 });
const grafico = {
  stats: [{ day: 1, ...CAT }],
  totals: CAT,
  yearTotals: CAT,
  comparisons: { previousMonth: bloco, previousYearSameMonth: bloco, previousYear: bloco },
  performance: {
    daysInMonth: 30, activeDays: 1,
    avgPerDay: { instalacao: 0.1, renovacao: 0, cancelamento: 0 },
    peakInstallDay: { day: 1, total: 3 }, lowInstallDay: { day: 1, total: 3 },
    netGrowth: { month: 2, year: 2, previousMonth: 1, previousYearSameMonth: 1, previousYear: 10 },
    cancellationRate: { month: 10, year: 10, previousMonth: null, previousYearSameMonth: null, previousYear: null },
  },
  month: 11, year: 2026,
};
const tendencia = {
  year: 2026,
  currentYear: { totals: CAT, monthly: meses12((month) => ({ month, ...CAT })), cumulative: meses12((month) => ({ month, totals: CAT })) },
  previousYear: { year: 2025, totals: CAT, monthly: meses12((month) => ({ month, ...CAT })), cumulative: meses12((month) => ({ month, totals: CAT })) },
  comparisons: {
    yearGrowth: CRESC, yearGrowthFullYear: CRESC,
    monthOverMonth: meses12((month) => ({ month, growth: CRESC })),
    yearOverYear: meses12((month) => ({ month, growth: CRESC })),
    cutoffMonth: 11, comparableTotals: { current: CAT, previous: CAT },
  },
  movingAverage: meses12((month) => ({ month, instalacao: 3, cancelamento: 1 })),
};

// ---------- CODEF ----------
const linhaCodef = (mes, nome) => ({
  mes, nome, rob: 1000, descontos: 0, rol: 1000, pessoal: 100, link: 100, manutencao: 0,
  aluguel: 0, energia: 0, marketing: 0, outras: 0, totalDespesas: 200, ebitda: 800,
  tributoDas: 50, tributoOutros: 0, cargaTributaria: 5, emprestimos: 0, caixa: 0,
  dividaLiquida: 0, capex: 0, financeiro: 0, naoClassificado: 0, manualPreenchido: false,
  fechado: true, observacao: null,
});

export const RESPOSTAS = [
  // ---------- login / layout ----------
  ["POST", "/auth/validate", (req) => {
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const user = USUARIOS[token];
    return user ? { user, token } : { status: 401, json: { message: "Token Inválido" } };
  }],
  ["GET", "/Pix/notificacoesPagamentos", { pagamentos: [], alertas: [], pendencias: [] }],

  // ---------- equipe ----------
  ["GET", /^\/auditoria\/filtros$/, { usuarios: ["teste.n5"], modulos: ["auth"] }],
  ["GET", "/auditoria", {
    registros: [{
      id: 1, user_id: 905, user_login: "teste.n5", acao: "LOGIN", modulo: "auth", metodo: "POST",
      rota: "/api/auth/login", status_code: 200, descricao: "Entrou", dados: null, ip: "127.0.0.1",
      user_agent: "teste", criado_em: `${HOJE}T12:00:00.000Z`,
    }],
    total: 1, pagina: 1, paginas: 1,
  }],
  ["GET", "/auth/users", { usuarios: [{ id: 905, login: "teste.n5", permission: 5 }], proximoId: 906 }],
  ["GET", "/time-tracking/employee", [funcionario]],
  ["GET", "/time-tracking/map-records", []],
  ["GET", /^\/time-tracking\/records\/date\/\d+$/, []],
  ["GET", /^\/time-tracking\/records\/\d+$/, []],
  ["GET", /^\/time-tracking\/overtime\//, []],
  ["GET", "/phone-location", []],
  ["GET", "/files/list", []],

  // ---------- atendimento ----------
  ["GET", "/solicitacao-servico", { data: [], links_abertos: [], totalPages: 0, page: 1 }],
  ["GET", "/service-links/catalogo", [{
    id: "instalacao", nome: "Instalação", descricao: "Instalação de internet", valor: 350,
    permiteGratisFidelidade: false, permiteValorCustomizado: true, parDeLinks: false,
    clienteNovo: true, analiseManual: false,
  }]],
  ["GET", "/chamados-ficha", { data: [], totalPages: 1, page: 1 }],
  ["GET", /^\/service-links\/publico\/[^/]+$/, {
    servico: { id: "instalacao", nome: "Instalação" }, etapa: "identificar", cliente: null,
    cadastros: null, formas_pagamento: [], campos: [], resultado: null,
  }],
  ["GET", "/feedback/resumo", {
    internet: [{ note: 10, count: 3 }], service: [{ note: 9, count: 1 }], responseTime: [],
    recommend: [{ note: 1, count: 2 }], solved: [], technician: [],
  }],
  ["GET", /^\/feedback\/NoteFeedbackOpnion/, []],
  ["GET", /^\/feedback\/[^/]+$/, { used: false }],
  ["GET", "/zapsign-templates", []],
  ["GET", "/whatsapp-test/flows", []],

  // ---------- financeiro / fiscal ----------
  ["GET", "/mensalidades/clientes", {
    clientes: [{
      id: 1, uuid: null, login: "cliente.teste", nome: "Cliente Teste", plano: "100MB", ip: "10.0.0.2",
      ramal: null, bloqueado: "nao", cli_ativado: "s", status_corte: "full", observacao: null,
      rem_obs: null, abertos: 1, automatico: false,
    }],
    total: 1,
  }],
  ["GET", /^\/mensalidades\/clientes\/[^/]+\/faturas$/, {
    cliente: { login: "cliente.teste", nome: "Cliente Teste", plano: "100MB", email: null, obs: null },
    automatico: { automatico: false, atualizadoPor: null, atualizadoEm: null },
    abertos: [titulo], pagos: [], totalAberto: 99.9, provedor: null,
    mkauthUrl: "http://mkauth.teste", nivel: 5,
  }],
  ["GET", "/mensalidades/relatorio", { linhas: [] }],
  ["GET", "/codef", {
    ano: 2026, base: "vencimento", tributos: "todos",
    meses: [linhaCodef(10, "Outubro")], total: linhaCodef(0, "Total"), planos: [], naoClassificados: [],
  }],
  ["GET", "/licenca/mensalidades", []],
  ["GET", "/chamados/analytics/instalacoes", grafico],
  ["GET", "/chamados/analytics/instalacoes/trend", tendencia],
  ["GET", "/chamados/analytics/instalacoes/anos", {
    startYear: 2022, endYear: 2026, yearsShown: 5, ytdReference: { month: 11, day: 26 },
    series: [serieAno(2025), serieAno(2026)], seriesYtd: [serieAno(2025), serieAno(2026)],
    yearOverYear: [{ year: 2026, growth: CRESC }], yearOverYearYtd: [{ year: 2026, growth: CRESC }],
    overallGrowth: CRESC, overallGrowthFullYear: CRESC, averagePerYear: CAT,
  }],
  ["GET", "/chamados/analytics/clientes/ativados", {
    startYear: 2025, endYear: 2026, series: [{ year: 2026, total: 100, desativados: 5 }],
    yearOverYear: [{ year: 2026, growth: 5 }], overallGrowth: 5,
  }],
  ["GET", "/chamados/analytics/instalacoes/diagnostico", { breakdown: [{ assunto: "Instalação", total: 3 }] }],
  ["GET", "/chamados/analytics/instalacoes/historico-mensal", {
    startYear: 2022, endYear: 2026, series: [{ year: 2026, monthly: meses12((month) => ({ month, ...CAT })) }],
  }],
  ["GET", "/chamados/analytics/clientes/mensal", { year: 2026, series: meses12((month) => ({ month, total: 100 })) }],
  ["POST", "/nfse/BuscarClientes", []],
  ["POST", "/nfse/BuscarClientesServicos", []],
  ["GET", "/nfse/ultimoRps", { ultimoRps: 10 }],
  ["POST", "/NFCom/buscarClientes", []],
  ["GET", "/NFCom/getNfcomByChaveDeOlhoNoImposto", { Chave: "" }],
  ["GET", "/NFCom/declaracaoQuitacao/declaranteDefaults", {}],
  ["GET", "/NFCom/declaracaoQuitacao/listar", []],
  ["GET", "/licenca/listar", []],

  // ---------- serviços do cliente ----------
  ["GET", "/sercontratos/clientes", { clientes: [] }],
  ["GET", "/cameras/admin/planos", { plans: [] }],
  ["GET", "/cameras/admin/clientes", { items: [] }],
  ["GET", /^\/cameras\/setup\/[^/]+$/, { login: "cliente.teste" }],
  ["GET", "/streaming", { items: [] }],
  ["GET", "/tv-wip", { contas: [], total: 0, paginas: 1, resumo: { ativas: 0, desativadas: 0 } }],
  ["GET", "/tv-wip/pacotes", { pacotes: [] }],
  ["GET", /^\/watchtv-conta\/[^/]+$/, { nome: "Cliente Teste", substituiConta: false }],

  // ---------- rede ----------
  ["GET", "/ClientAnalytics/ClientList", []],
  // abrir com ?pppoe= busca o cliente e, em seguida, desconexões, sinal e Mikrotik
  ["POST", "/ClientAnalytics/info", (req, corpo) =>
    typeof corpo?.pppoe === "string"
      ? { user: { suspensao: false, sinal_onu: "-20.5", pppoe_up: true, ip_duplicado: false }, suspensao: false }
      : { invalido: "info sem pppoe" }],
  ["POST", "/ClientAnalytics/Desconections", { desconexoes: [] }],
  ["POST", "/ClientAnalytics/SinalOnu", { respostaTelnet: null }],
  ["POST", "/ClientAnalytics/Mikrotik", { tests: null, conectado: false }],
  ["POST", "/ClientAnalytics/TempoReal", []],
  ["GET", "/ClientAnalytics/Consumo", {
    range: { start: "2026-10-28", end: "2026-11-26" },
    totals: { download: 0, upload: 0, total: 0 }, topConsumers: [], timeSeries: [],
  }],
  ["GET", "/pm2-logs", []],
  ["POST", "/ServerLogs/AccessFile", (req, corpo) =>
    typeof corpo?.path === "string" ? { content: "linha 1\nlinha 2" } : { invalido: "AccessFile sem path" }],

  // ---------- WhatsApp ----------
  ["GET", "/whatsapp/conversations", { conversations: [] }],
  ["GET", "/whatsapp/Lastconversation", []],
  ["POST", "/whatsapp/conversation", { conversations: [] }],
  ["GET", "/ClientAnalytics/ClientsWithoutQueue", []],
  ["GET", "/ClientAnalytics/Logs", []],
  ["GET", /^\/ClientAnalytics\/Monitor\/[^/]+$/, {
    monitor: { id: 1, pppoe: "cliente.teste", status: "encerrado", criado_em: `${HOJE}T12:00:00.000Z` },
    eventos: [],
  }],
  ["GET", "/servidores-acesso", []],
  ["GET", "/ServerLogs", []],
  // O caminho precisa chegar como texto (pegou um bug: a constante vinha de um
  // arquivo "use client" e o servidor mandava o corpo sem o path).
  ["POST", "/ServerLogs/FoldersRecursion", (req, corpo) =>
    typeof corpo?.path === "string" ? [] : { invalido: "FoldersRecursion sem path" }],
  ["GET", /^\/DosProtect\//, []],
];
