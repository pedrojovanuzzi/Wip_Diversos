import React from 'react'
import { NavBar } from '../../components/navbar/NavBar';

export const PixAutomatico = () => {
  return (
      <div className="p-5 bg-slate-800 min-h-screen text-gray-200">
        <NavBar />
        <div className="bg-gray-100 text-gray-900 p-10 rounded-md">
          <h1 className="text-2xl font-bold">Pix Automatico</h1>
          <p className="mt-2">Gerencie e adicione clientes ao Pix Automático</p>
        </div>
      </div>
    );
}
