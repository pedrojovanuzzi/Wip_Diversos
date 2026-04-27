"use client";

import { CiSearch } from "react-icons/ci";

interface StackedProps {
  setSearchCpf: (cpf: string) => void;
  onSearch: () => void;
}

export default function Stacked({ setSearchCpf, onSearch }: StackedProps) {
  return (
    <div className="bg-sky-700 pb-32">
      <header className="py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Emissão de NFCom
          </h1>
          <div className="mt-8 relative max-w-xl">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-2xl">
              <CiSearch />
            </span>
            <input
              type="text"
              placeholder="Digite o CPF/CNPJ"
              className="w-full h-12 pl-12 pr-24 rounded-lg shadow-lg focus:ring-2 focus:ring-sky-500 outline-none"
              onChange={(e) => setSearchCpf(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
            />
            <button
              onClick={onSearch}
              className="absolute right-1 top-1 h-10 px-6 bg-sky-600 text-white rounded-md hover:bg-sky-500 font-bold"
            >
              Buscar
            </button>
          </div>
        </div>
      </header>
    </div>
  );
}
