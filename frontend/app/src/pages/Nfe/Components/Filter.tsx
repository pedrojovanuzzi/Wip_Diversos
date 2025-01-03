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
    { value: "plan_5", label: "5M"},
    { value: "plan_8", label: "8M"},
    { value: "plan_15", label: "15M"},
    { value: "plan_340", label: "340M"},
    { value: "plan_400", label: "400M"},
    { value: "plan_500", label: "500M"},
    { value: "plan_600", label: "600M"},
    { value: "plan_700", label: "700M"},
    { value: "plan_800", label: "800M"},
  ],
  outros: [
    { value: "active_client", label: "Cliente Ativo"},
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

export default function Filter({setActiveFilters}: {setActiveFilters: (filters: string[]) => void}) {
  const [filter, setFilter] = useState<string[]>([]);

  const clickedFilter = (selectedFilter: string) => {
    setFilter((prevFilters) => {
      const newFilters = prevFilters.includes(selectedFilter)
        ? prevFilters.filter((f) => f !== selectedFilter)
        : [...prevFilters, selectedFilter];
  
      setActiveFilters(newFilters);      
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
                {filters.outros.map((option, optionIdx) => (
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
