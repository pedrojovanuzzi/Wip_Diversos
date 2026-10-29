import React, { useState } from "react";
import { BsCollectionPlay } from "react-icons/bs";

/**
 * Link para o cliente criar a conta da Watch TV, em destaque: sem ele o
 * serviço fica cobrado e o cliente sem acesso, então não pode passar batido.
 */
export default function LinkContaWatchTv({
  link,
  expiraEm,
  substitui,
  compacto,
}: {
  link: string;
  expiraEm?: string | null;
  /** O cadastro já tem conta: usar o link troca pela nova. */
  substitui?: boolean;
  /** Versão menor, para caber numa linha de tabela. */
  compacto?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência: o campo continua selecionável.
    }
  };

  return (
    <div
      className={`rounded-lg border-2 border-amber-400 bg-amber-50 ${
        compacto ? "p-2" : "p-3"
      }`}
    >
      <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
        <BsCollectionPlay className="shrink-0" />
        Envie ao cliente: link para criar a conta da Watch TV
      </div>
      <div className="mt-2 flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded border border-amber-300 bg-white p-2 text-xs"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            copiar();
          }}
          className="whitespace-nowrap rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          {copiado ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <p className="mt-1 text-xs text-amber-800">
        Enquanto o cliente não usar o link, a Watch TV está cobrada e sem
        acesso.
        {substitui && " Usar o link substitui a conta atual na Watch TV."}
        {expiraEm &&
          ` Vale até ${new Date(expiraEm).toLocaleDateString("pt-BR")}.`}
      </p>
    </div>
  );
}
