import React, { useEffect } from 'react'
import { HiCheckCircle } from "react-icons/hi2";
import { NavBar } from '../../components/navbar/NavBar';

export const HomePage = () => {

  useEffect(() => {
    document.title = 'Home';
  }, []);


  return (
    <div>
      <NavBar/>
      <div className='grid grid-cols-1 grid-rows-[150px_150px_300px] justify-items-center items-center h-screen'>
        <h1 className='col-span-1 font-semibold sm:place-self-start sm:ml-40 sm:mt-10 text-2xl'>Home</h1>
        <h2 className='col-span-1'>Por Enquanto Não Temos Nada Aqui</h2>
        <HiCheckCircle className='size-40 col-span-1 self-start text-green-500' />
        <h2>Links da nossas outras Paginas</h2>
        <a className='bg-green-500 text-black border-black hover:border-2 hover:bg-green-300 w-1/6 rounded-md  p-2' href="https://apimk.wiptelecomunicacoes.com.br/">Pix</a>
        <a className='bg-green-500 text-black border-black hover:border-2 hover:bg-green-300 w-1/6 rounded-md  p-2' href="https://wippainel.wiptelecomunicacoes.com.br/">Wip Painel</a>
        <a className='bg-green-500 text-black border-black hover:border-2 hover:bg-green-300 w-1/6 rounded-md  p-2 mb-10' href="https://whatsemail.wiptelecomunicacoes.com.br/">Mensagens Whatsapp</a>
      </div>
    </div>
  )
}
