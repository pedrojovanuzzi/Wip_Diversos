import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { ApiMensalidades, Bolix, mensagemDeErro, Titulo } from "./api";
import { JanelaMk } from "./JanelaMk";
import { dataCurta, numeroTitulo, reais } from "./mkauthEstilo";

// Status das cobranças da Efí, em português.
const SITUACAO_EFI: Record<string, string> = {
  new: "cobrança criada",
  waiting: "aguardando pagamento",
  unpaid: "não paga no vencimento",
  paid: "paga",
  settled: "baixada manualmente na Efí",
  canceled: "cancelada",
  expired: "expirada",
  refunded: "devolvida",
  contested: "contestada",
  identified: "pagamento identificado",
  link: "link de pagamento",
};

function Copiavel({ rotulo, texto }: { rotulo: string; texto: string }) {
  const { showSuccess } = useNotification();
  return (
    <div className="mb-3">
      <strong className="block text-[15px] mb-1">{rotulo}</strong>
      <div className="flex gap-1">
        <input
          readOnly
          value={texto}
          onFocus={(e) => e.target.select()}
          className="flex-1 min-w-0 h-[30px] border border-[#dbdbdb] rounded px-2 text-[14px] font-mono bg-[#f5f5f5]"
        />
        <button
          type="button"
          onClick={() =>
            navigator.clipboard
              ?.writeText(texto)
              .then(() => showSuccess(`${rotulo} copiado.`))
          }
          className="h-[30px] px-3 rounded bg-[#363636] text-white text-[14px]"
        >
          Copiar
        </button>
      </div>
    </div>
  );
}

/**
 * Bolix da Efí (boleto + Pix) do título. Abrir a janela gera a cobrança na
 * Efí se ainda não houver uma válida para o valor e vencimento atuais.
 */
export function BolixTitulo({
  api,
  titulo,
  onFechar,
  onFeito,
}: {
  api: ApiMensalidades;
  titulo: Titulo;
  onFechar: () => void;
  onFeito: () => void;
}) {
  const { showError, showSuccess } = useNotification();
  const { user } = useAuth();
  // Cancelar cobrança é nível 5, como no backend.
  const podeCancelar = (user?.permission || 0) >= 5;
  const [b, setB] = useState<Bolix | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState<"" | "gerar" | "verificar" | "cancelar">(
    "gerar",
  );
  const [confirmando, setConfirmando] = useState(false);
  const [cancelado, setCancelado] = useState("");

  const cancelar = async () => {
    if (!b) return;
    setOcupado("cancelar");
    try {
      await api.cancelarBolix(titulo.id);
      showSuccess(`Boleto ${b.charge_id} cancelado na Efí.`);
      setCancelado(String(b.charge_id));
      setB(null);
      onFeito();
    } catch (e) {
      showError(mensagemDeErro(e, "Erro ao cancelar o boleto na Efí."));
    } finally {
      setOcupado("");
      setConfirmando(false);
    }
  };

  const gerar = useCallback(
    async (forcar = false) => {
      setOcupado("gerar");
      setErro("");
      try {
        setB(await api.bolix(titulo.id, forcar));
        setCancelado("");
        if (forcar) showSuccess("Boleto gerado de novo na Efí.");
        onFeito();
      } catch (e) {
        setErro(mensagemDeErro(e, "Erro ao gerar o boleto na Efí."));
      } finally {
        setOcupado("");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, titulo.id],
  );

  useEffect(() => {
    gerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo.id]);

  const verificar = async () => {
    setOcupado("verificar");
    try {
      const r = await api.verificarBolix(titulo.id);
      if (r.baixado) {
        showSuccess(`Pago na Efí: título ${numeroTitulo(titulo.id)} baixado.`);
        onFeito();
        onFechar();
      } else if (["paid", "settled"].includes(r.status)) {
        showSuccess(`Pago na Efí (${r.motivo || "já baixado"}).`);
        onFeito();
      } else {
        showSuccess(
          `Ainda não pago. Situação na Efí: ${SITUACAO_EFI[r.status] || r.status || "desconhecida"}.`,
        );
      }
    } catch (e) {
      showError(mensagemDeErro(e, "Erro ao consultar a Efí."));
    } finally {
      setOcupado("");
    }
  };

  return (
    <JanelaMk
      titulo={`Boleto titulo ${String(titulo.id).padStart(3, "0")}`}
      subtitulo="bolix da Efí: boleto com QR Code Pix"
      onFechar={onFechar}
      largura={760}
    >
      {ocupado === "gerar" && !b && <p className="py-4">Gerando na Efí...</p>}
      {cancelado && !b && ocupado !== "gerar" && (
        <div className="py-2 text-[15px]">
          <p className="mb-3">
            Boleto (cobrança Efí {cancelado}) cancelado. O título continua em
            aberto no MK-Auth e a geração automática não cria outro sozinha.
          </p>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => gerar()}
              className="h-[30px] px-3 rounded bg-[#3273dc] text-white"
            >
              Gerar novo boleto
            </button>
            <button
              type="button"
              onClick={onFechar}
              className="h-[30px] px-3 rounded bg-[#ffdd57] text-[rgba(0,0,0,.7)]"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
      {erro && (
        <div className="py-2">
          <p className="text-[#f14668] mb-3">{erro}</p>
          <button
            type="button"
            onClick={() => gerar()}
            className="h-[30px] px-3 rounded bg-[#3273dc] text-white"
          >
            Tentar de novo
          </button>
        </div>
      )}
      {b && (
        <div className="text-[15px]">
          <div className="flex flex-wrap gap-x-8 gap-y-1 mb-3">
            <span>
              <strong>Valor:</strong> {reais(b.valor)}
            </span>
            <span>
              <strong>Vencimento:</strong> {dataCurta(`${b.vencimento}T12:00:00`)}
            </span>
            <span>
              <strong>Cobrança Efí:</strong> {b.charge_id}
            </span>
          </div>
          {Number(b.valor) !== titulo.valorTotal && (
            <p className="text-[13px] text-[#7a7a7a] mb-3">
              Título vencido: o boleto vence hoje e já inclui multa e juros do
              dia. Depois disso a Efí cobra os juros.
            </p>
          )}
          {b.linha_digitavel && (
            <Copiavel rotulo="Linha digitável" texto={b.linha_digitavel} />
          )}
          {b.pix_copia_cola && (
            <div className="flex flex-col sm:flex-row gap-4 items-start mb-3">
              {b.pix_qrcode_imagem && (
                <img
                  src={b.pix_qrcode_imagem}
                  alt="QR Code Pix do boleto"
                  className="w-[170px] h-[170px] border border-[#dbdbdb]"
                />
              )}
              <div className="flex-1 min-w-0 w-full">
                <Copiavel rotulo="Pix copia e cola" texto={b.pix_copia_cola} />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1 mt-4">
            {b.pdf && (
              <a
                href={b.pdf}
                target="_blank"
                rel="noopener noreferrer"
                className="h-[30px] px-3 rounded bg-[#3273dc] text-white inline-flex items-center"
              >
                Abrir PDF
              </a>
            )}
            {b.link && (
              <a
                href={b.link}
                target="_blank"
                rel="noopener noreferrer"
                className="h-[30px] px-3 rounded bg-[#3e8ed0] text-white inline-flex items-center"
              >
                Ver boleto
              </a>
            )}
            <button
              type="button"
              disabled={!!ocupado}
              onClick={verificar}
              className="h-[30px] px-3 rounded bg-[#48c774] text-white disabled:opacity-60"
            >
              {ocupado === "verificar" ? "Consultando..." : "Verificar pagamento"}
            </button>
            <button
              type="button"
              disabled={!!ocupado}
              onClick={() => gerar(true)}
              className="h-[30px] px-3 rounded bg-[#363636] text-white disabled:opacity-60"
              title="Cancela este boleto na Efí e cria outro"
            >
              {ocupado === "gerar" ? "Gerando..." : "Gerar de novo"}
            </button>
            {podeCancelar && !confirmando && (
              <button
                type="button"
                disabled={!!ocupado}
                onClick={() => setConfirmando(true)}
                className="h-[30px] px-3 rounded bg-[#f14668] text-white disabled:opacity-60"
                title="Cancela este boleto na Efí; o título continua em aberto"
              >
                Cancelar boleto
              </button>
            )}
            <button
              type="button"
              onClick={onFechar}
              className="h-[30px] px-3 rounded bg-[#ffdd57] text-[rgba(0,0,0,.7)]"
            >
              Fechar
            </button>
          </div>
          {confirmando && (
            <div className="mt-3 p-3 rounded border border-[#f14668] text-[14px]">
              <p className="mb-2">
                Cancelar na Efí o boleto {b.charge_id}? A linha digitável e o
                Pix deixam de valer. O título continua em aberto.
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={!!ocupado}
                  onClick={cancelar}
                  className="h-[30px] px-3 rounded bg-[#f14668] text-white disabled:opacity-60"
                >
                  {ocupado === "cancelar" ? "Cancelando..." : "Sim, cancelar"}
                </button>
                <button
                  type="button"
                  disabled={ocupado === "cancelar"}
                  onClick={() => setConfirmando(false)}
                  className="h-[30px] px-3 rounded bg-[#363636] text-white"
                >
                  Não
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </JanelaMk>
  );
}
