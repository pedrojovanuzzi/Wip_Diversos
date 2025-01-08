import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import { ChevronDownIcon, FunnelIcon } from "@heroicons/react/20/solid";
import { log } from "node:console";
import { useState } from "react";
import Calendar from "./Calendar";
import Line from "./Line";
import { CiCirclePlus } from "react-icons/ci";
import { IoArrowUpCircleOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { HiMiniDocumentMagnifyingGlass } from "react-icons/hi2";

const filters = {
  plano: [
    { value: "90_PFJ_Radio5M", label: "5M" },
    { value: "91_PFJ_Radio8M", label: "8M" },
    { value: "92_PFJ_Radio15M", label: "15M" },
    { value: "7_PFJ_FIBRA_340M_RURAL_WIP", label: "340M" },
    { value: "1_PFJ_FIBRA_400M", label: "400M" },
    { value: "2_PFJ_FIBRA_500M", label: "500M" },
    { value: "3_PFJ_FIBRA_600M", label: "600M" },
    { value: "4_PFJ_FIBRA_700M", label: "700M" },
    { value: "5_PFJ_FIBRA_800M", label: "800M" },
  ],
  cli_ativado: [{ value: "active_client", label: "Cliente Ativo" }],
  nova_nfe: [{ value: "new_nfe", label: "Nova NFE" }],
  vencimento: [
    { value: "05", label: "Dia 5" },
    { value: "10", label: "Dia 10" },
    { value: "15", label: "Dia 15" },
    { value: "20", label: "Dia 20" },
    { value: "25", label: "Dia 25" },
  ],
};

interface FilterProps {
  setActiveFilters: (filters: any) => void;

  setDate: React.Dispatch<
    React.SetStateAction<{ start: string; end: string } | null>
  >;

  setArquivo: React.Dispatch<React.SetStateAction<File | null>>;

  enviarCertificado: React.Dispatch<React.SetStateAction<File | null>>;
  
  BuscarNfe? : boolean;
}

export default function Filter({
  setActiveFilters,
  setDate,
  setArquivo,
  enviarCertificado,
  BuscarNfe = true,
}: FilterProps) {
  const [filter, setFilter] = useState<string[]>([]);
  const navigate = useNavigate();

  const categorizeFilters = (filters: string[]) => {
    const categorizedFilters: {
      plano: string[];
      vencimento: string[];
      cli_ativado: string[];
      nova_nfe: string[];
    } = {
      plano: [],
      vencimento: [],
      cli_ativado: [],
      nova_nfe: [],
    };

    const planos = [
      "90_PFJ_Radio5M",
      "91_PFJ_Radio8M",
      "92_PFJ_Radio15M",
      "7_PFJ_FIBRA_340M_RURAL_WIP",
      "1_PFJ_FIBRA_400M",
      "2_PFJ_FIBRA_500M",
      "3_PFJ_FIBRA_600M",
      "4_PFJ_FIBRA_700M",
      "5_PFJ_FIBRA_800M",
    ];

    const vencimentos = ["05", "10", "15", "20", "25"];

    filters.forEach((filter) => {
      if (planos.includes(filter)) {
        categorizedFilters.plano.push(filter);
      } else if (filter === "new_nfe") {
        categorizedFilters.nova_nfe = [filter]; // Apenas um "new_nfe" ativo
      } else if (filter === "active_client") {
        categorizedFilters.cli_ativado = [filter]; // Cliente ativo
      } else if (vencimentos.includes(filter)) {
        categorizedFilters.vencimento.push(filter);
      }
    });

    return categorizedFilters;
  };

  const clickedFilter = (selectedFilter: string) => {
    setFilter((prevFilters) => {
      let newFilters;

      // Se for nova_nfe, substitui a seleção anterior
      if (selectedFilter === "new_nfe") {
        newFilters = prevFilters.includes(selectedFilter)
          ? prevFilters.filter((f) => f !== selectedFilter)
          : prevFilters
              .filter(
                (f) => !filters.nova_nfe.map((opt) => opt.value).includes(f)
              )
              .concat(selectedFilter);
      } else {
        // Caso contrário, adiciona ou remove normalmente
        newFilters = prevFilters.includes(selectedFilter)
          ? prevFilters.filter((f) => f !== selectedFilter)
          : [...prevFilters, selectedFilter];
      }

      const organizedFilters = categorizeFilters(newFilters);
      setActiveFilters(organizedFilters);

      console.log(organizedFilters);
      return newFilters;
    });
  };

  const clearFilter = () => {
    setFilter([]);
  };

  return (
    <div className="bg-white">
      <Disclosure
        as="section"
        aria-labelledby="filter-heading"
        className="grid items-center border-b border-t border-gray-200"
      >
        <h2 id="filter-heading" className="sr-only">
          Filtros
        </h2>
        <div className="relative col-start-1 row-start-1 py-4">
          <div className="mx-auto flex items-center justify-between gap-5 max-w-7xl space-x-6 divide-x divide-gray-200 px-4 text-sm sm:px-6 lg:px-8">
            <div className="flex items-center gap-6">
              <DisclosureButton className="group flex items-center font-medium text-gray-700">
                <FunnelIcon
                  aria-hidden="true"
                  className="mr-2 size-5 flex-none text-gray-400 group-hover:text-gray-500"
                />
                {`${filter.length} Filtros`}
              </DisclosureButton>
              <button
                onClick={clearFilter}
                type="button"
                className="text-gray-500"
              >
                Limpar Filtro
              </button>
            </div>

            <div className="flex items-center gap-6">
              <label className="relative ring-1 ring-black ring-opacity-5 bg-slate-500 text-gray-200 py-6 px-8 rounded hover:bg-slate-400 transition-all cursor-pointer">
                <span className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 text-4xl">
                  <CiCirclePlus />
                </span>
                <input
                  type="file"
                  onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              <button
                className="bg-indigo-500 ring-1 ring-black ring-opacity-5 text-white indent-2 py-3 px-8 rounded hover:bg-indigo-400 transition-all flex items-center justify-center"
                onClick={() => enviarCertificado(null)}
              >
                <IoArrowUpCircleOutline className="text-2xl" />
                Enviar
              </button>

              {BuscarNfe && <button
              className="bg-teal-500 ring-1 ring-black ring-opacity-5 text-white indent-2 py-3 px-2 rounded hover:bg-teal-400 transition-all flex items-center justify-center"
                onClick={() => navigate("/BuscarNfeGerada")}              >
                <HiMiniDocumentMagnifyingGlass className="text-2xl" />
                NFS-e Geradas
              </button>}
            </div>
          </div>
        </div>

        <DisclosurePanel className="border-t border-gray-200">
          <Calendar setDateFilter={setDate} />
          <Line />
          <div className="mx-auto grid max-w-7xl mt-10 grid-cols-3 gap-4 px-4 text-sm sm:px-6 md:gap-x-6 lg:px-8">
            <fieldset>
              <legend className="block font-medium">Plano</legend>
              <div className="space-y-6 p-10 sm:space-y-4 sm:pt-4">
                {filters.plano.map((option, optionIdx) => (
                  <div key={option.value} className="flex gap-3">
                    <div className="flex h-5 shrink-0 items-center">
                      <div className="group grid size-4 grid-cols-1">
                        <input
                          value={option.value}
                          checked={filter.includes(option.value)}
                          onChange={() => clickedFilter(option.value)}
                          id={`plano-${optionIdx}`}
                          name="plano[]"
                          type="checkbox"
                          className="col-start-1 row-start-1 appearance-none rounded border border-gray-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        />
                        <svg
                          fill="none"
                          viewBox="0 0 14 14"
                          className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25"
                        >
                          <path
                            d="M3 8L6 11L11 3.5"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-0 group-has-[:checked]:opacity-100"
                          />
                          <path
                            d="M3 7H11"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-0 group-has-[:indeterminate]:opacity-100"
                          />
                        </svg>
                      </div>
                    </div>
                    <label
                      htmlFor={`plano-${optionIdx}`}
                      className="text-base text-gray-600 sm:text-sm"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="block font-medium">Outros</legend>
              <div className="space-y-6 pt-6 sm:space-y-4 sm:pt-4">
                {filters.cli_ativado.map((option, optionIdx) => (
                  <div key={option.value} className="flex gap-3">
                    <div className="flex h-5 shrink-0 items-center">
                      <div className="group grid size-4 grid-cols-1">
                        <input
                          value={option.value}
                          checked={filter.includes(option.value)}
                          onChange={() => clickedFilter(option.value)}
                          id={`outros-${optionIdx}`}
                          name="outros[]"
                          type="checkbox"
                          className="col-start-1 row-start-1 appearance-none rounded border border-gray-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        />
                        <svg
                          fill="none"
                          viewBox="0 0 14 14"
                          className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25"
                        >
                          <path
                            d="M3 8L6 11L11 3.5"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-0 group-has-[:checked]:opacity-100"
                          />
                          <path
                            d="M3 7H11"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-0 group-has-[:indeterminate]:opacity-100"
                          />
                        </svg>
                      </div>
                    </div>
                    <label
                      htmlFor={`plano-${optionIdx}`}
                      className="text-base text-gray-600 sm:text-sm"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
                {filters.nova_nfe.map((option, optionIdx) => (
                  <div key={option.value} className="flex gap-3">
                    <div className="flex h-5 shrink-0 items-center">
                      <div className="group grid size-4 grid-cols-1">
                        <input
                          value={option.value}
                          checked={filter.includes(option.value)}
                          onChange={() => clickedFilter(option.value)}
                          id={`outros-${optionIdx}`}
                          name="outros[]"
                          type="checkbox"
                          className="col-start-1 row-start-1 appearance-none rounded border border-gray-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        />
                        <svg
                          fill="none"
                          viewBox="0 0 14 14"
                          className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25"
                        >
                          <path
                            d="M3 8L6 11L11 3.5"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-0 group-has-[:checked]:opacity-100"
                          />
                          <path
                            d="M3 7H11"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-0 group-has-[:indeterminate]:opacity-100"
                          />
                        </svg>
                      </div>
                    </div>
                    <label
                      htmlFor={`plano-${optionIdx}`}
                      className="text-base text-gray-600 sm:text-sm"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="block font-medium">Vencimento</legend>
              <div className="space-y-6 pt-6 sm:space-y-4 sm:pt-4">
                {filters.vencimento.map((option, optionIdx) => (
                  <div key={option.value} className="flex gap-3">
                    <div className="flex h-5 shrink-0 items-center">
                      <div className="group grid size-4 grid-cols-1">
                        <input
                          value={option.value}
                          checked={filter.includes(option.value)}
                          onChange={() => clickedFilter(option.value)}
                          id={`vencimento-${optionIdx}`}
                          name="vencimento[]"
                          type="checkbox"
                          className="col-start-1 row-start-1 appearance-none rounded border border-gray-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        />
                        <svg
                          fill="none"
                          viewBox="0 0 14 14"
                          className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25"
                        >
                          <path
                            d="M3 8L6 11L11 3.5"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-0 group-has-[:checked]:opacity-100"
                          />
                          <path
                            d="M3 7H11"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-0 group-has-[:indeterminate]:opacity-100"
                          />
                        </svg>
                      </div>
                    </div>
                    <label
                      htmlFor={`vencimento-${optionIdx}`}
                      className="text-base text-gray-600 sm:text-sm"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>
          </div>
        </DisclosurePanel>
      </Disclosure>
    </div>
  );
}
