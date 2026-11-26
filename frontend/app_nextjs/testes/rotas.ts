/**
 * Páginas testadas. nível: "pub" = sem login; 0 = só logado; 1/2/5 = mínimo.
 * Rotas dinâmicas usam um valor de exemplo. Página nova → acrescente aqui.
 */
export type Nivel = "pub" | 0 | 1 | 2 | 5;

export const ROTAS: [string, Nivel][] = [
  ["/", 1],
  ["/auth/login", "pub"],

  // Principal
  ["/TimeTracking/ClockIn", "pub"],
  ["/feedbackCreate", 2],
  ["/feedback/Opnion", "pub"],
  ["/feedback/joao/abc-123", "pub"],

  // Atendimento
  ["/solicitacoes-servico", 2],
  ["/servicos/links", 2],
  ["/s/token-teste", "pub"],
  ["/chamados/ficha-tecnica", 0],
  ["/chamados/ficha-tecnica/nova", 0],
  ["/Whatsapp", 2],
  ["/Whatsapp/1", 2],
  ["/whatsapp/broadcast", 5],
  ["/whatsapp-teste", 0],

  // Financeiro e fiscal
  ["/Pix", 2],
  ["/Pix/ultimo", 2],
  ["/Pix/todos", 2],
  ["/Pix/aberto", 2],
  ["/Pix/varias", 2],
  ["/Pix/findPaid", 2],
  ["/Pix/automatico", 2],
  ["/Pix/automaticoAdmin", 5],
  ["/Pix/Admin", 5],
  ["/Pix/Cancelar/Cobranca", 2],
  ["/mensalidades", 2],
  ["/mensalidades?busca=teste&pagina=1", 2],
  ["/mensalidades/relatorio", 5],
  ["/mensalidades/cliente.teste", 2],
  ["/calculadora-debitos", 2],
  ["/codef", 5],
  ["/NFSE", 2],
  ["/NFSE/ServicosAdicionais", 2],
  ["/BuscarNfseGerada", 2],
  ["/GerarNotaDeServicoIndependente", 2],
  ["/Nfcom", 2],
  ["/Nfcom/Buscar", 1],
  ["/Nfcom/DeclaracaoQuitacao", 2],
  ["/Nfcom/DeclaracoesQuitacao", 2],
  ["/nfe/comodato", 2],
  ["/NfeComodato", 2],
  ["/BuscarNfe", 2],
  ["/ZapSignConfig", 2],
  ["/zapsign-config", 5],
  ["/zapsign-teste", 0],
  ["/Prefeitura/Login", "pub"],
  ["/Prefeitura/CodeOtp", "pub"],

  // Serviços do cliente
  ["/SerContratos", 0],
  ["/Streaming", 0],
  ["/tv-wip", 2],
  ["/arquivos", 2],
  ["/licencas", 5],
  ["/licencas?aba=mensalidades", 5],
  ["/Cameras/Admin", 5],
  ["/Cameras/Setup/uuid-teste", "pub"],
  ["/WatchTv/Conta/token-teste", "pub"],

  // Rede e infraestrutura
  ["/ClientAnalytics", 2],
  ["/ClientAnalytics?pppoe=cliente.teste", 2],
  ["/ClientAnalytics/Logs", 2],
  ["/ClientAnalytics/Servidores", 5],
  ["/ClientAnalytics/SemQueue", 2],
  ["/ClientAnalytics/Consumo", 2],
  ["/ClientAnalytics/Monitor/1", 2],
  ["/DDDOS", 2],
  ["/Onu", 2],
  ["/Onu/AutorizarOnu", 2],
  ["/Onu/DesautorizarOnu", 2],
  ["/Onu/Settings", 5],
  ["/PowerDns", 2],
  ["/ServerLogs", 2],
  ["/LogViewer?arquivo=/var/log/cgnat/syslog/teste.log&pasta=/var/log/cgnat/syslog", 2],
  ["/ClientLogsSearch", 2],
  ["/Pm2Logs", 5],

  // Equipe e ponto
  ["/TimeTracking/Admin", 5],
  ["/TimeTracking/Report", 5],
  ["/TimeTracking/Map", 5],
  ["/phone-location", 2],
  ["/grafico-instalacoes", 2],
  ["/Create", 5],
  ["/auditoria", 5],

  // Totem e documentos
  ["/TokenAutoAtendimento", "pub"],
  ["/TokenAutoAtendimento?ocioso=false", "pub"],
  ["/TokenAutoAtendimento/pagar-fatura", "pub"],
  ["/TokenAutoAtendimento/criar-chamado", "pub"],
  ["/TokenAutoAtendimento/fazer-cadastro", "pub"],
  ["/doc/contrato", "pub"],
];

/** Portaria: quem não tem o nível tem que cair no login. [rota, token usado] */
export const BARRADAS: [string, string | null][] = [
  ["/mensalidades", null],
  ["/licencas", "teste-n2"],
  ["/Create", "teste-n2"],
  ["/NFSE", "teste-n1"],
  ["/auditoria", "teste-n1"],
  ["/chamados/ficha-tecnica", null],
];
