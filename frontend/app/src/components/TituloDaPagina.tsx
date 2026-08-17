import { useEffect } from "react";
import { matchPath, useLocation } from "react-router-dom";

const SUFIXO = "Wip Diversos";

// Mesma marcação usada pelo banner de desenvolvimento, para não perder o [DEV]
// ao trocar o título a cada rota.
const PREFIXO =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "[DEV] "
    : "";

/**
 * Título de cada rota. A chave é o mesmo padrão usado no <Route>, então rotas
 * com parâmetro (":id") também são reconhecidas.
 */
const TITULOS: Record<string, string> = {
  "/": "Início",
  "/auth/login": "Entrar",
  "/Create": "Criar Usuário",
  "/licencas": "Licenças",

  "/feedbackCreate": "Pesquisa de Satisfação",
  "/feedback/Opnion": "Opiniões dos Clientes",
  "/feedback/:technician/:id": "Avaliação do Atendimento",

  "/servicos/links": "Gerar Link de Serviço",
  "/solicitacoes-servico": "Serviços Solicitados",
  "/s/:token": "Solicitação de Serviço",

  "/chamados/ficha-tecnica": "Fichas Técnicas",
  "/chamados/ficha-tecnica/nova": "Nova Ficha Técnica",

  "/arquivos": "Arquivos",
  "/doc/:fileName": "Documento",
  "/grafico-instalacoes": "Gráfico de Instalações",
  "/phone-location": "Localização por Telefone",

  "/NFSE": "NFS-e",
  "/NFSE/ServicosAdicionais": "NFS-e — Serviços Adicionais",
  "/BuscarNfseGerada": "Buscar NFS-e",
  "/GerarNotaDeServicoIndependente": "Nota de Serviço Independente",
  "/Nfcom": "NFCom",
  "/Nfcom/Buscar": "Buscar NFCom",
  "/Nfcom/DeclaracaoQuitacao": "Declaração de Quitação",
  "/Nfcom/DeclaracoesQuitacao": "Declarações de Quitação",
  "/BuscarNfe": "Buscar NF-e",
  "/NfeComodato": "NF-e de Comodato",
  "/nfe/comodato": "NF-e de Comodato",

  "/Pix": "Pix",
  "/Pix/:tipo": "Pix",
  "/Pix/Admin": "Pix — Administração",
  "/Pix/Cancelar/Cobranca": "Cancelar Cobrança Pix",
  "/Pix/automatico": "Pix Automático",
  "/Pix/automaticoAdmin": "Pix Automático — Administração",
  "/Pix/findPaid": "Pix Pagos",

  "/SerContratos": "Serviços Contratados",
  "/Streaming": "Streaming",
  "/ZapSignConfig": "Configurações do ZapSign",
  "/zapsign-config": "Configurações do ZapSign",
  "/zapsign-teste": "Teste do ZapSign",

  "/Whatsapp": "WhatsApp",
  "/Whatsapp/:id": "WhatsApp — Conversa",
  "/whatsapp/broadcast": "WhatsApp — Disparo",
  "/whatsapp-teste": "Teste do WhatsApp",

  "/Onu": "ONUs",
  "/Onu/AutorizarOnu": "Autorizar ONU",
  "/Onu/DesautorizarOnu": "Desautorizar ONU",
  "/Onu/Settings": "Configurações de ONU",

  "/ClientAnalytics": "Análise de Clientes",
  "/ClientAnalytics/Consumo": "Consumo dos Clientes",
  "/ClientAnalytics/Logs": "Logs dos Clientes",
  "/ClientAnalytics/Monitor/:id": "Monitoramento do Cliente",
  "/ClientAnalytics/SemQueue": "Clientes sem Queue",
  "/ClientAnalytics/Servidores": "Servidores",
  "/ClientLogsSearch": "Busca de Logs",

  "/Cameras/Admin": "Câmeras",
  "/Cameras/Setup/:uuid": "Configurar Câmera",

  "/TimeTracking/Admin": "Ponto — Administração",
  "/TimeTracking/ClockIn": "Registrar Ponto",
  "/TimeTracking/Map": "Ponto — Mapa",
  "/TimeTracking/Report": "Ponto — Relatório",

  "/TokenAutoAtendimento": "Autoatendimento",
  "/TokenAutoAtendimento/criar-chamado": "Abrir Chamado",
  "/TokenAutoAtendimento/fazer-cadastro": "Fazer Cadastro",
  "/TokenAutoAtendimento/pagar-fatura": "Pagar Fatura",

  "/Prefeitura/Login": "Prefeitura — Acesso",
  "/Prefeitura/CodeOtp": "Prefeitura — Código",

  "/DDDOS": "Proteção DDoS",
  "/PowerDns": "PowerDNS",
  "/LogViewer": "Visualizador de Logs",
  "/Pm2Logs": "Logs do PM2",
  "/ServerLogs": "Logs do Servidor",
};

/** Ajusta o título da aba conforme a rota aberta. */
export const TituloDaPagina = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const rota = Object.keys(TITULOS).find((padrao) =>
      matchPath({ path: padrao, end: true }, pathname),
    );
    const titulo = rota ? TITULOS[rota] : null;
    document.title = titulo
      ? `${PREFIXO}${titulo} — ${SUFIXO}`
      : `${PREFIXO}${SUFIXO}`;
  }, [pathname]);

  return null;
};

export default TituloDaPagina;
