import React, { useMemo, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import { BsClipboard, BsExclamationTriangle } from "react-icons/bs";
import { HiChevronDown, HiChevronRight, HiArrowPath } from "react-icons/hi2";
import { calcular, DIAS_BASE_MENSALIDADE } from "./calculo";

const CAMPO =
  "mt-1 block w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const ROTULO = "text-xs font-semibold uppercase tracking-wide text-gray-600";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataBR = (iso: string) =>
  iso ? iso.split("-").reverse().join("/") : "—";

/** Rótulo com o nome que a planilha usa, para quem já conhece a conta. */
const Resultado = ({
  rotulo,
  valor,
  destaque,
  sufixo = "dias",
}: {
  rotulo: string;
  valor: number | null;
  destaque?: "positivo" | "negativo";
  sufixo?: string;
}) => (
  <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
      {rotulo}
    </p>
    <p
      className={`text-xl font-bold ${
        valor === null
          ? "text-gray-300"
          : destaque === "negativo"
            ? "text-red-600"
            : destaque === "positivo"
              ? "text-green-600"
              : "text-gray-800"
      }`}
    >
      {valor === null ? "—" : `${valor} ${sufixo}`}
    </p>
  </div>
);

export const CalculadoraDebitos: React.FC = () => {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [diasPagos, setDiasPagos] = useState("");
  const [dataReativacao, setDataReativacao] = useState("");
  const [dataProximoBoleto, setDataProximoBoleto] = useState("");
  const [mensalidade, setMensalidade] = useState("");
  /** null = segue o resultado da etapa 1; string = valor digitado à mão. */
  const [creditoManual, setCreditoManual] = useState<string | null>(null);
  const [ajuda, setAjuda] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Recalcula a cada tecla: não existe botão "calcular".
  const r = useMemo(
    () =>
      calcular({
        dataInicio,
        dataFinal,
        diasPagos,
        dataReativacao,
        dataProximoBoleto,
        creditoAplicado: creditoManual,
        mensalidade,
      }),
    [
      dataInicio,
      dataFinal,
      diasPagos,
      dataReativacao,
      dataProximoBoleto,
      creditoManual,
      mensalidade,
    ],
  );

  const creditoNoCampo =
    creditoManual ?? (r.etapa1.credito === null ? "" : String(r.etapa1.credito));
  const creditoEditado =
    creditoManual !== null &&
    r.etapa1.credito !== null &&
    Number(creditoManual) !== r.etapa1.credito;

  const creditoNegativo = (r.etapa1.credito ?? 0) < 0;

  async function copiarResumo() {
    const linhas = [
      "Cálculo de dias — reativação de sinal",
      "",
      `Período de uso: ${dataBR(dataInicio)} a ${dataBR(dataFinal)} = ${r.etapa1.diasUso ?? "—"} dias`,
      `Pagou: ${r.etapa1.diasPagos ?? "—"} dias`,
      creditoNegativo
        ? `Dias a cobrar a mais: ${Math.abs(r.etapa1.credito ?? 0)}`
        : `Crédito (descontar dias): ${r.etapa1.credito ?? "—"}`,
      "",
      `Reativado em ${dataBR(dataReativacao)}, próximo boleto ${dataBR(dataProximoBoleto)} = ${r.etapa2.diasUso ?? "—"} dias`,
      "",
      r.diasACobrar === 0 && r.creditoRestante > 0
        ? `Nada a cobrar. Sobram ${r.creditoRestante} dias de crédito para a fatura seguinte.`
        : `${r.diasACobrar ?? "—"} dias a cobrar na próxima fatura` +
          (r.valor !== null ? ` (${brl(r.valor)})` : ""),
    ];
    try {
      await navigator.clipboard.writeText(linhas.join("\n"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* navegador bloqueou a cópia */
    }
  }

  const pronto = r.diasACobrar !== null;

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <NavBar />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800">
          Calculadora de Débitos
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Quantos dias entram na próxima fatura de quem ficou suspenso e pagou
          para reativar o sinal.
        </p>

        {/* Ajuda recolhível */}
        <div className="mt-4 rounded-lg bg-white shadow-md">
          <button
            type="button"
            onClick={() => setAjuda((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left font-semibold text-gray-800"
          >
            {ajuda ? <HiChevronDown /> : <HiChevronRight />}
            Como funciona
          </button>
          {ajuda && (
            <div className="space-y-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
              <p>
                <b>Data de início</b> — data do 1º boleto. É onde o cálculo
                começa.
              </p>
              <p className="rounded border border-amber-300 bg-amber-50 p-3">
                <b>Data final</b> — 20 dias após o 2º boleto. Pegue na tela de{" "}
                <b>Eventos</b> e use sempre <b>um dia antes</b> do evento{" "}
                <b>“alteração de plano_15”</b>. Se o evento foi dia 03, use dia
                02. <i>É aqui que mais se erra.</i>
              </p>
              <p>
                <b>Pagou dias</b> — quantos dias o cliente realmente pagou para
                liberar o sinal.
              </p>
              <p>
                <b>Descontar dias</b> — o crédito: dias pagos menos dias de uso.
                Se ficar negativo, ele usou mais do que pagou, e esses dias são{" "}
                <b>somados</b> à cobrança em vez de descontados.
              </p>
              <p>
                <b>Data de reativação</b> e <b>próximo boleto</b> — o período que
                será faturado, do qual se abate o crédito.
              </p>
              <p className="text-xs text-gray-500">
                As diferenças são de intervalo, não contagem inclusiva: 11/06 a
                02/08 dá 52 dias, não 53 — o que combina com a regra de pegar um
                dia antes do evento. O valor em reais usa mês de{" "}
                {DIAS_BASE_MENSALIDADE} dias.
              </p>
            </div>
          )}
        </div>

        {/* ---------- Etapa 1 ---------- */}
        <div className="mt-4 rounded-lg bg-white p-4 shadow-md">
          <h2 className="font-bold text-gray-800">Cálculo 1 — crédito</h2>
          <p className="text-xs text-gray-500">
            Dias que o cliente pagou a mais durante a suspensão.
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <label className={ROTULO}>Data de início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={CAMPO}
              />
              <p className="mt-1 text-xs text-gray-500">Data do 1º boleto</p>
            </div>
            <div>
              <label className={ROTULO}>Data final</label>
              <input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className={CAMPO}
              />
              <p className="mt-1 text-xs text-amber-700">
                Um dia antes do evento
              </p>
            </div>
            <div>
              <label className={ROTULO}>Pagou dias</label>
              <input
                type="text"
                inputMode="numeric"
                value={diasPagos}
                onChange={(e) =>
                  setDiasPagos(e.target.value.replace(/[^\d-]/g, ""))
                }
                placeholder="60"
                className={CAMPO}
              />
              <p className="mt-1 text-xs text-gray-500">Para liberar o sinal</p>
            </div>
          </div>

          {r.etapa1.erro && (
            <p className="mt-3 flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <BsExclamationTriangle /> {r.etapa1.erro}
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Resultado rotulo="Dias uso" valor={r.etapa1.diasUso} />
            <Resultado rotulo="Pagou dias" valor={r.etapa1.diasPagos} />
            <Resultado
              rotulo={
                creditoNegativo ? "Dias a cobrar a mais" : "Descontar dias"
              }
              valor={
                r.etapa1.credito === null
                  ? null
                  : Math.abs(r.etapa1.credito)
              }
              destaque={creditoNegativo ? "negativo" : "positivo"}
            />
          </div>
          {creditoNegativo && (
            <p className="mt-2 text-xs text-red-600">
              O cliente usou mais dias do que pagou — não é desconto, é saldo
              devedor, e será <b>somado</b> na cobrança abaixo.
            </p>
          )}
        </div>

        {/* ---------- Etapa 2 ---------- */}
        <div className="mt-4 rounded-lg bg-white p-4 shadow-md">
          <h2 className="font-bold text-gray-800">Cálculo 2 — cobrança</h2>
          <p className="text-xs text-gray-500">
            Período do próximo boleto, abatido o crédito acima.
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <label className={ROTULO}>Data de reativação</label>
              <input
                type="date"
                value={dataReativacao}
                onChange={(e) => setDataReativacao(e.target.value)}
                className={CAMPO}
              />
              <p className="mt-1 text-xs text-gray-500">
                Pagamento que liberou
              </p>
            </div>
            <div>
              <label className={ROTULO}>Próximo boleto</label>
              <input
                type="date"
                value={dataProximoBoleto}
                onChange={(e) => setDataProximoBoleto(e.target.value)}
                className={CAMPO}
              />
            </div>
            <div>
              <label className={ROTULO}>Descontar dias</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={creditoNoCampo}
                  onChange={(e) =>
                    setCreditoManual(e.target.value.replace(/[^\d-]/g, ""))
                  }
                  placeholder="0"
                  className={CAMPO}
                />
                {creditoManual !== null && (
                  <button
                    type="button"
                    onClick={() => setCreditoManual(null)}
                    title="Voltar ao valor calculado no passo 1"
                    className="mt-1 rounded border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
                  >
                    <HiArrowPath />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {creditoEditado ? (
                  <span className="text-amber-700">
                    Editado à mão (o cálculo dava {r.etapa1.credito})
                  </span>
                ) : (
                  "Vem do cálculo 1"
                )}
              </p>
            </div>
          </div>

          {r.etapa2.erro && (
            <p className="mt-3 flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <BsExclamationTriangle /> {r.etapa2.erro}
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Resultado rotulo="Dias de uso" valor={r.etapa2.diasUso} />
            <Resultado
              rotulo="Descontar dias"
              valor={r.etapa2.completa ? r.etapa2.creditoAplicado : null}
            />
            <Resultado
              rotulo="Dias a pagar"
              valor={r.etapa2.diasAPagar}
              destaque={
                r.etapa2.diasAPagar !== null && r.etapa2.diasAPagar < 0
                  ? "positivo"
                  : undefined
              }
            />
          </div>

          <div className="mt-4">
            <label className={ROTULO}>Valor da mensalidade (opcional)</label>
            <input
              type="text"
              inputMode="decimal"
              value={mensalidade}
              onChange={(e) => setMensalidade(e.target.value)}
              placeholder="89,90"
              className={`${CAMPO} sm:w-48`}
            />
          </div>
        </div>

        {/* ---------- Resumo ---------- */}
        {pronto && (
          <div className="mt-4 rounded-lg bg-white p-5 shadow-md ring-2 ring-indigo-500">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                {r.diasACobrar === 0 && r.creditoRestante > 0 ? (
                  <>
                    <p className="text-2xl font-bold text-green-600">
                      Nada a cobrar
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Sobram <b>{r.creditoRestante} dias</b> de crédito para a
                      fatura seguinte.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-gray-900">
                      {r.diasACobrar} dias a cobrar
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      na próxima fatura
                      {r.valor !== null && (
                        <>
                          {" · "}
                          <span className="text-lg font-bold text-green-600">
                            {brl(r.valor)}
                          </span>
                        </>
                      )}
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={copiarResumo}
                className="flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                <BsClipboard /> {copiado ? "Copiado!" : "Copiar resumo"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
