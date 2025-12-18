import React, { useEffect, useState } from "react";
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
} from "react-icons/fa";
import { IoMdAnalytics } from "react-icons/io";
import { FaRegFolder } from "react-icons/fa";
import { FaPlugCirclePlus } from "react-icons/fa6";
import { ImExit } from "react-icons/im";
import { FaPix } from "react-icons/fa6";

import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Cookies from "js-cookie";

type Color = {
  color?: string;
};

export const NavBar = ({ color = "black" }: Color) => {
  const [isOpen, setIsOpen] = useState(false);

  const { user } = useAuth();
  const token = user?.token;
  const permission = user?.permission;

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
      className={`z-10 sm:h-screen  ${
        isOpen ? "sm:w-32" : "sm:w-0"
      } bg-stone-800 sm:fixed sm:top-0 sm:left-0 grid sm:grid-rows-[auto,1fr] p-4 sm:p-0 sm:pt-10 transition-all duration-300`}
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
          <h2 className="text-center p-2 font-bold bg-red-500 p-2">
            <span className="break-all whitespace-normal">{user?.login}</span>
          </h2>
          <ul className="grid grid-cols-2 gap-5 p-4">
            {permission! >= 2 && (
              <>
                <li className="p-2 grid place-items-center col-span-2">
                  <Link to="/">
                    <HiHome className="text-white size-8 transition-all hover:text-green-400" />
                  </Link>
                </li>
                <li className="p-2 grid place-items-center col-span-2">
                  <Link to="/Pix">
                    <FaPix className="text-white size-8 transition-all hover:text-green-400" />
                  </Link>
                </li>
              </>
            )}
            {/* <li className='p-2 grid place-items-center col-span-2'>
              <Link to='/chamados'>
                <VscGraph className='text-white size-8 transition-all hover:text-green-400' />
              </Link>
            </li> */}
            {permission! >= 5 && (
              <li className="p-2 grid place-items-center col-span-2">
                <Link to="/Create">
                  <FaUserPlus className="text-white size-8 transition-all hover:text-green-400" />
                </Link>
              </li>
            )}
            {permission! >= 2 && (
              <>
                <li className="p-2 grid place-items-center col-span-2">
                  <Link to="/feedbackCreate">
                    <MdOutlineFeedback className="text-white size-8 transition-all hover:text-green-400" />
                  </Link>
                </li>
                <li className="p-2 grid place-items-center col-span-2">
                  <Link to="/Nfe">
                    <HiDocumentText className="text-white size-8 transition-all hover:text-green-400" />
                  </Link>
                </li>
                <li className="p-2 grid place-items-center col-span-2">
                  <Link to="/Nfcom">
                    <FaFileInvoice className="text-white size-8 transition-all hover:text-green-400" />
                  </Link>
                </li>
                <li className="p-2 grid place-items-center col-span-2">
                  <Link to="/Whatsapp">
                    <FaWhatsapp className="text-white size-8 transition-all hover:text-green-400" />
                  </Link>
                </li>
                <li className="p-2 grid place-items-center col-span-2">
                  <Link to="/ClientAnalytics">
                    <IoMdAnalytics className="text-white size-8 transition-all hover:text-green-400" />
                  </Link>
                </li>
              </>
            )}
            {permission! === 1 && (
              <>
                <li className="p-2 grid place-items-center col-span-2">
                  <Link to="/Nfcom/Buscar">
                    <FaSearch className="text-white size-8 transition-all hover:text-green-400" />
                  </Link>
                </li>
                <li className="p-2 grid place-items-center col-span-2">
                  <button onClick={clearCookies}>
                    <ImExit className="text-white size-8 transition-all hover:text-green-400" />
                  </button>
                </li>
              </>
            )}
            {/* <li className='p-2 grid place-items-center col-span-2'>
              <Link to='/DDDOS'>
                <PiComputerTowerBold className='text-white size-8 transition-all hover:text-green-400' />
              </Link>
            </li> */}
            {permission! >= 2 && (
              <>
                <li className="p-2 grid place-items-center col-span-2">
                  <Link to="/ServerLogs">
                    <FaRegFolder className="text-white size-8 transition-all hover:text-green-400" />
                  </Link>
                </li>
                <li className="p-2 grid place-items-center col-span-2">
                  <Link to="/PowerDns">
                    <MdDns className="text-white size-8 transition-all hover:text-green-400" />
                  </Link>
                </li>
                <li className="p-2 grid place-items-center col-span-2">
                  <Link to="/Onu">
                    <FaPlugCirclePlus className="text-white size-8 transition-all hover:text-green-400" />
                  </Link>
                </li>
                <li className="p-2 grid place-items-center col-span-2">
                  <button onClick={clearCookies}>
                    <ImExit className="text-white size-8 transition-all hover:text-green-400" />
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
