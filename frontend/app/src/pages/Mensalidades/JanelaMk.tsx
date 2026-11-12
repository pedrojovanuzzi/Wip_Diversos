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
  corpoClassName = "p-4 sm:p-6",
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  onFechar: () => void;
  children: React.ReactNode;
  largura?: number;
  /** Classes do corpo (padrão: fundo branco com respiro). */
  corpoClassName?: string;
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
      className="fixed inset-0 z-[90] bg-black/50 flex items-start justify-center overflow-y-auto p-0 sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        // No celular ocupa a tela inteira; do sm para cima é uma janela.
        className="bg-white w-full min-h-full sm:min-h-0 shadow-xl text-left sm:rounded-lg"
        style={{ maxWidth: largura, fontFamily: FONTE_MK, color: "#4a4a4a" }}
      >
        <div className="sticky top-0 z-10 sm:rounded-t-lg bg-[#363636] text-white px-4 sm:px-8 py-3 sm:py-5 flex justify-between items-start gap-4">
          <div className="min-w-0">
            <h2 className="text-[20px] sm:text-[26px] font-semibold leading-tight">{titulo}</h2>
            {subtitulo && <p className="text-[13px] sm:text-[15px] mt-0.5 opacity-90">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="w-9 h-9 -mr-2 rounded-full text-2xl leading-none opacity-80 hover:opacity-100 hover:bg-white/10"
          >
            ×
          </button>
        </div>
        <div className={corpoClassName}>{children}</div>
      </div>
    </div>
  );
}

export const inputMk =
  "w-full h-[36px] border border-[#dbdbdb] rounded-md px-3 text-[15px] bg-white focus:outline-none focus:border-[#3273dc] focus:ring-2 focus:ring-[#3273dc]/15 disabled:bg-[#f5f5f5]";

export function CampoMk({
  rotulo,
  children,
}: {
  rotulo: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3">
      <strong className="block text-[13px] font-semibold text-[#363636] mb-1">{rotulo}</strong>
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
    <div className="flex flex-col-reverse sm:flex-row gap-2 mt-5 pt-3 border-t border-[#eef0f2]">
      <button
        type="submit"
        disabled={enviando}
        className={`h-[36px] px-4 rounded-md text-white text-[14px] font-semibold disabled:opacity-60 ${perigo ? "bg-[#f14668] hover:bg-[#e03a5b]" : "bg-[#3273dc] hover:bg-[#2763c4]"}`}
      >
        {enviando ? "Aguarde..." : rotulo}
      </button>
      <button
        type="button"
        onClick={onCancelar}
        className="h-[36px] px-4 rounded-md bg-white border border-[#dbdbdb] text-[#363636] text-[14px] font-semibold hover:border-[#3273dc] hover:text-[#3273dc]"
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
