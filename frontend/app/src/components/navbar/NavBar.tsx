import { createPortal } from "react-dom";
import React, { useEffect, useState } from "react";
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
  FaMapMarkedAlt,
  FaDesktop,
} from "react-icons/fa";
import { IoMdAnalytics } from "react-icons/io";

import { FaPlugCirclePlus } from "react-icons/fa6";
import { ImExit } from "react-icons/im";
import { FaPix } from "react-icons/fa6";

import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Cookies from "js-cookie";
import { BsFillSendPlusFill } from "react-icons/bs";

type Color = {
  color?: string;
  className?: string;
};

interface NavItemProps {
  to?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
}

const NavItem = ({ to, icon, title, description, onClick }: NavItemProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const itemRef = React.useRef<HTMLLIElement>(null);

  const handleMouseEnter = () => {
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.top + rect.height / 2, // Center vertically relative to item
        left: rect.right + 10, // Position to the right with some gap
      });
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <li
      ref={itemRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="p-2 grid place-items-center col-span-2 group relative z-50"
    >
      {onClick ? (
        <button onClick={onClick}>{icon}</button>
      ) : (
        <Link to={to!}>{icon}</Link>
      )}

      {/* Portal Tooltip */}
      {isHovered &&
        createPortal(
          <div
            className="fixed p-3 bg-stone-900 border border-stone-700 text-white text-sm rounded-md shadow-xl z-[9999] pointer-events-none transition-all duration-200 opacity-0 animate-in fade-in zoom-in-95"
            style={{
              top: tooltipPos.top,
              left: tooltipPos.left,
              transform: "translateY(-50%)", // Perfect vertical centering
              opacity: 1, // Override opacity-0 from base class when rendered
            }}
          >
            <h3 className="font-bold text-green-400 mb-1 text-base">{title}</h3>
            <p className="text-gray-300 text-xs font-light leading-snug max-w-[200px]">
              {description}
            </p>

            {/* Arrow pointing left */}
            <div
              className="absolute top-1/2 right-full -translate-y-1/2 border-8 border-transparent border-r-stone-900"
              style={{ marginRight: -1 }} // Fine tune arrow connection
            ></div>
          </div>,
          document.body,
        )}
    </li>
  );
};

export const NavBar = ({ color = "black", className = "" }: Color) => {
  const [isOpen, setIsOpen] = useState(false);

  const { user } = useAuth();
  const permission = user?.permission || 0;

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function clearCookies() {
    Cookies.remove("user");
    window.location.reload();
  }

  return (
    <div
      className={`z-10 relative sm:h-screen  ${
        isOpen ? "sm:w-32" : "sm:w-0"
      } bg-stone-800 sm:fixed sm:top-0 sm:left-0 grid sm:grid-rows-[auto,1fr] p-4 sm:p-0 sm:pt-10 transition-all duration-300 ${className}`}
    >
      <nav className="sm:w-full sm:p-4 grid place-items-center relative">
        {/* Ícone de menu "HiBars3" para dispositivos móveis */}
        {isMobile ? (
          <HiBars3
            className="text-white cursor-pointer size-10"
            onClick={toggleMenu}
          />
        ) : (
          /* Ícones de setas para dispositivos maiores */
          <div
            className={`${isOpen ? "relative" : "absolute"} ${
              isOpen ? "" : "left-10 top-5"
            } transition-all duration-300`}
            // Ajuste a posição da seta quando o menu estiver fechado
          >
            {isOpen ? (
              <HiChevronLeft
                className={`text-white cursor-pointer size-10 transition-all hover:text-green-400`}
                onClick={toggleMenu}
              />
            ) : (
              <HiChevronRight
                className={`text-${color} cursor-pointer size-10 transition-all hover:text-green-400`}
                onClick={toggleMenu}
              />
            )}
          </div>
        )}
      </nav>

      {isOpen && (
        <div className=" w-full text-white rounded-md overflow-y-auto scrollbar-thin scrollbar-thumb-green-600 scrollbar-track-gray-900">
          <h2 className="text-center font-bold bg-red-500 p-2">
            <span className="break-all whitespace-normal">{user?.login}</span>
          </h2>
          <ul className="grid grid-cols-2 gap-5 p-4">
            {permission >= 2 && (
              <>
                <NavItem
                  to="/"
                  icon={
                    <HiHome className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="Início"
                  description="Página inicial do sistema"
                />
                <NavItem
                  to="/Pix"
                  icon={
                    <FaPix className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="Pix"
                  description="Gestão de pagamentos via Pix"
                />
              </>
            )}
            {permission >= 5 && (
              <>
                <NavItem
                  to="/Create"
                  icon={
                    <FaUserPlus className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="Novo Usuário"
                  description="Cadastrar novos usuários no sistema"
                />
                <NavItem
                  to="/licencas"
                  icon={
                    <FaDesktop className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="Licenças"
                  description="Gerenciamento de licenças de software"
                />
                <NavItem
                  to="/TimeTracking/Admin"
                  icon={
                    <FaUsers className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="Gestão de Ponto"
                  description="Administração de registros de ponto"
                />
                <NavItem
                  to="/TimeTracking/Map"
                  icon={
                    <FaMapMarkedAlt className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="Mapa"
                  description="Visualização de localização em tempo real"
                />
                <NavItem
                  to="/TimeTracking/Report"
                  icon={
                    <FaClipboardList className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="Relatórios"
                  description="Relatórios detalhados de ponto"
                />
                {permission >= 5 && (
                  <NavItem
                    to="/whatsapp/broadcast"
                    icon={
                      <BsFillSendPlusFill className="text-white size-8 transition-all hover:text-green-400" />
                    }
                    title="Disparo em Massa"
                    description="Enviar mensagens para múltiplos clientes"
                  />
                )}
              </>
            )}
            {permission >= 2 && (
              <>
                <NavItem
                  to="/feedbackCreate"
                  icon={
                    <MdOutlineFeedback className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="Feedback"
                  description="Enviar sugestões ou reportar erros"
                />
                <NavItem
                  to="/NFSE"
                  icon={
                    <HiDocumentText className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="NFSe"
                  description="Emissão e gestão de Nota Fiscal de Serviço"
                />
                <NavItem
                  to="/Nfcom"
                  icon={
                    <FaFileInvoice className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="NFCom"
                  description="Emissão e gestão de Nota Fiscal de Telecom"
                />
                <NavItem
                  to="/nfe/comodato"
                  icon={
                    <GrDocumentNotes className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="NFe Comodato"
                  description="Remessa e retorno de equipamentos"
                />
                <NavItem
                  to="/Whatsapp"
                  icon={
                    <FaWhatsapp className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="WhatsApp"
                  description="Integração e envio de mensagens"
                />

                <NavItem
                  to="/ClientAnalytics"
                  icon={
                    <IoMdAnalytics className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="Analytics"
                  description="Análise de dados de clientes"
                />
              </>
            )}
            {permission === 1 && (
              <>
                <NavItem
                  to="/Nfcom/Buscar"
                  icon={
                    <FaSearch className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="Buscar NFCom"
                  description="Pesquisar notas fiscais"
                />
                <NavItem
                  onClick={clearCookies}
                  icon={
                    <ImExit className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="Sair"
                  description="Encerrar sessão"
                />
              </>
            )}
            <NavItem
              to="/TimeTracking/ClockIn"
              icon={
                <FaClock className="text-white size-8 transition-all hover:text-green-400" />
              }
              title="Registrar Ponto"
              description="Bater ponto (Entrada/Saída)"
            />

            {permission >= 2 && (
              <>
                <NavItem
                  to="/ServerLogs"
                  icon={
                    <FaRegFolder className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="Logs"
                  description="Visualizar logs do servidor"
                />
                <NavItem
                  to="/PowerDns"
                  icon={
                    <MdDns className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="DNS"
                  description="Gerenciamento de PowerDNS"
                />
                <NavItem
                  to="/Onu"
                  icon={
                    <FaPlugCirclePlus className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="ONU"
                  description="Gerenciamento de ONUs"
                />
                <NavItem
                  onClick={clearCookies}
                  icon={
                    <ImExit className="text-white size-8 transition-all hover:text-green-400" />
                  }
                  title="Sair"
                  description="Encerrar sessão"
                />
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
