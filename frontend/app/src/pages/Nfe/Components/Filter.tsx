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

const filters = {
  plano: [
    { value: "90_PFJ_Radio5M", label: "5M"},
    { value: "91_PFJ_Radio8M", label: "8M"},
    { value: "92_PFJ_Radio15M", label: "15M"},
    { value: "7_PFJ_FIBRA_340M_RURAL_WIP", label: "340M"},
    { value: "1_PFJ_FIBRA_400M", label: "400M"},
    { value: "2_PFJ_FIBRA_500M", label: "500M"},
    { value: "3_PFJ_FIBRA_600M", label: "600M"},
    { value: "4_PFJ_FIBRA_700M", label: "700M"},
    { value: "5_PFJ_FIBRA_800M", label: "800M"},
  ],
  cli_ativado: [
    { value: "s", label: "Cliente Ativo"},
  ],
  nova_nfe: [
    { value: "new_nfe", label: "Nova NFE"}
  ],
  vencimento: [
    { value: "venc5", label: "Dia 5"},
    { value: "venc10", label: "Dia 10"},
    { value: "venc15", label: "Dia 15"},
    { value: "venc20", label: "Dia 20"},
    { value: "venc25", label: "Dia 25"},
  ],
};

export default function Filter({setActiveFilters}: {setActiveFilters: (filters: { plano: string[], vencimento: string[], cli_ativado: string[], nova_nfe: string[] }) => void}) {
  const [filter, setFilter] = useState<string[]>([]);

  const categorizeFilters = (filters: string[]) => {
    const categorizedFilters: { plano: string[], vencimento: string[], cli_ativado: string[], nova_nfe: string[]} = {
      plano: [],
      vencimento: [],
      cli_ativado: [],
      nova_nfe: [],
    };
  
    filters.forEach((filter) => {
      if (filter.startsWith("plan_")) {
        categorizedFilters.plano.push(filter);
      } else if (filter.startsWith("venc")) {
        categorizedFilters.vencimento.push(filter);
      } else if (filter === "active_client") {
        categorizedFilters.cli_ativado.push(filter);  // Corrige a categorização do active_client
      } else if (filter === "new_nfe") {
        categorizedFilters.nova_nfe = [filter];  // Garante que apenas um new_nfe esteja ativo
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
          : prevFilters.filter((f) => !filters.nova_nfe.map(opt => opt.value).includes(f)).concat(selectedFilter);
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
          <div className="mx-auto flex max-w-7xl space-x-6 divide-x divide-gray-200 px-4 text-sm sm:px-6 lg:px-8">
            <div>
              <DisclosureButton className="group flex items-center font-medium text-gray-700">
                <FunnelIcon
                  aria-hidden="true"
                  className="mr-2 size-5 flex-none text-gray-400 group-hover:text-gray-500"
                />
                {`${filter.length} Filtros`}
              </DisclosureButton>
            </div>
            <div className="pl-6">
              <button
                onClick={clearFilter}
                type="button"
                className="text-gray-500"
              >
                Limpar Filtro
              </button>
            </div>
          </div>
        </div>

        <DisclosurePanel className="border-t border-gray-200 py-10">
          <div className="mx-auto grid max-w-7xl grid-cols-3 gap-x-4 px-4 text-sm sm:px-6 md:gap-x-6 lg:px-8">
            <fieldset>
              <legend className="block font-medium">Plano</legend>
              <div className="space-y-6 pt-6 sm:space-y-4 sm:pt-4">
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
                      htmlFor={`plano-${optionIdx}`}
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
