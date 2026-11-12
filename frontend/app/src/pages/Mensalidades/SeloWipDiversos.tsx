import React from "react";

/**
 * Selo no topo das telas de Mensalidades. Elas copiam o visual do MK-Auth de
 * propósito, então o selo deixa claro que se está no Wip Diversos (que grava
 * direto no banco do MK-Auth) e não no próprio MK-Auth.
 */
export function SeloWipDiversos() {
  return (
    <span
      title="Tela do Wip Diversos. As ações gravam direto no MK-Auth, mas boleto, Pix e e-mail saem daqui."
      className="inline-block align-middle mr-3 px-2 py-0.5 rounded bg-[#ffdd57] text-[#363636] text-[11px] font-bold tracking-wide normal-case"
    >
      WIP DIVERSOS
    </span>
  );
}
