import React from 'react'
import { HiCheckCircle } from "react-icons/hi2";
import { NavBar } from '../../components/navbar/NavBar';

export const HomePage = () => {
  return (
    <div>
      <NavBar/>
      <div className='grid grid-cols-1 grid-rows-[150px] justify-items-center items-center h-screen'>
        <h1 className='col-span-1 font-semibold sm:place-self-start sm:ml-40 sm:mt-10 text-2xl'>Home</h1>
        <h2 className='col-span-1'>Por Enquanto Não Temos Nada Aqui</h2>
        <HiCheckCircle className='size-40 col-span-1 self-start text-green-500' />
      </div>
    </div>
  )
}
