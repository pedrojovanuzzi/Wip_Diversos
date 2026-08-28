import { createPortal } from "react-dom";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { GrDocumentNotes } from "react-icons/gr";

import {
  HiBars3,
  HiChevronLeft,
  HiChevronRight,
  HiDocumentText,
  HiHome,
} from "react-icons/hi2";
import { MdDns, MdOutlineFeedback } from "react-icons/md";
import {
  FaUserPlus,
  FaWhatsapp,
  FaFileInvoice,
  FaSearch,
  FaRegFolder,
  FaClock,
  FaUsers,
  FaClipboardList,
  FaToolbox,
  FaMapMarkedAlt,
  FaLocationArrow,
  FaDesktop,
  FaChartLine,
  FaFilePdf,
  FaList,
  FaTerminal,
  FaNetworkWired,
  FaCloudUploadAlt,
  FaChartBar,
  FaLink,
  FaServer,
} from "react-icons/fa";
import { IoMdAnalytics } from "react-icons/io";

import { FaPlugCirclePlus } from "react-icons/fa6";
import { ImExit } from "react-icons/im";
import { FaPix } from "react-icons/fa6";
import { FaFlask } from "react-icons/fa";

import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Cookies from "js-cookie";
import { BsFillSendPlusFill, BsCameraVideoFill } from "react-icons/bs";

type Color = {
  color?: string;
  className?: string;
};

/**
 * Um item do menu. `visivel` recebe o nível de permissão e decide — as regras
 * são exatamente as que existiam no JSX antes, só que declaradas em um lugar.
 */
interface ItemMenu {
  to?: string;
  /** Ação em vez de navegação (hoje só o logout). */
  acao?: "sair";
  icon: React.ReactNode;
  title: string;
  description: string;
  visivel: (permissao: number) => boolean;
}

interface SecaoMenu {
  titulo: string;
  itens: ItemMenu[];
}

const ico = (Componente: React.ElementType) => (
  <Componente className="size-5 shrink-0" />
);

/** Ambiente local: libera a tela de teste de documentos. */
const ehLocalhost = () =>
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

/**
 * Menu agrupado por assunto. Antes eram 34 ícones sem rótulo numa grade de duas
 * colunas: para achar qualquer coisa era preciso passar o mouse item a item.
 * Nenhum link foi removido — só reorganizados e nomeados.
 */
const SECOES: SecaoMenu[] = [
  {
    titulo: "Principal",
    itens: [
      {
        to: "/",
        icon: ico(HiHome),
        title: "Início",
        description: "Página inicial do sistema",
        visivel: (p) => p >= 2,
      },
      {
        to: "/TimeTracking/ClockIn",
        icon: ico(FaClock),
        title: "Registrar Ponto",
        description: "Bater ponto (Entrada/Saída)",
        visivel: () => true,
      },
      {
        to: "/feedbackCreate",
        icon: ico(MdOutlineFeedback),
        title: "Feedback",
        description: "Enviar sugestões ou reportar erros",
        visivel: (p) => p >= 2,
      },
    ],
  },
  {
    titulo: "Atendimento",
    itens: [
      {
        to: "/solicitacoes-servico",
        icon: ico(FaList),
        title: "Serviços Solicitados",
        description: "Ver solicitações de serviços",
        visivel: (p) => p >= 2,
      },
      {
        to: "/servicos/links",
        icon: ico(FaLink),
        title: "Gerar Link de Serviço",
        description: "Link para o cliente solicitar serviços pelo navegador",
        visivel: (p) => p >= 2,
      },
      {
        to: "/chamados/ficha-tecnica",
        icon: ico(FaToolbox),
        title: "Ficha Técnica",
        description: "Fichas técnicas de chamados em campo",
        visivel: (p) => p >= 2,
      },
      {
        to: "/Whatsapp",
        icon: ico(FaWhatsapp),
        title: "WhatsApp",
        description: "Integração e envio de mensagens",
        visivel: (p) => p >= 2,
      },
      {
        to: "/whatsapp/broadcast",
        icon: ico(BsFillSendPlusFill),
        title: "Disparo em Massa",
        description: "Enviar mensagens para múltiplos clientes",
        visivel: (p) => p >= 5,
      },
    ],
  },
  {
    titulo: "Financeiro e Fiscal",
    itens: [
      {
        to: "/Pix",
        icon: ico(FaPix),
        title: "Pix",
        description: "Gestão de pagamentos via Pix",
        visivel: (p) => p >= 2,
      },
      {
        to: "/NFSE",
        icon: ico(HiDocumentText),
        title: "NFSe",
        description: "Emissão e gestão de Nota Fiscal de Serviço",
        visivel: (p) => p >= 2,
      },
      {
        to: "/Nfcom",
        icon: ico(FaFileInvoice),
        title: "NFCom",
        description: "Emissão e gestão de Nota Fiscal de Telecom",
        visivel: (p) => p >= 2,
      },
      {
        to: "/nfe/comodato",
        icon: ico(GrDocumentNotes),
        title: "NFe Comodato",
        description: "Remessa e retorno de equipamentos",
        visivel: (p) => p >= 2,
      },
      {
        to: "/Nfcom/Buscar",
        icon: ico(FaSearch),
        title: "Buscar NFCom",
        description: "Pesquisar notas fiscais",
        visivel: (p) => p === 1,
      },
      {
        to: "/zapsign-config",
        icon: ico(FaFilePdf),
        title: "Config ZapSign",
        description: "Configurar templates ZapSign",
        visivel: (p) => p >= 5,
      },
      {
        to: "/zapsign-teste",
        icon: ico(FaFlask),
        title: "Teste Docs",
        description: "Testar geração de documentos",
        visivel: (p) => p >= 5 && ehLocalhost(),
      },
    ],
  },
  {
    titulo: "Serviços do Cliente",
    itens: [
      {
        to: "/SerContratos",
        icon: ico(BsCameraVideoFill),
        title: "Streaming / Câmeras",
        description: "Contratar serviços adicionais de streaming e câmeras",
        visivel: (p) => p >= 2,
      },
      {
        to: "/arquivos",
        icon: ico(FaCloudUploadAlt),
        title: "Compartilhar Arquivos",
        description: "Enviar arquivos e gerar links públicos de download",
        visivel: (p) => p >= 2,
      },
      {
        to: "/licencas",
        icon: ico(FaDesktop),
        title: "Licenças",
        description: "Gerenciamento de licenças de software",
        visivel: (p) => p >= 5,
      },
    ],
  },
  {
    titulo: "Rede e Infraestrutura",
    itens: [
      {
        to: "/ClientAnalytics",
        icon: ico(IoMdAnalytics),
        title: "Analytics",
        description: "Análise de dados de clientes",
        visivel: (p) => p >= 2,
      },
      {
        to: "/ClientAnalytics/Servidores",
        icon: ico(FaServer),
        title: "Servidores",
        description: "Cadastro de Mikrotiks e OLTs usados nas consultas",
        visivel: (p) => p >= 2,
      },
      {
        to: "/ClientAnalytics/SemQueue",
        icon: ico(FaNetworkWired),
        title: "Sem Queue",
        description:
          "Clientes conectados que não possuem fila (queue) no Mikrotik",
        visivel: (p) => p >= 2,
      },
      {
        to: "/ClientAnalytics/Consumo",
        icon: ico(FaChartBar),
        title: "Consumo",
        description:
          "Consumo de download/upload dos clientes e ranking dos que mais consomem",
        visivel: (p) => p >= 2,
      },
      {
        to: "/Onu",
        icon: ico(FaPlugCirclePlus),
        title: "ONU",
        description: "Gerenciamento de ONUs",
        visivel: (p) => p >= 2,
      },
      {
        to: "/PowerDns",
        icon: ico(MdDns),
        title: "DNS",
        description: "Gerenciamento de PowerDNS",
        visivel: (p) => p >= 2,
      },
      {
        to: "/ServerLogs",
        icon: ico(FaRegFolder),
        title: "Logs",
        description: "Visualizar logs do servidor",
        visivel: (p) => p >= 2,
      },
      {
        to: "/Pm2Logs",
        icon: ico(FaTerminal),
        title: "PM2 Logs",
        description: "Visualizar logs do PM2 (todos, normais e erros)",
        visivel: (p) => p >= 5,
      },
    ],
  },
  {
    titulo: "Equipe e Ponto",
    itens: [
      {
        to: "/TimeTracking/Admin",
        icon: ico(FaUsers),
        title: "Gestão de Ponto",
        description: "Administração de registros de ponto",
        visivel: (p) => p >= 5,
      },
      {
        to: "/TimeTracking/Report",
        icon: ico(FaClipboardList),
        title: "Relatórios",
        description: "Relatórios detalhados de ponto",
        visivel: (p) => p >= 5,
      },
      {
        to: "/TimeTracking/Map",
        icon: ico(FaMapMarkedAlt),
        title: "Mapa",
        description: "Visualização de localização em tempo real",
        visivel: (p) => p >= 5,
      },
      {
        to: "/phone-location",
        icon: ico(FaLocationArrow),
        title: "Localização",
        description: "Mapa com a localização dos funcionários",
        visivel: (p) => p >= 2,
      },
      {
        to: "/grafico-instalacoes",
        icon: ico(FaChartLine),
        title: "Gráfico Instalações",
        description: "Acompanhe instalações mensais",
        visivel: (p) => p >= 2,
      },
      {
        to: "/Create",
        icon: ico(FaUserPlus),
        title: "Novo Usuário",
        description: "Cadastrar novos usuários no sistema",
        visivel: (p) => p >= 5,
      },
    ],
  },
];

/** Sai da conta. Fica fora das seções: é o rodapé fixo do menu. */
const ITEM_SAIR: ItemMenu = {
  acao: "sair",
  icon: ico(ImExit),
  title: "Sair",
  description: "Encerrar sessão",
  // Mantém quem via o botão antes: nível 1 e nível 2 ou mais.
  visivel: (p) => p === 1 || p >= 2,
};

/** Normaliza para busca sem acento e sem caixa. */
const normalizar = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

interface LinhaProps {
  item: ItemMenu;
  ativo: boolean;
  onNavegar: () => void;
  onSair: () => void;
}

const LinhaMenu = ({ item, ativo, onNavegar, onSair }: LinhaProps) => {
  const [mostrarDica, setMostrarDica] = useState(false);
  const [posicao, setPosicao] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLLIElement>(null);

  const aoEntrar = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPosicao({ top: rect.top + rect.height / 2, left: rect.right + 12 });
    setMostrarDica(true);
  };

  const classes = `flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-left transition-colors ${
    ativo
      ? "bg-green-500/15 text-green-300 font-semibold"
      : "text-gray-200 hover:bg-white/10 hover:text-white"
  }`;

  const conteudo = (
    <>
      {/* Marca da esquerda: indica o item aberto sem depender só da cor. */}
      <span
        className={`h-5 w-1 rounded-full shrink-0 ${
          ativo ? "bg-green-400" : "bg-transparent"
        }`}
      />
      {item.icon}
      <span className="truncate">{item.title}</span>
    </>
  );

  return (
    <li
      ref={ref}
      onMouseEnter={aoEntrar}
      onMouseLeave={() => setMostrarDica(false)}
    >
      {item.acao === "sair" ? (
        <button type="button" onClick={onSair} className={classes}>
          {conteudo}
        </button>
      ) : (
        <Link to={item.to!} onClick={onNavegar} className={classes}>
          {conteudo}
        </Link>
      )}

      {/* A descrição continua disponível: vira dica ao passar o mouse. */}
      {mostrarDica &&
        createPortal(
          <div
            className="fixed p-3 bg-stone-900 border border-stone-700 text-white text-sm rounded-md shadow-xl z-[9999] pointer-events-none"
            style={{
              top: posicao.top,
              left: posicao.left,
              transform: "translateY(-50%)",
            }}
          >
            <h3 className="font-bold text-green-400 mb-1 text-sm">
              {item.title}
            </h3>
            <p className="text-gray-300 text-xs font-light leading-snug max-w-[220px]">
              {item.description}
            </p>
            <div
              className="absolute top-1/2 right-full -translate-y-1/2 border-8 border-transparent border-r-stone-900"
              style={{ marginRight: -1 }}
            />
          </div>,
          document.body,
        )}
    </li>
  );
};

export const NavBar = ({ color = "black", className = "" }: Color) => {
  // Lembra se o menu ficou aberto — antes ele fechava a cada troca de página.
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem("navbar_aberta") === "1";
    } catch {
      return false;
    }
  });
  const [busca, setBusca] = useState("");
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  const { user } = useAuth();
  const permission = user?.permission || 0;
  const { pathname } = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("navbar_aberta", isOpen ? "1" : "0");
    } catch {
      /* navegador sem storage: só não lembra */
    }
  }, [isOpen]);

  // Esc fecha o menu.
  useEffect(() => {
    if (!isOpen) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [isOpen]);

  function clearCookies() {
    Cookies.remove("user");
    window.location.reload();
  }

  // Seções já filtradas por permissão e pelo texto da busca.
  const secoesVisiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return SECOES.map((secao) => ({
      titulo: secao.titulo,
      itens: secao.itens.filter(
        (item) =>
          item.visivel(permission) &&
          (!termo ||
            normalizar(item.title).includes(termo) ||
            normalizar(item.description).includes(termo)),
      ),
    })).filter((secao) => secao.itens.length > 0);
  }, [permission, busca]);

  const totalVisivel = useMemo(
    () => secoesVisiveis.reduce((soma, s) => soma + s.itens.length, 0),
    [secoesVisiveis],
  );

  /**
   * Rota ativa = o item cujo caminho mais específico casa com a URL. Sem isso,
   * "/ClientAnalytics" apareceria aceso junto com "/ClientAnalytics/Consumo".
   */
  const rotaAtiva = useMemo(() => {
    const caminhos = SECOES.flatMap((s) => s.itens)
      .map((i) => i.to)
      .filter((t): t is string => !!t);
    let melhor = "";
    for (const caminho of caminhos) {
      const casa =
        caminho === "/"
          ? pathname === "/"
          : pathname === caminho || pathname.startsWith(`${caminho}/`);
      if (casa && caminho.length > melhor.length) melhor = caminho;
    }
    return melhor;
  }, [pathname]);

  const fecharSeMobile = () => {
    if (isMobile) setIsOpen(false);
  };

  return (
    <div
      className={`z-10 relative sm:h-screen ${
        isOpen ? "sm:w-72" : "sm:w-0"
      } bg-stone-800 sm:fixed sm:top-0 sm:left-0 grid sm:grid-rows-[auto,1fr] p-4 sm:p-0 sm:pt-4 transition-all duration-300 ${className}`}
    >
      <nav className="sm:w-full sm:px-4 grid place-items-center relative">
        {isMobile ? (
          <HiBars3
            className="text-white cursor-pointer size-10"
            onClick={() => setIsOpen(!isOpen)}
          />
        ) : (
          <div
            className={`${isOpen ? "relative self-end justify-self-end" : "absolute left-10 top-5"} transition-all duration-300`}
          >
            {isOpen ? (
              <HiChevronLeft
                className="text-white cursor-pointer size-8 transition-all hover:text-green-400"
                onClick={() => setIsOpen(false)}
                title="Fechar menu (Esc)"
              />
            ) : (
              <HiChevronRight
                className={`text-${color} cursor-pointer size-10 transition-all hover:text-green-400`}
                onClick={() => setIsOpen(true)}
                title="Abrir menu"
              />
            )}
          </div>
        )}
      </nav>

      {isOpen && (
        <div className="w-full text-white flex flex-col min-h-0">
          <h2 className="text-center font-bold bg-red-500 p-2 text-sm">
            <span className="break-all whitespace-normal">{user?.login}</span>
          </h2>

          {/* Busca: com mais de 30 destinos, digitar é mais rápido que procurar. */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar no menu…"
                className="w-full bg-stone-900 border border-stone-700 rounded-md pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin scrollbar-thumb-green-600 scrollbar-track-gray-900">
            {totalVisivel === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-4 text-center">
                Nada encontrado para “{busca}”.
              </p>
            ) : (
              secoesVisiveis.map((secao) => (
                <div key={secao.titulo} className="mb-3">
                  <h3 className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    {secao.titulo}
                  </h3>
                  <ul className="space-y-0.5">
                    {secao.itens.map((item) => (
                      <LinhaMenu
                        key={item.to ?? item.title}
                        item={item}
                        ativo={!!item.to && item.to === rotaAtiva}
                        onNavegar={fecharSeMobile}
                        onSair={clearCookies}
                      />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          {ITEM_SAIR.visivel(permission) && (
            <div className="border-t border-stone-700 px-3 py-2">
              <ul>
                <LinhaMenu
                  item={ITEM_SAIR}
                  ativo={false}
                  onNavegar={fecharSeMobile}
                  onSair={clearCookies}
                />
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
