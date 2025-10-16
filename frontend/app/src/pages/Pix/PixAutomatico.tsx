import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";

async function criarPixAutomatico() {}
async function getClientesPixAutomatico() {}
async function removerPixAutomatico() {}

export const PixAutomatico = () => {
  const [remover, setRemover] = useState(false);
  const [date, setDate] = useState(new Date().toLocaleString())

  return (
    <div className="p-5 bg-slate-800 min-h-screen text-gray-200">
      <NavBar />
      <div className="bg-gray-100 text-gray-900 p-10 rounded-md flex flex-col gap-4 items-center">
        <h1 className="text-2xl font-bold">Pix Automático</h1>
        <p className="text-gray-700">
          Gerencie e adicione clientes ao Pix Automático
        </p>

        {/* Toggle estilizado */}
        <label className="group relative inline-flex w-11 shrink-0 cursor-pointer rounded-full bg-gray-200 p-0.5 outline-offset-2 outline-indigo-600 ring-1 ring-inset ring-gray-900/5 transition-colors duration-200 ease-in-out has-[:checked]:bg-indigo-600 has-[:focus-visible]:outline has-[:focus-visible]:outline-2">
          <span className="relative size-5 rounded-full bg-white shadow-sm ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-[:checked]:translate-x-5">
            <span
              aria-hidden="true"
              className="absolute inset-0 flex size-full items-center justify-center opacity-100 transition-opacity duration-200 ease-in group-has-[:checked]:opacity-0 group-has-[:checked]:duration-100 group-has-[:checked]:ease-out"
            >
              {/* Ícone X (desativado) */}
              <svg
                fill="none"
                viewBox="0 0 12 12"
                className="size-3 text-red-400"
              >
                <path
                  d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span
              aria-hidden="true"
              className="absolute inset-0 flex size-full items-center justify-center opacity-0 transition-opacity duration-100 ease-out group-has-[:checked]:opacity-100 group-has-[:checked]:duration-200 group-has-[:checked]:ease-in"
            >
              {/* Ícone ✓ (ativado) */}
              <svg
                fill="currentColor"
                viewBox="0 0 12 12"
                className="size-3 text-indigo-600"
              >
                <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
              </svg>
            </span>
          </span>
          <input
            name="setting"
            type="checkbox"
            onChange={() => setRemover((prev) => !prev)}
            checked={!remover}
            aria-label="Use setting"
            className="absolute inset-0 appearance-none focus:outline-none"
          />
        </label>

        {/* Texto dinâmico */}
        <div className="mt-3 text-lg font-semibold">
          {remover ? (
            <span className="text-red-600">Remover cliente</span>
          ) : (
            <span className="text-green-600">Adicionar cliente</span>
          )}
        </div>
        <div>
          <form className="flex flex-col [&>*:nth-child(odd)]:bg-gray-100 gap-3">
          <input className="ring-1 rounded-sm p-2" type="text" placeholder="Contrato" />
          <input className="ring-1 rounded-sm p-2" type="text" placeholder="CPF" />
          <input className="ring-1 rounded-sm p-2" type="text" placeholder="Nome Completo" />
          <input className="ring-1 rounded-sm p-2" type="text" placeholder="Serviço" />
          <input className="ring-1 rounded-sm p-2" type="text" placeholder="Data Inicial" value={date}/>
          <input className="ring-1 rounded-sm p-2" type="text" placeholder="Periodicidade" />
          <input className="ring-1 rounded-sm p-2" type="text" placeholder="Valor" />
          <input className="ring-1 rounded-sm p-2" type="text" placeholder="PoliticaRetentativa" />
        </form>
        </div>
      </div>
    </div>
  );
};
