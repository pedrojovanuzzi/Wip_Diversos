import { FiMessageCircle } from "react-icons/fi";

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
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="inline-flex rounded-xl p-2.5 bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200">
          <FiMessageCircle className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Opiniões dos clientes
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Feedbacks mais recentes recebidos pela pesquisa de satisfação.
          </p>
        </div>
      </div>

      {(!people || people.length === 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center text-slate-500">
          Nenhuma opinião registrada ainda.
        </div>
      )}

      {people && people.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {people.map((person, idx) => (
            <article
              key={`${person.login}-${idx}`}
              className="p-5 sm:p-6 hover:bg-slate-50 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-white text-sm font-bold inline-flex items-center justify-center shadow-sm">
                    {(person.login || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {person.login || "—"}
                    </p>
                    <p className="text-xs text-slate-400">Técnico no local</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 self-start sm:self-auto">
                  {person.time}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-700 leading-relaxed break-words">
                {person.opnion || (
                  <span className="italic text-slate-400">Sem comentário.</span>
                )}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
