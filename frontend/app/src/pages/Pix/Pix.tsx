import React from "react";
import {
  ClockIcon,
} from "@heroicons/react/24/outline";
import { NavBar } from "../../components/navbar/NavBar";
import { IoDocuments } from "react-icons/io5";
import { FaBoxOpen, FaUsers } from "react-icons/fa";
import { MdOutlineAutoMode } from "react-icons/md";


export const Pix = () => {
  return (
    <div className="p-5 bg-slate-800 sm:h-screen">
      <NavBar />
      <div className="p-10 bg-gray-100 rounded-t-sm font-semibold">
        <h1>Formas de Pagamento</h1>
        <div className="pt-2">
            <p className="text-xs text-start text-gray-600">ℹ️ Vencida = Mensalidade Atrasada/ Com Juros</p>
        <p className="text-xs text-start text-gray-600">ℹ️ Aberta = Mensalidade ainda não paga</p>
        </div>
      </div>
        
      <div className="divide-y divide-gray-200 overflow-hidden rounded-b-lg shadow sm:grid sm:grid-cols-2 sm:divide-y-0">
        <div className="group relative ring-1 ring-gray-400 hover:bg-green-300 transition-all  bg-gray-100 p-6 ">
          <span className="inline-flex rounded-lg p-3 bg-teal-100 text-teal-700">
            <ClockIcon aria-hidden="true" className="size-6" />
          </span>
          <div className="mt-8">
            <h3 className="text-base font-semibold text-gray-900">
              <a href="#" className="focus:outline-none">
                <span aria-hidden="true" className="absolute inset-0" />
                Pix do Ultimo <b>Vencimento</b>
              </a>
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Gera o Pix da Ultima Mensalidade <b>Vencida</b>
            </p>
          </div>
        </div>

        <div className="group relative ring-1 ring-gray-400 hover:bg-green-300 transition-all  bg-gray-100 p-6 ">
          <span className="inline-flex rounded-lg p-3 bg-purple-100 text-purple-700">
            <IoDocuments  aria-hidden="true" className="size-6" />
          </span>
          <div className="mt-8">
            <h3 className="text-base font-semibold text-gray-900">
              <a href="#" className="focus:outline-none">
                <span aria-hidden="true" className="absolute inset-0" />
                Pix de Todos os <b>Vencimentos</b>
              </a>
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Gera um pix com todas as mensalidades <b>Vencidas</b> do cliente
            </p>
          </div>
        </div>

        <div className="group relative ring-1 ring-gray-400 hover:bg-green-300 transition-all  bg-gray-100 p-6 ">
          <span className="inline-flex rounded-lg p-3 bg-sky-100 text-sky-700">
            <FaBoxOpen  aria-hidden="true" className="size-6" />
          </span>
          <div className="mt-8">
            <h3 className="text-base font-semibold text-gray-900">
              <a href="#" className="focus:outline-none">
                <span aria-hidden="true" className="absolute inset-0" />
                Pix Mensalidade em <b>Aberto</b>
              </a>
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Gera um pix da mensalidade em <b>aberto</b>
            </p>
          </div>
        </div>

        <div className="group relative ring-1 ring-gray-400 hover:bg-green-300 transition-all  bg-gray-100 p-6 ">
          <span className="inline-flex rounded-lg p-3 bg-yellow-100 text-yellow-700">
            <FaUsers  aria-hidden="true" className="size-6" />
          </span>
          <div className="mt-8">
            <h3 className="text-base font-semibold text-gray-900">
              <a href="#" className="focus:outline-none">
                <span aria-hidden="true" className="absolute inset-0" />
                Pix de Varias <b>Contas</b>
              </a>
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Gera um Pix de varias mensalidade, serve para varias contas ou varias mensalidades em uma conta
            </p>
          </div>
        </div>

<div className="group relative ring-1 ring-gray-400 hover:bg-green-300 transition-all col-span-2  bg-gray-100 p-6 ">
          <span className="inline-flex rounded-lg p-3 bg-yellow-100 text-yellow-700">
            <MdOutlineAutoMode  aria-hidden="true" className="size-6" />
          </span>
          <div className="mt-8">
            <h3 className="text-base font-semibold text-gray-900">
              <a href="#" className="focus:outline-none">
                <span aria-hidden="true" className="absolute inset-0" />
                Pix <b>Automático</b>
              </a>
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Gerencie e adicione clientes ao <b>Pix Automático</b>
            </p>
          </div>
        </div>

        
      </div>
    </div>
  );
};
