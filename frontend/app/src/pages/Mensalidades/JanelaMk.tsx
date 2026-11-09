import React, { useEffect } from "react";
import { FONTE_MK } from "./mkauthEstilo";

/**
 * As ações do MK-Auth abrem numa janela à parte com faixa escura e o título
 * em branco ("Receber titulo 004"). Aqui é um modal com o mesmo desenho.
 */
export function JanelaMk({
  titulo,
  subtitulo,
  onFechar,
  children,
  largura = 900,
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  onFechar: () => void;
  children: React.ReactNode;
  largura?: number;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  return (
    <div
      // Abaixo do aviso de Sucesso/Erro do sistema (z-[100]), que precisa
      // aparecer por cima desta janela.
      className="fixed inset-0 z-[90] bg-black/50 flex items-start justify-center overflow-y-auto p-2 sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white w-full shadow-xl text-left"
        style={{ maxWidth: largura, fontFamily: FONTE_MK, color: "#4a4a4a" }}
      >
        <div className="bg-[#363636] text-white px-4 sm:px-10 py-5 flex justify-between items-start gap-4">
          <div>
            <h2 className="text-[26px] font-semibold leading-tight">{titulo}</h2>
            {subtitulo && <p className="text-[15px] mt-1">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="text-2xl leading-none opacity-80 hover:opacity-100"
          >
            ×
          </button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

export const inputMk =
  "w-full h-[30px] border border-[#dbdbdb] rounded px-2 text-[15px] bg-white focus:outline-none focus:border-[#3273dc] disabled:bg-[#f5f5f5]";

export function CampoMk({
  rotulo,
  children,
}: {
  rotulo: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3">
      <strong className="block text-[15px] mb-1">{rotulo}</strong>
      {children}
    </label>
  );
}

export function BotoesMk({
  rotulo,
  enviando,
  onCancelar,
  perigo,
}: {
  rotulo: string;
  enviando?: boolean;
  onCancelar: () => void;
  perigo?: boolean;
}) {
  return (
    <div className="flex gap-1 mt-4">
      <button
        type="submit"
        disabled={enviando}
        className={`h-[30px] px-3 rounded text-white text-[15px] disabled:opacity-60 ${perigo ? "bg-[#f14668]" : "bg-[#3273dc]"}`}
      >
        {enviando ? "Aguarde..." : rotulo}
      </button>
      <button
        type="button"
        onClick={onCancelar}
        className="h-[30px] px-3 rounded bg-[#ffdd57] text-[rgba(0,0,0,.7)] text-[15px]"
      >
        Cancelar
      </button>
    </div>
  );
}

/** Campo de dinheiro com o ícone de cédula, como no MK-Auth. */
export function DinheiroMk(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#b5b5b5] text-xs">
        R$
      </span>
      <input {...props} inputMode="decimal" className={`${inputMk} pl-8`} />
    </div>
  );
}

export function RadiosMk({
  nome,
  valor,
  opcoes,
  onChange,
}: {
  nome: string;
  valor: string;
  opcoes: { valor: string; rotulo: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-6 text-[15px]">
      {opcoes.map((o) => (
        <label key={o.valor} className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={nome}
            checked={valor === o.valor}
            onChange={() => onChange(o.valor)}
            className="w-5 h-5 accent-[#00d1b2]"
          />
          {o.rotulo}
        </label>
      ))}
    </div>
  );
}
