"use client";

import { useEffect, useState } from "react";
import type { OnuData } from "@/lib/types";

export default function OnuList({ list, title }: { list: OnuData[]; title?: string }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleCheckboxChange = (sn: string) => {
    setSelectedIds((prev) =>
      prev.includes(sn) ? prev.filter((id) => id !== sn) : [...prev, sn],
    );
  };

  useEffect(() => {
    try {
      localStorage.setItem("sn", JSON.stringify(selectedIds));
    } catch {}
  }, [selectedIds]);

  return (
    <div>
      <div className="sm:flex-auto">
        <h1 className="text-base font-semibold text-gray-900">Lista de Onu&apos;s</h1>
        <p className="mt-2 text-sm text-gray-700">
          {title ?? "Uma lista de Todas as Onu Online na Pon digitada"}
        </p>
      </div>
      <div className="mt-8 flex justify-center">
        <div className="overflow-x-auto w-1/2">
          <div className="inline-block min-w-full max-h-72 py-2 align-middle sm:px-6 lg:px-8">
            <table className="relative min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th className="py-3 pl-4 pr-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0">ID</th>
                  <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500">Slot Pon</th>
                  <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500">Modelo</th>
                  <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500">Sn</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {list.map((item) => (
                  <tr key={item.sn}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">{item.onuid}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.slotPon.slice(0, 2)}/{item.slotPon.slice(2)}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.model}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.sn}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.sn)}
                        onChange={() => handleCheckboxChange(item.sn)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
