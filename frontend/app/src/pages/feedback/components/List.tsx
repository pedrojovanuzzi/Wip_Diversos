interface Opnion {
  login: string;
  opnion: string;
  time: string;
}

interface ListProps {
  people: Opnion[];
}

export default function List({ people }: ListProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:p-10">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold text-gray-900">Opiniões</h1>
          <p className="mt-2 text-sm text-gray-700">
            Uma Lista dos Feedbacks mais recentes dos clientes
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none"></div>
      </div>
      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full divide-y divide-gray-300 h-screen">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="py-3.5 pl-4 pr-3 text-center text-sm font-semibold text-gray-900 sm:pl-0"
                  >
                    Técnico no Local
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900"
                  >
                    Feedback
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-sm text-center font-semibold text-gray-900"
                  >
                    Horário
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {people.map((person) => (
                  <tr key={person.login}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm  font-medium text-gray-900 sm:pl-0">
                      {person.login}
                    </td>
                    <td className="px-3 py-4 text-sm max-w-md break-all overflow-hidden text-gray-500">
                      {person.opnion}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm  text-gray-500">
                      {person.time}
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
