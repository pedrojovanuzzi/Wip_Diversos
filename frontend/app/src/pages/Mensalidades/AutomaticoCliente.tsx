import React, { useState } from "react";
import { useNotification } from "../../context/NotificationContext";
import { ApiMensalidades, Detalhe, mensagemDeErro } from "./api";

/**
 * Interruptor "Boleto automático" na página do cliente. Desligado, a
 * engrenagem não toca este cliente (nem mensalidade, nem bolix,
 * nem lembrete por e-mail); os botões manuais continuam valendo.
 * Só nível 5 muda; os outros só veem.
 */
export function AutomaticoCliente({
  api,
  login,
  estado,
  podeMudar,
  onMudou,
}: {
  api: ApiMensalidades;
  login: string;
  estado: Detalhe["automatico"];
  podeMudar: boolean;
  onMudou: (e: Detalhe["automatico"]) => void;
}) {
  const { showError, showSuccess } = useNotification();
  const [salvando, setSalvando] = useState(false);
  const ligado = estado.automatico;

  const mudar = async () => {
    setSalvando(true);
    try {
      const novo = await api.definirAutomatico(login, !ligado);
      onMudou(novo);
      showSuccess(
        novo.automatico
          ? "Boleto automático ligado para este cliente."
          : "Boleto automático desligado: a engrenagem não mexe mais neste cliente.",
      );
    } catch (e) {
      showError(mensagemDeErro(e, "Erro ao mudar o boleto automático."));
    } finally {
      setSalvando(false);
    }
  };

  const explicacao = ligado
    ? "A engrenagem cria as mensalidades que faltam, gera o boleto e manda os lembretes deste cliente."
    : "Nada automático para este cliente (mensalidade, boleto e lembretes). Os botões manuais continuam funcionando.";

  return (
    <div className="flex flex-col items-start lg:items-end gap-1.5 text-[13px] shrink-0">
      <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        disabled={!podeMudar || salvando}
        onClick={mudar}
        title={
          (podeMudar ? "" : "Só administrador (nível 5) muda. ") +
          explicacao +
          (estado.atualizadoPor ? ` Última mudança: ${estado.atualizadoPor}.` : "")
        }
        className={`flex items-center gap-2 rounded-full pl-1 pr-3 py-1 font-bold shadow-[0_1px_2px_rgba(0,0,0,.06)] disabled:cursor-not-allowed ${
          ligado ? "bg-[#effaf3] text-[#257942]" : "bg-[#feecf0] text-[#cc0f35]"
        } ${salvando ? "opacity-60" : ""}`}
      >
        <span
          className={`relative w-[34px] h-[20px] rounded-full transition-colors ${
            ligado ? "bg-[#48c774]" : "bg-[#f14668]"
          }`}
        >
          <span
            className={`absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white transition-all ${
              ligado ? "left-[17px]" : "left-[3px]"
            }`}
          />
        </span>
        Boleto automático {ligado ? "ligado" : "desligado"}
      </button>
      </div>
    </div>
  );
}
