import React from "react";

/**
 * Peças visuais da engrenagem da tela Mensalidades (cartões, interruptor,
 * selos e botões), para a geração de boletos e os e-mails terem o mesmo
 * desenho e funcionarem no celular.
 */

export function Cartao({
  titulo,
  descricao,
  icone,
  direita,
  children,
  rodape,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  icone?: React.ReactNode;
  direita?: React.ReactNode;
  children?: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-lg border border-[#e3e6ea] shadow-[0_1px_2px_rgba(0,0,0,.04)] overflow-hidden">
      <header className="flex flex-col sm:flex-row sm:items-start gap-3 px-4 sm:px-5 pt-4 pb-3">
        {icone && (
          <span className="hidden sm:flex w-9 h-9 shrink-0 rounded-lg bg-[#eef3fc] text-[#3273dc] items-center justify-center text-[18px]">
            {icone}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[16px] text-[#363636] leading-tight">{titulo}</h3>
          {descricao && (
            <p className="text-[13px] text-[#7a7a7a] mt-1 leading-snug">{descricao}</p>
          )}
        </div>
        {direita && <div className="shrink-0">{direita}</div>}
      </header>
      {children && <div className="px-4 sm:px-5 pb-4">{children}</div>}
      {rodape && (
        <footer className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center gap-2 px-4 sm:px-5 py-3 bg-[#fafbfc] border-t border-[#eef0f2]">
          {rodape}
        </footer>
      )}
    </section>
  );
}

export function Interruptor({
  ligado,
  onChange,
  rotulos = ["Ligado", "Desligado"],
  title,
}: {
  ligado: boolean;
  onChange: (v: boolean) => void;
  rotulos?: [string, string];
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => onChange(!ligado)}
      title={title}
      className={`inline-flex items-center gap-2 rounded-full pl-1 pr-3 py-1 font-bold text-[13px] transition-colors ${
        ligado ? "bg-[#effaf3] text-[#257942]" : "bg-[#f1f2f4] text-[#7a7a7a]"
      }`}
    >
      <span
        className={`relative w-[38px] h-[22px] rounded-full transition-colors ${
          ligado ? "bg-[#48c774]" : "bg-[#b5b5b5]"
        }`}
      >
        <span
          className={`absolute top-[3px] w-[16px] h-[16px] rounded-full bg-white shadow transition-all ${
            ligado ? "left-[19px]" : "left-[3px]"
          }`}
        />
      </span>
      {ligado ? rotulos[0] : rotulos[1]}
    </button>
  );
}

const CORES_SELO = {
  verde: "bg-[#effaf3] text-[#257942] border-[#c8eed6]",
  amarelo: "bg-[#fffaeb] text-[#946c00] border-[#ffe8a3]",
  vermelho: "bg-[#feecf0] text-[#cc0f35] border-[#fbcbd6]",
  cinza: "bg-[#f5f6f8] text-[#4a4a4a] border-[#e3e6ea]",
} as const;

export function Selo({
  cor = "cinza",
  children,
  title,
}: {
  cor?: keyof typeof CORES_SELO;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] leading-[18px] ${CORES_SELO[cor]}`}
    >
      {children}
    </span>
  );
}

const CORES_BOTAO = {
  primario: "bg-[#3273dc] text-white hover:bg-[#2763c4] border-transparent",
  sucesso: "bg-[#48c774] text-white hover:bg-[#3abb67] border-transparent",
  contorno: "bg-white text-[#363636] border-[#dbdbdb] hover:border-[#3273dc] hover:text-[#3273dc]",
  escuro: "bg-[#363636] text-white hover:bg-[#242424] border-transparent",
  leve: "bg-transparent text-[#4a4a4a] border-transparent hover:bg-[#f1f2f4]",
} as const;

export function Botao({
  variante = "contorno",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof CORES_BOTAO;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`h-[36px] px-4 rounded-md border text-[14px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto ${CORES_BOTAO[variante]} ${className}`}
    />
  );
}

/** Caixa de confirmação dentro do cartão (no lugar de um alert). */
export function Confirmacao({
  children,
  confirmar,
  onConfirmar,
  onCancelar,
}: {
  children: React.ReactNode;
  confirmar: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="mt-3 p-3 rounded-md border border-[#ffe8a3] bg-[#fffaeb] text-[14px]">
      <p className="mb-3">{children}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Botao variante="sucesso" onClick={onConfirmar}>
          {confirmar}
        </Botao>
        <Botao variante="leve" onClick={onCancelar}>
          Cancelar
        </Botao>
      </div>
    </div>
  );
}

export function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className="rounded-md border border-[#eef0f2] bg-[#fafbfc] px-3 py-2">
      <div className="text-[12px] text-[#7a7a7a]">{rotulo}</div>
      <div className={`text-[20px] font-bold leading-tight ${destaque ? "text-[#257942]" : "text-[#363636]"}`}>
        {valor}
      </div>
    </div>
  );
}

export const campo =
  "w-full h-[36px] border border-[#dbdbdb] rounded-md px-3 text-[14px] bg-white focus:outline-none focus:border-[#3273dc] focus:ring-2 focus:ring-[#3273dc]/15";

/**
 * Célula de uma linha em grade: no computador é uma coluna; no celular vira
 * "RÓTULO valor" empilhado (o rótulo só aparece no celular).
 */
export function Celula({
  rotulo,
  children,
  className = "",
}: {
  rotulo?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      {rotulo && (
        <span className="md:hidden inline-block w-[92px] text-[11px] uppercase tracking-wide text-[#9aa0a6]">
          {rotulo}
        </span>
      )}
      {children}
    </div>
  );
}

/** Cabeçalho das colunas da grade (só no computador). */
export const cabecalhoGrade =
  "hidden md:grid items-center gap-x-3 px-4 py-2 bg-[#fafbfc] border-b border-[#e3e6ea] text-[11px] font-bold uppercase tracking-wide text-[#7a7a7a]";

/** Caixa de marcar maior e azul. */
export const caixinha = "w-4 h-4 accent-[#3273dc] cursor-pointer align-middle";
