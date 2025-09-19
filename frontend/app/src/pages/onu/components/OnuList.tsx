import { OnuData } from "../../../types";


export default function OnuList({ list }: { list: OnuData[] }) {
  return (
    <div className="">
      <div className="">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold text-gray-900">Lista de Onu's</h1>
          <p className="mt-2 text-sm text-gray-700">
            Uma lista de Todas as Onu Online<br></br> na Pon digitada
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {list.map((list) => (
                  <tr key={list.sn}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                      {list.onuid}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{list.slotPon}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{list.model}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{list.sn}</td>
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
