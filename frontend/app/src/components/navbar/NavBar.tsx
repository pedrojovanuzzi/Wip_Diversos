import React, { useEffect, useState } from 'react';
import { HiBars3, HiChevronLeft, HiChevronRight, HiDocumentText, HiHome } from "react-icons/hi2";
import { MdOutlineFeedback } from "react-icons/md";
import { VscGraph } from "react-icons/vsc";
import { FaWhatsapp } from "react-icons/fa";

import { Link } from 'react-router-dom';

export const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`z-10 sm:h-screen ${isOpen ? 'sm:w-32' : 'sm:w-0'} bg-black sm:fixed sm:top-0 sm:left-0 grid sm:grid-rows-[auto,1fr] p-4 sm:p-0 sm:pt-10 transition-all duration-300`}>
      
      <nav className='sm:w-full sm:p-4 grid place-items-center relative'>
        {/* Ícone de menu "HiBars3" para dispositivos móveis */}
        {isMobile ? (
          <HiBars3 
            className='text-white cursor-pointer size-10'  
            onClick={toggleMenu} 
          />
        ) : (
          /* Ícones de setas para dispositivos maiores */
          <div
            className={`${isOpen ? 'relative' : 'absolute'} ${isOpen ? '' : 'left-10 top-5'} transition-all duration-300`}
             // Ajuste a posição da seta quando o menu estiver fechado
          >
            {isOpen ? (
              <HiChevronLeft 
                className='text-white cursor-pointer size-10 transition-all hover:text-green-400'  
                onClick={toggleMenu} 
              />
            ) : (
              <HiChevronRight 
                className='text-black cursor-pointer size-10 transition-all hover:text-green-400'  
                onClick={toggleMenu} 
              />
            )}
          </div>
        )}
      </nav>

      
      {isOpen && (
        <div className=' w-full text-white rounded-md'>
          <ul className='grid grid-cols-2 gap-5 p-4'>
            <li className='p-2 grid place-items-center col-span-2'>
              <Link to='/'>
                <HiHome className='text-white size-8 transition-all hover:text-green-400' />
              </Link>
            </li>
            <li className='p-2 grid place-items-center col-span-2'>
              <Link to='/chamados'>
                <VscGraph className='text-white size-8 transition-all hover:text-green-400' />
              </Link>
            </li>
            <li className='p-2 grid place-items-center col-span-2'>
              <Link to='/feedbackCreate'>
                <MdOutlineFeedback className='text-white size-8 transition-all hover:text-green-400' />
              </Link>
            </li>
            <li className='p-2 grid place-items-center col-span-2'>
              <Link to='/Nfe'>
                <HiDocumentText className='text-white size-8 transition-all hover:text-green-400' />
              </Link>
            </li>
            <li className='p-2 grid place-items-center col-span-2'>
              <Link to='/Whatsapp'>
                <FaWhatsapp className='text-white size-8 transition-all hover:text-green-400' />
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
