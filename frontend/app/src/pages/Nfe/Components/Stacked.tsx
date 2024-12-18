import { CiSearch } from "react-icons/ci";

export default function Stacked() {
  return (
    <>
      <div className="min-h-full">
        <div className="sm:bg-slate-600 bg-black pb-32">
          <header className="py-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Nota Fiscal
              </h1>
            </div>
          </header>
        </div>

        <main className="-mt-32">
          <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 relative">
            <div className="relative">
              <span className="absolute left-3 top-1/2  -translate-y-1/2 text-gray-400 text-2xl">
                <CiSearch />
              </span>
              <input
                placeholder="Digite o CPF/CNPJ"
                type="text"
                id="searchParams"
                className="rounded-lg px-10 bg-white py-2 w-full shadow text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}