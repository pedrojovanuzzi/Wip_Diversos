import { useEffect, useState } from "react";
import { OnuData } from "../../../types";


export default function OnuList({ list, title }: { list: OnuData[], title? : string  }) {

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleCheckboxChange = (sn: string) => {
    setSelectedIds((prev) => {
      if(prev.includes(sn)){
        return prev.filter((itemId) => itemId !== sn);
      }

      return [...prev, sn];
    })
  }

  useEffect(() => {
    try {
      localStorage.setItem("sn", JSON.stringify(selectedIds));
    } catch (error) {
      console.error(error);
    }
  }, [selectedIds])




  return (
    <div className="">
      <div className="">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold text-gray-900">Lista de Onu's</h1>
          <p className="mt-2 text-sm text-gray-700">
            {title ?? <>Uma lista de Todas as Onu Online<br></br> na Pon digitada</>}
          </p>
        </div>
      </div>
      <div className="mt-8 flow-root">
        <div className="overflow-x-auto ">
          <div className="inline-block min-w-full max-h-72 py-2 align-middle sm:px-6 lg:px-8">
            <table className="relative min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="py-3 pl-4 pr-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0"
                  >
                    ID
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Slot Pon
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Modelo
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Sn
                  </th>
                  <th>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {list.map((list) => (
                  <tr key={list.sn}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                      {list.onuid}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{list.slotPon.slice(0,2)}/{list.slotPon.slice(2,3)}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{list.model}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{list.sn}</td>
                    <td><input checked={selectedIds.includes(list.sn)} onChange={() => handleCheckboxChange(list.sn)} type="checkbox" name="" id="" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
