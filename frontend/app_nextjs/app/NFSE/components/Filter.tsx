"use client";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { FunnelIcon } from "@heroicons/react/20/solid";
import { useState } from "react";
import Calendar from "./Calendar";
import Line from "./Line";
import { CiCirclePlus } from "react-icons/ci";
import { IoArrowUpCircleOutline } from "react-icons/io5";
import { useRouter } from "next/navigation";
import axios from "axios";
import SetPassword from "./SetPassword";
import type { User } from "@/lib/auth";

const filtersData = {
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
  SCM: [{ value: "SCM", label: "SCM" }],
  servicos: [{ value: "servicos", label: "Servicos" }],
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
  enviarCertificado: (file: File | null) => void;
  user: User;
}

export default function Filter({
  setActiveFilters,
  setDate,
  setArquivo,
  enviarCertificado,
  user
}: FilterProps) {
  const [filter, setFilter] = useState<string[]>([]);
  const router = useRouter();

  const [password, setPassword] = useState<string>("");
  const [showPasswordPopUp, setShowPasswordPopUp] = useState(false);

  const setSessionPassword = async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/setSessionPassword`,
        { password: password },
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            "Content-Type": "application/json",
          },
        }
      );
      window.location.reload();
    } catch (e) {
      console.error("Error setting session password", e);
    } finally {
      setShowPasswordPopUp(false);
    }
  };

  const categorizeFilters = (filtersArray: string[]) => {
    const categorizedFilters = {
      plano: [] as string[],
      vencimento: [] as string[],
      cli_ativado: [] as string[],
      SCM: [] as string[],
      servicos: [] as string[],
    };
    const planos = filtersData.plano.map(p => p.value);
    const vencimentos = filtersData.vencimento.map(v => v.value);
    
    filtersArray.forEach((f) => {
      if (planos.includes(f)) categorizedFilters.plano.push(f);
      else if (f === "SCM") categorizedFilters.SCM = [f];
      else if (f === "active_client") categorizedFilters.cli_ativado = [f];
      else if (vencimentos.includes(f)) categorizedFilters.vencimento.push(f);
      else if (f === "servicos") categorizedFilters.servicos = [f];
    });
    return categorizedFilters;
  };

  const clickedFilter = (selectedFilter: string) => {
    setFilter((prevFilters) => {
      let newFilters;
      if (selectedFilter === "new_nfe") {
        newFilters = prevFilters.includes(selectedFilter)
          ? prevFilters.filter((f) => f !== selectedFilter)
          : prevFilters
              .filter((f) => !f.includes("new_nfe"))
              .concat(selectedFilter);
      } else {
        newFilters = prevFilters.includes(selectedFilter)
          ? prevFilters.filter((f) => f !== selectedFilter)
          : [...prevFilters, selectedFilter];
      }
      setActiveFilters(categorizeFilters(newFilters));
      return newFilters;
    });
  };

  const clearFilter = () => {
    setFilter([]);
    setActiveFilters({
      plano: [],
      vencimento: [],
      cli_ativado: [],
      SCM: [],
      servicos: [],
    });
  };

  return (
    <div className="bg-white">
      <Disclosure
        as="section"
        aria-labelledby="filter-heading"
        className="grid items-center border-b border-t "
      >
        <h2 id="filter-heading" className="sr-only">
          Filtros
        </h2>
        <div className="relative col-start-1 row-start-1 py-4">
          <div className="mx-auto flex flex-col sm:flex-row items-center justify-between gap-5 max-w-7xl px-4 text-sm sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
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
                className="text-gray-500 hover:text-gray-700"
              >
                Limpar Filtro
              </button>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4 justify-center">
              <label className="relative ring-1 ring-black ring-opacity-5 bg-slate-500 text-gray-200 py-3 px-8 rounded hover:bg-slate-400 transition-all cursor-pointer flex items-center">
                 <CiCirclePlus className="text-2xl mr-2" />
                 <span>Selecionar PFX</span>
                <input
                  type="file"
                  onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              <button
                className="bg-indigo-500 ring-1 ring-black ring-opacity-5 text-white py-3 px-8 rounded hover:bg-indigo-400 transition-all flex items-center justify-center"
                onClick={() => enviarCertificado(null)}
              >
                <IoArrowUpCircleOutline className="text-2xl mr-2" />
                Upload PFX
              </button>
              
              <button
                className="bg-indigo-500 ring-1 ring-black ring-opacity-5 text-white py-3 px-8 rounded hover:bg-indigo-400 transition-all flex items-center justify-center"
                onClick={() => setShowPasswordPopUp(true)}
              >
                <IoArrowUpCircleOutline className="text-2xl mr-2" />
                Senha Certificado
              </button>
              <button
                className="bg-green-500 ring-1 ring-black ring-opacity-5 text-white py-3 px-8 rounded hover:bg-green-400 transition-all flex items-center justify-center"
                onClick={() => router.push("/GerarNotaDeServicoIndependente")}
              >
                <CiCirclePlus className="text-2xl mr-2" />
                Nota Independente
              </button>
              {showPasswordPopUp && (
                <SetPassword
                  setShowPopUp={setShowPasswordPopUp}
                  showPopUp={showPasswordPopUp}
                  setPassword={setPassword}
                  password={password}
                  setSessionPassword={setSessionPassword}
                />
              )}
            </div>
          </div>
        </div>
        <DisclosurePanel className="border-t border-gray-200">
          <Calendar setDateFilter={setDate} />
          <Line />
          <div className="mx-auto flex flex-col items-center sm:grid sm:items-baseline sm:place-items-center max-w-7xl my-10 grid-cols-3 sm:gap-4 sm:px-6 text-sm md:gap-x-6 lg:px-8">
            <fieldset className="my-5">
              <legend className="block font-medium">Plano</legend>
              <div className="space-y-4 pt-4">
                {filtersData.plano.map((option, optionIdx) => (
                  <div key={option.value} className="flex gap-3 items-center">
                    <input
                      value={option.value}
                      checked={filter.includes(option.value)}
                      onChange={() => clickedFilter(option.value)}
                      id={`plano-${optionIdx}`}
                      name="plano[]"
                      type="checkbox"
                      className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                    />
                    <label
                      htmlFor={`plano-${optionIdx}`}
                      className="text-sm text-gray-600 cursor-pointer"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>
            
            <fieldset className="my-5">
              <legend className="block font-medium">Outros</legend>
              <div className="space-y-4 pt-4">
                {filtersData.cli_ativado.map((option, optionIdx) => (
                  <div key={option.value} className="flex gap-3 items-center">
                    <input
                      value={option.value}
                      checked={filter.includes(option.value)}
                      onChange={() => clickedFilter(option.value)}
                      id={`outros-cli-${optionIdx}`}
                      name="outros[]"
                      type="checkbox"
                      className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                    />
                    <label
                      htmlFor={`outros-cli-${optionIdx}`}
                      className="text-sm text-gray-600 cursor-pointer"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
                {filtersData.SCM.map((option, optionIdx) => (
                  <div key={option.value} className="flex gap-3 items-center">
                    <input
                      value={option.value}
                      checked={filter.includes(option.value)}
                      onChange={() => clickedFilter(option.value)}
                      id={`outros-scm-${optionIdx}`}
                      name="outros[]"
                      type="checkbox"
                      className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                    />
                    <label
                      htmlFor={`outros-scm-${optionIdx}`}
                      className="text-sm text-gray-600 cursor-pointer"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
                {filtersData.servicos.map((option, optionIdx) => (
                  <div key={option.value} className="flex gap-3 items-center">
                    <input
                      value={option.value}
                      checked={filter.includes(option.value)}
                      onChange={() => clickedFilter(option.value)}
                      id={`outros-serv-${optionIdx}`}
                      name="outros[]"
                      type="checkbox"
                      className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                    />
                    <label
                      htmlFor={`outros-serv-${optionIdx}`}
                      className="text-sm text-gray-600 cursor-pointer"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset className="my-5">
              <legend className="block font-medium">Vencimento</legend>
              <div className="space-y-4 pt-4">
                {filtersData.vencimento.map((option, optionIdx) => (
                  <div key={option.value} className="flex gap-3 items-center">
                    <input
                      value={option.value}
                      checked={filter.includes(option.value)}
                      onChange={() => clickedFilter(option.value)}
                      id={`vencimento-${optionIdx}`}
                      name="vencimento[]"
                      type="checkbox"
                      className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                    />
                    <label
                      htmlFor={`vencimento-${optionIdx}`}
                      className="text-sm text-gray-600 cursor-pointer"
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
