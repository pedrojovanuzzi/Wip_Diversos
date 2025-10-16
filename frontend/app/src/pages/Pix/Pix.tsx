import React from "react";
import { Link } from "react-router-dom"; // 👈 importante
import { NavBar } from "../../components/navbar/NavBar";
import { ClockIcon } from "@heroicons/react/24/outline";
import { IoDocuments } from "react-icons/io5";
import { FaBoxOpen, FaUsers } from "react-icons/fa";
import { MdOutlineAutoMode } from "react-icons/md";
import PixCard from "./components/PixCard";



export const Pix = () => {
  return (
    <div className="p-5 bg-slate-800 sm:h-screen">
      <NavBar />
      <div className="p-10 bg-gray-100 rounded-t-sm font-semibold">
        <h1>Formas de Pagamento</h1>
        <div className="pt-2">
          <p className="text-xs text-start text-gray-600">ℹ️ Vencida = Mensalidade atrasada</p>
          <p className="text-xs text-start text-gray-600">ℹ️ Aberta = Mensalidade ainda não paga</p>
        </div>
      </div>

      <div className="divide-y divide-gray-200 overflow-hidden rounded-b-lg shadow sm:grid sm:grid-cols-2 sm:divide-y-0">
        {/* --- Pix Último --- */}
        <PixCard
          link="/Pix/ultimo"
          icon={<ClockIcon className="size-6" />}
          cor="bg-teal-100 text-teal-700"
          titulo="Pix do Último Vencimento"
          descricao="Gera o Pix da última mensalidade vencida"
        />

        {/* --- Pix Todos --- */}
        <PixCard
          link="/Pix/todos"
          icon={<IoDocuments className="size-6" />}
          cor="bg-purple-100 text-purple-700"
          titulo="Pix de Todos os Vencimentos"
          descricao="Gera um Pix com todas as mensalidades vencidas do cliente"
        />

        {/* --- Pix Aberto --- */}
        <PixCard
          link="/Pix/aberto"
          icon={<FaBoxOpen className="size-6" />}
          cor="bg-sky-100 text-sky-700"
          titulo="Pix Mensalidade em Aberto"
          descricao="Gera um Pix da mensalidade em aberto"
        />

        {/* --- Pix Varias --- */}
        <PixCard
          link="/Pix/varias"
          icon={<FaUsers className="size-6" />}
          cor="bg-yellow-100 text-yellow-700"
          titulo="Pix de Várias Contas"
          descricao="Gera um Pix de várias mensalidades (ou várias contas)"
        />

        {/* --- Pix Automático --- */}
        <PixCard
          link="/Pix/automatico"
          icon={<MdOutlineAutoMode className="size-6" />}
          cor="bg-yellow-100 text-yellow-700"
          titulo="Pix Automático"
          descricao="Gerencie e adicione clientes ao Pix Automático"
          spanFull
        />
      </div>
    </div>
  );
};

