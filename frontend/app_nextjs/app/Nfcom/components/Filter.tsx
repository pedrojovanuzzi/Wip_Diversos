"use client";

import React, { useState } from "react";
import { BiCalendar, BiChevronDown, BiChevronUp, BiFilterAlt } from "react-icons/bi";
import { IoArrowUpCircleOutline } from "react-icons/io5";

interface FilterProps {
  setActiveFilters: React.Dispatch<React.SetStateAction<any>>;
  setDate: React.Dispatch<React.SetStateAction<any>>;
  setArquivo: (file: File | null) => void;
  enviarCertificado: () => void;
}

export default function Filter({ setActiveFilters, setDate, setArquivo, enviarCertificado }: FilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState({
    plano: [] as string[],
    vencimento: [] as string[],
    cli_ativado: [] as string[],
    nova_nfe: [] as string[],
    SVA: [] as string[],
    servicos: [] as string[],
  });
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [fileName, setFileName] = useState("");

  const handleCheckbox = (category: keyof typeof localFilters, value: string) => {
    setLocalFilters((prev) => {
      const exists = prev[category].includes(value);
      const updated = exists ? prev[category].filter((v) => v !== value) : [...prev[category], value];
      const newFilters = { ...prev, [category]: updated };
      setActiveFilters(newFilters);
      return newFilters;
    });
  };

  const applyDate = () => {
    setDate({ start: dataInicio, end: dataFim });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-20 relative z-20">
      <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BiFilterAlt className="text-xl text-sky-600" />
            <span className="font-bold text-gray-800">Filtros e Certificado</span>
          </div>
          {isOpen ? <BiChevronUp className="text-2xl" /> : <BiChevronDown className="text-2xl" />}
        </button>

        {isOpen && (
          <div className="p-6 border-t animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Plano Section */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Plano</h3>
                <div className="space-y-2">
                  {["Fibra", "Radio", "Outros"].map((p) => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                        onChange={() => handleCheckbox("plano", p)}
                      />
                      <span className="text-sm text-gray-700 group-hover:text-sky-600 transition-colors">{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Vencimento Section */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Vencimento</h3>
                <div className="grid grid-cols-2 gap-2">
                  {["01", "05", "10", "15", "20", "25", "30"].map((v) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-gray-300 text-sky-600"
                        onChange={() => handleCheckbox("vencimento", v)}
                      />
                      <span className="text-sm text-gray-700">{v}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Status Section */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Status / NF</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="size-4 rounded text-sky-600" onChange={() => handleCheckbox("cli_ativado", "s")} />
                    <span className="text-sm text-gray-700">Ativo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="size-4 rounded text-sky-600" onChange={() => handleCheckbox("SVA", "SVA")} />
                    <span className="text-sm font-bold text-sky-700">Somente SVA</span>
                  </label>
                </div>
              </div>

              {/* Certificate Section */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Certificado PFX</h3>
                <div className="space-y-4">
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 border-gray-300 transition-all">
                    <IoArrowUpCircleOutline className="text-2xl text-gray-400" />
                    <span className="text-xs text-gray-500 mt-2 text-center px-2 truncate w-full">
                      {fileName || "Selecionar arquivo .pfx"}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setArquivo(file);
                        setFileName(file ? file.name : "");
                      }}
                    />
                  </label>
                  <button
                    onClick={enviarCertificado}
                    disabled={!fileName}
                    className="w-full bg-sky-600 text-white h-10 rounded-md font-bold text-xs hover:bg-sky-700 disabled:opacity-50 shadow-md"
                  >
                    Fazer Upload
                  </button>
                </div>
              </div>
            </div>

            {/* Date Filters */}
            <div className="mt-8 pt-8 border-t flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Data Início</label>
                <div className="relative">
                  <BiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    className="h-10 pl-10 pr-3 border rounded-md focus:ring-2 focus:ring-sky-500"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Data Fim</label>
                <div className="relative">
                  <BiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    className="h-10 pl-10 pr-3 border rounded-md focus:ring-2 focus:ring-sky-500"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={applyDate}
                className="bg-gray-800 text-white h-10 px-6 rounded-md hover:bg-gray-700 transition-all font-bold text-xs uppercase"
              >
                Aplicar Período
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
