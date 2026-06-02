import React from "react";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../../components/navbar/NavBar";
import { ClockIcon } from "@heroicons/react/24/outline";
import { IoDocuments } from "react-icons/io5";
import { FaBoxOpen, FaUsers } from "react-icons/fa";
import { MdPaid } from "react-icons/md";
import { CiSettings } from "react-icons/ci";
import PixCard from "./components/PixCard";
import { useAuth } from "../../context/AuthContext";

export const Pix = () => {
  const { user } = useAuth();
  const permission = user?.permission;
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Central Pix
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Gere cobranças Pix para mensalidades e consulte pagamentos.
            </p>
          </div>

          {permission! >= 5 && (
            <button
              onClick={() => navigate("/Pix/Admin")}
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition"
              title="Configurações"
            >
              <CiSettings className="size-5" />
              <span className="hidden sm:inline">Configurações</span>
            </button>
          )}
        </div>

        {/* Legenda / Info pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
            <span className="size-1.5 rounded-full bg-rose-500" />
            Vencida — mensalidade atrasada
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-200">
            <span className="size-1.5 rounded-full bg-sky-500" />
            Aberta — ainda não paga
          </span>
        </div>

        {/* Grid de ações */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PixCard
            link="/Pix/ultimo"
            icon={<ClockIcon className="size-6" />}
            cor="bg-teal-50 text-teal-700"
            titulo="Pix do Último Vencimento"
            descricao="Gera o Pix da última mensalidade vencida do cliente."
          />

          <PixCard
            link="/Pix/todos"
            icon={<IoDocuments className="size-6" />}
            cor="bg-purple-50 text-purple-700"
            titulo="Pix de Todos os Vencimentos"
            descricao="Agrega todas as mensalidades vencidas em uma única cobrança."
          />

          <PixCard
            link="/Pix/aberto"
            icon={<FaBoxOpen className="size-6" />}
            cor="bg-sky-50 text-sky-700"
            titulo="Pix Mensalidade em Aberto"
            descricao="Gera o Pix de uma mensalidade ainda em aberto."
          />

          <PixCard
            link="/Pix/varias"
            icon={<FaUsers className="size-6" />}
            cor="bg-amber-50 text-amber-700"
            titulo="Pix de Várias Contas"
            descricao="Combina mensalidades de uma ou mais contas em uma cobrança."
          />

          <PixCard
            link="/Pix/findPaid"
            icon={<MdPaid className="size-6" />}
            cor="bg-emerald-50 text-emerald-700"
            titulo="Buscar Pix Pagos"
            descricao="Consulta pagamentos pelo ID de transação do Pix."
          />
        </div>
      </div>
    </div>
  );
};
