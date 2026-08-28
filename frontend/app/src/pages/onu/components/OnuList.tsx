import { useEffect, useState } from "react";
import { OnuData } from "../../../types";

/** "1104" → "11/04". Tolera valores curtos ou ausentes vindos da OLT. */
function formatarSlotPon(valor?: string): string {
  const bruto = String(valor || "").trim();
  if (bruto.length < 3) return bruto || "—";
  return `${bruto.slice(0, 2)}/${bruto.slice(2)}`;
}

interface Props {
  list: OnuData[];
  title?: string;
  /** Avisa o pai a cada mudança, para ele habilitar as ações. */
  onSelecaoChange?: (sns: string[]) => void;
}

export default function OnuList({ list, title, onSelecaoChange }: Props) {
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const alternar = (sn: string) =>
    setSelecionados((anterior) =>
      anterior.includes(sn)
        ? anterior.filter((item) => item !== sn)
        : [...anterior, sn],
    );

  const todosMarcados = list.length > 0 && selecionados.length === list.length;

  const alternarTodos = () =>
    setSelecionados(todosMarcados ? [] : list.map((onu) => onu.sn));

  // A seleção é lida pelas telas de autorizar/desautorizar.
  useEffect(() => {
    try {
      localStorage.setItem("sn", JSON.stringify(selecionados));
    } catch (error) {
      console.error(error);
    }
    onSelecaoChange?.(selecionados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionados]);

  // Lista nova (outra PON, outra busca): a seleção antiga não vale mais.
  // Mantém o mesmo array quando já está vazia: se o pai montar `list` inline,
  // criar um array novo aqui realimentaria o ciclo de renderização.
  useEffect(() => {
    setSelecionados((atual) => (atual.length ? [] : atual));
  }, [list]);

  if (list.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-white">
            {title ?? "ONUs encontradas"}
          </h2>
          <p className="text-xs text-gray-400">
            {list.length} ONU{list.length > 1 ? "s" : ""}
            {selecionados.length > 0 && ` · ${selecionados.length} selecionada${selecionados.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          type="button"
          onClick={alternarTodos}
          className="rounded-md border border-stone-600 px-3 py-1.5 text-xs text-gray-300 hover:bg-stone-800"
        >
          {todosMarcados ? "Limpar seleção" : "Selecionar todas"}
        </button>
      </div>

      <div className="max-h-96 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-stone-800">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={alternarTodos}
                  aria-label="Selecionar todas"
                  className="cursor-pointer"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                ID
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                Slot/PON
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                Modelo
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                SN
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((onu, indice) => {
              const marcada = selecionados.includes(onu.sn);
              return (
                <tr
                  key={onu.sn || indice}
                  onClick={() => alternar(onu.sn)}
                  className={`cursor-pointer border-t border-stone-800 transition-colors ${
                    marcada ? "bg-indigo-950/50" : "hover:bg-stone-800/60"
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={() => alternar(onu.sn)}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-200">{onu.onuid || "—"}</td>
                  <td className="px-3 py-2 text-gray-400">
                    {formatarSlotPon(onu.slotPon)}
                  </td>
                  <td className="px-3 py-2 text-gray-400">{onu.model || "—"}</td>
                  <td className="px-3 py-2 font-mono text-gray-200">{onu.sn}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
