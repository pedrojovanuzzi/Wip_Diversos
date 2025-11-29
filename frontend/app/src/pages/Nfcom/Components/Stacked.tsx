import { CiSearch } from "react-icons/ci";

interface SearchCPF {
  setSearchCpf: (cpf: string) => void;
  onSearch: () => Promise<void>;
}

export default function Stacked({ setSearchCpf, onSearch }: SearchCPF) {
  return (
    <>
      <div className="min-h-full">
        <div className="sm:bg-red-700 bg-red-900 pb-32">
          <header className="py-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Gerar NFCOM
              </h1>
            </div>
          </header>
        </div>

        <main className="-mt-32">
          <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 relative">
            <div className="relative flex items-center">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-2xl">
                <CiSearch />
              </span>
              <input
                placeholder="Digite o CPF/CNPJ"
                type="text"
                id="searchParams"
                className="rounded-lg px-10 bg-white py-2 w-full shadow text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                onChange={(e) => setSearchCpf(e.target.value)}
              />
              <button
                onClick={onSearch}
                className="absolute right-0 bg-indigo-500 text-white py-3 px-5 rounded-lg hover:bg-indigo-400 transition-all"
              >
                Buscar
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
