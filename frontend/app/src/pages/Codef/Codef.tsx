import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import {
  BsClipboard,
  BsDownload,
  BsExclamationTriangle,
  BsArrowRepeat,
} from "react-icons/bs";

/**
 * Coleta Mensal CODEF (Anatel).
 *
 * A tela existe para tirar cinco números do MKAuth todo mês e passar para o
 * formulário da Anatel: ROB, Descontos, EBITDA, Carga Tributária e Dívida
 * Líquida. O resto da grade é a conferência de como cada um foi formado.
 */

interface LinhaMes {
  mes: number;
  nome: string;
  rob: number;
  descontos: number;
  rol: number;
  pessoal: number;
  link: number;
  manutencao: number;
  aluguel: number;
  energia: number;
  marketing: number;
  outras: number;
  totalDespesas: number;
  ebitda: number;
  tributoDas: number;
  tributoOutros: number;
  cargaTributaria: number;
  emprestimos: number;
  caixa: number;
  dividaLiquida: number;
  capex: number;
  financeiro: number;
  naoClassificado: number;
  manualPreenchido: boolean;
  fechado: boolean;
  observacao: string | null;
}

interface PlanoApurado {
  plano: string;
  categoria: string | null;
  origem: "manual" | "padrao" | "nao_classificado";
  valor: number;
  lancamentos: number;
  exemplo: string | null;
}

interface Apuracao {
  ano: number;
  base: string;
  tributos: string;
  meses: LinhaMes[];
  total: LinhaMes;
  planos: PlanoApurado[];
  naoClassificados: PlanoApurado[];
}

const CATEGORIAS: { id: string; rotulo: string }[] = [
  { id: "pessoal", rotulo: "Pessoal" },
  { id: "link", rotulo: "Link / Backbone" },
  { id: "manutencao", rotulo: "Manutenção de rede" },
  { id: "aluguel", rotulo: "Aluguel / Condomínio" },
  { id: "energia", rotulo: "Energia" },
  { id: "marketing", rotulo: "Marketing / Comissões" },
  { id: "outras", rotulo: "Outras despesas" },
  { id: "tributo_das", rotulo: "Tributo — DAS" },
  { id: "tributo_outros", rotulo: "Tributo — demais" },
  { id: "capex", rotulo: "Investimento (fora do EBITDA)" },
  { id: "financeiro", rotulo: "Juros (fora do EBITDA)" },
  { id: "ignorar", rotulo: "Ignorar" },
];

const rotuloCategoria = (id: string | null) =>
  CATEGORIAS.find((c) => c.id === id)?.rotulo ?? "Não classificado";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/** Só o número, do jeito que o formulário da Anatel espera receber colado. */
const puro = (v: number) => v.toFixed(2);

export const Codef: React.FC = () => {
  const { user } = useAuth();
  const base = process.env.REACT_APP_URL;
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${user?.token}` }),
    [user],
  );

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  // Em janeiro o mês a reportar é dezembro do ano anterior; abrir já no ano
  // certo evita a tela começar num ano inteiro vazio.
  const [ano, setAno] = useState(
    hoje.getMonth() === 0 ? anoAtual - 1 : anoAtual,
  );
  const [competencia, setCompetencia] = useState<"vencimento" | "pagamento">(
    "vencimento",
  );
  const [tributos, setTributos] = useState<"todos" | "das">("todos");
  // O mês corrente ainda não fechou: as faturas do mês inteiro já existem e as
  // despesas não, o que faz o EBITDA parecer ótimo. Abre no último mês fechado.
  const [mesFoco, setMesFoco] = useState(
    hoje.getMonth() === 0 ? 12 : hoje.getMonth(),
  );

  const [apuracao, setApuracao] = useState<Apuracao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{
    texto: string;
    tipo: "ok" | "erro";
  } | null>(null);

  const [emprestimos, setEmprestimos] = useState("");
  const [caixa, setCaixa] = useState("");
  const [descontos, setDescontos] = useState("");
  const [verPlanos, setVerPlanos] = useState(false);

  const avisar = (texto: string, tipo: "ok" | "erro") => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 6000);
  };

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await axios.get(`${base}/codef`, {
        headers,
        params: { ano, base: competencia, tributos },
      });
      setApuracao(res.data);
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao apurar o CODEF.", "erro");
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, competencia, tributos, headers]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const linha = apuracao?.meses.find((m) => m.mes === mesFoco) ?? null;

  // Os campos manuais seguem o mês em foco; string vazia quando é zero, para a
  // pessoa não ter que apagar um "0" antes de digitar.
  useEffect(() => {
    if (!linha) return;
    setEmprestimos(linha.emprestimos ? String(linha.emprestimos) : "");
    setCaixa(linha.caixa ? String(linha.caixa) : "");
    setDescontos(linha.descontos ? String(linha.descontos) : "");
  }, [linha?.mes, linha?.emprestimos, linha?.caixa, linha?.descontos]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvarMes() {
    setSalvando(true);
    try {
      await axios.post(
        `${base}/codef/competencia`,
        { ano, mes: mesFoco, emprestimos, caixa, descontos },
        { headers },
      );
      avisar("Valores do mês salvos.", "ok");
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao salvar o mês.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  async function classificar(plano: string, categoria: string) {
    try {
      await axios.post(
        `${base}/codef/plano-contas`,
        { plano, categoria },
        { headers },
      );
      carregar();
    } catch (e: any) {
      avisar(e?.response?.data?.message || "Erro ao classificar.", "erro");
    }
  }

  const copiar = async (valor: number, nome: string) => {
    try {
      await navigator.clipboard.writeText(puro(valor));
      avisar(`${nome} copiado: ${puro(valor)}`, "ok");
    } catch {
      avisar("O navegador bloqueou a cópia.", "erro");
    }
  };

  const exportar = () => {
    const url = `${base}/codef/exportar?ano=${ano}&base=${competencia}&tributos=${tributos}&token=${user?.token}`;
    window.open(url, "_blank");
  };

  const anos = [anoAtual + 1, anoAtual, anoAtual - 1, anoAtual - 2];

  /** Os cinco valores que vão direto no formulário da Anatel. */
  const cartoes = linha
    ? [
        { nome: "ROB", valor: linha.rob, cor: "text-gray-800" },
        { nome: "Descontos Concedidos", valor: linha.descontos, cor: "text-gray-800" },
        { nome: "EBITDA", valor: linha.ebitda, cor: "text-indigo-700" },
        { nome: "Carga Tributária Total", valor: linha.cargaTributaria, cor: "text-gray-800" },
        { nome: "Dívida Líquida", valor: linha.dividaLiquida, cor: "text-gray-800" },
      ]
    : [];

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <NavBar />
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">
              Coleta Mensal CODEF
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">
              Apura do MKAuth os cinco valores que a Anatel pede todo mês.
              Faturamento e despesas vêm das faturas e das contas a pagar;
              empréstimos e caixa são informados aqui, porque o MKAuth não os
              guarda.
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              onClick={carregar}
              disabled={carregando}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {carregando ? (
                <AiOutlineLoading3Quarters className="animate-spin" />
              ) : (
                <BsArrowRepeat />
              )}
              Atualizar
            </button>
            <button
              onClick={exportar}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white shadow-md hover:bg-indigo-700 sm:flex-none"
            >
              <BsDownload />
              Planilha do ano
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg bg-white p-4 shadow-md">
          <label className="text-sm">
            <span className="mr-2 text-gray-600">Ano</span>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="rounded border border-gray-300 p-1.5"
            >
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          <label
            className="text-sm"
            title="Vencimento é a competência: o mês em que foi faturado. Pagamento usa a data da baixa e só conta o que foi pago."
          >
            <span className="mr-2 text-gray-600">Competência por</span>
            <select
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value as any)}
              className="rounded border border-gray-300 p-1.5"
            >
              <option value="vencimento">Vencimento</option>
              <option value="pagamento">Pagamento</option>
            </select>
          </label>

          <label
            className="text-sm"
            title="O DAS sozinho, ou o DAS somado a ICMS, DIFAL, taxas da Anatel e demais tributos."
          >
            <span className="mr-2 text-gray-600">Carga tributária</span>
            <select
              value={tributos}
              onChange={(e) => setTributos(e.target.value as any)}
              className="rounded border border-gray-300 p-1.5"
            >
              <option value="todos">DAS + demais tributos</option>
              <option value="das">Somente DAS</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="mr-2 text-gray-600">Mês</span>
            <select
              value={mesFoco}
              onChange={(e) => setMesFoco(Number(e.target.value))}
              className="rounded border border-gray-300 p-1.5"
            >
              {(apuracao?.meses ?? []).map((m) => (
                <option key={m.mes} value={m.mes}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        {mensagem && (
          <p
            className={`mt-4 flex items-center gap-2 rounded border p-3 text-sm ${
              mensagem.tipo === "ok"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {mensagem.tipo === "erro" && <BsExclamationTriangle />}
            {mensagem.texto}
          </p>
        )}

        {apuracao && apuracao.naoClassificados.length > 0 && (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <BsExclamationTriangle />
              {apuracao.naoClassificados.length} plano(s) de contas sem
              classificação, somando{" "}
              {brl(
                apuracao.naoClassificados.reduce((s, p) => s + p.valor, 0),
              )}{" "}
              no ano.
            </p>
            <p className="mt-1">
              Esse valor não entra em nenhuma coluna — o EBITDA está sendo
              calculado sem ele.{" "}
              <button
                onClick={() => setVerPlanos(true)}
                className="font-semibold underline"
              >
                Classificar agora
              </button>
            </p>
          </div>
        )}

        {linha && (
          <div className="mt-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              {linha.nome} de {ano} — o que vai no formulário da Anatel
            </h2>

            {!linha.fechado && (
              <p className="mb-2 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <BsExclamationTriangle className="mt-0.5 shrink-0" />
                <span>
                  <strong>{linha.nome} ainda não fechou.</strong> As faturas do
                  mês já estão geradas, mas as contas a pagar não — o EBITDA
                  abaixo está alto por falta de despesa, não por resultado. Não
                  envie estes valores para a Anatel.
                </span>
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {cartoes.map((c) => (
                <button
                  key={c.nome}
                  onClick={() => copiar(c.valor, c.nome)}
                  title="Clique para copiar só o número"
                  className="group rounded-lg bg-white p-4 text-left shadow-md hover:ring-2 hover:ring-indigo-400"
                >
                  <p className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
                    {c.nome}
                    <BsClipboard className="opacity-0 group-hover:opacity-60" />
                  </p>
                  <p className={`mt-1 text-lg font-bold ${c.cor}`}>
                    {brl(c.valor)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {linha && (
          <div className="mt-4 rounded-lg bg-white p-4 shadow-md">
            <h2 className="text-sm font-semibold text-gray-700">
              Valores de {linha.nome} que o MKAuth não tem
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Saldo no fim do mês. O caixa do MKAuth é o caixa interno do
              sistema e não bate com o extrato bancário, por isso não é usado
              aqui.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <label className="text-sm">
                <span className="text-gray-600">Empréstimos / Financiamentos</span>
                <input
                  value={emprestimos}
                  onChange={(e) => setEmprestimos(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="mt-1 w-full rounded border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Caixa e aplicações</span>
                <input
                  value={caixa}
                  onChange={(e) => setCaixa(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="mt-1 w-full rounded border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="text-sm">
                <span
                  className="text-gray-600"
                  title="Só é usado enquanto o desconto não for lançado na fatura do MKAuth."
                >
                  Descontos concedidos
                </span>
                <input
                  value={descontos}
                  onChange={(e) => setDescontos(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="mt-1 w-full rounded border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <div className="flex items-end">
                <button
                  onClick={salvarMes}
                  disabled={salvando}
                  className="w-full rounded bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  {salvando ? "Salvando…" : "Salvar mês"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-lg bg-white shadow-md">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="font-semibold text-gray-700">Grade do ano</h2>
            <p className="text-xs text-gray-500">
              Investimento, juros e o que está sem classificação ficam fora do
              EBITDA de propósito.
            </p>
          </div>

          {carregando ? (
            <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
              <AiOutlineLoading3Quarters className="animate-spin" />
              Apurando…
            </div>
          ) : !apuracao ? (
            <p className="p-8 text-center text-sm text-gray-500">
              Nada apurado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[80rem] text-right text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left">
                      Mês
                    </th>
                    <th className="px-3 py-2">ROB</th>
                    <th className="px-3 py-2">Descontos</th>
                    <th className="px-3 py-2">ROL</th>
                    <th className="px-3 py-2">Pessoal</th>
                    <th className="px-3 py-2">Link</th>
                    <th className="px-3 py-2">Manut.</th>
                    <th className="px-3 py-2">Aluguel</th>
                    <th className="px-3 py-2">Energia</th>
                    <th className="px-3 py-2">Marketing</th>
                    <th className="px-3 py-2">Outras</th>
                    <th className="px-3 py-2">Desp. total</th>
                    <th className="bg-emerald-50 px-3 py-2 text-emerald-900">
                      EBITDA
                    </th>
                    <th className="bg-emerald-50 px-3 py-2 text-emerald-900">
                      Tributos
                    </th>
                    <th className="bg-emerald-50 px-3 py-2 text-emerald-900">
                      Dívida líq.
                    </th>
                    <th className="px-3 py-2 text-amber-700">Investimento</th>
                    <th className="px-3 py-2 text-amber-700">Sem class.</th>
                  </tr>
                </thead>
                <tbody>
                  {apuracao.meses.map((m) => (
                    <tr
                      key={m.mes}
                      onClick={() => setMesFoco(m.mes)}
                      className={`cursor-pointer border-t border-gray-100 hover:bg-indigo-50 ${
                        m.mes === mesFoco ? "bg-indigo-50" : ""
                      } ${m.fechado ? "" : "italic text-gray-400"}`}
                    >
                      <td className="sticky left-0 bg-inherit px-3 py-2 text-left font-semibold text-gray-700">
                        {m.nome}
                        {!m.fechado && (
                          <span
                            className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold not-italic text-amber-800"
                            title="Mês ainda não encerrado: a receita já está lançada e a despesa não."
                          >
                            em aberto
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{brl(m.rob)}</td>
                      <td className="px-3 py-2">{brl(m.descontos)}</td>
                      <td className="px-3 py-2">{brl(m.rol)}</td>
                      <td className="px-3 py-2">{brl(m.pessoal)}</td>
                      <td className="px-3 py-2">{brl(m.link)}</td>
                      <td className="px-3 py-2">{brl(m.manutencao)}</td>
                      <td className="px-3 py-2">{brl(m.aluguel)}</td>
                      <td className="px-3 py-2">{brl(m.energia)}</td>
                      <td className="px-3 py-2">{brl(m.marketing)}</td>
                      <td className="px-3 py-2">{brl(m.outras)}</td>
                      <td className="px-3 py-2">{brl(m.totalDespesas)}</td>
                      <td className="bg-emerald-50 px-3 py-2 font-semibold text-emerald-900">
                        {brl(m.ebitda)}
                      </td>
                      <td className="bg-emerald-50 px-3 py-2 text-emerald-900">
                        {brl(m.cargaTributaria)}
                      </td>
                      <td className="bg-emerald-50 px-3 py-2 text-emerald-900">
                        {m.manualPreenchido ? brl(m.dividaLiquida) : "—"}
                      </td>
                      <td className="px-3 py-2 text-amber-700">
                        {m.capex ? brl(m.capex) : "—"}
                      </td>
                      <td className="px-3 py-2 text-amber-700">
                        {m.naoClassificado ? brl(m.naoClassificado) : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <td className="sticky left-0 bg-gray-50 px-3 py-2 text-left">
                      Total do ano
                    </td>
                    <td className="px-3 py-2">{brl(apuracao.total.rob)}</td>
                    <td className="px-3 py-2">{brl(apuracao.total.descontos)}</td>
                    <td className="px-3 py-2">{brl(apuracao.total.rol)}</td>
                    <td className="px-3 py-2">{brl(apuracao.total.pessoal)}</td>
                    <td className="px-3 py-2">{brl(apuracao.total.link)}</td>
                    <td className="px-3 py-2">{brl(apuracao.total.manutencao)}</td>
                    <td className="px-3 py-2">{brl(apuracao.total.aluguel)}</td>
                    <td className="px-3 py-2">{brl(apuracao.total.energia)}</td>
                    <td className="px-3 py-2">{brl(apuracao.total.marketing)}</td>
                    <td className="px-3 py-2">{brl(apuracao.total.outras)}</td>
                    <td className="px-3 py-2">
                      {brl(apuracao.total.totalDespesas)}
                    </td>
                    <td className="bg-emerald-100 px-3 py-2 text-emerald-900">
                      {brl(apuracao.total.ebitda)}
                    </td>
                    <td className="bg-emerald-100 px-3 py-2 text-emerald-900">
                      {brl(apuracao.total.cargaTributaria)}
                    </td>
                    <td className="bg-emerald-100 px-3 py-2 text-emerald-900">
                      —
                    </td>
                    <td className="px-3 py-2 text-amber-700">
                      {brl(apuracao.total.capex)}
                    </td>
                    <td className="px-3 py-2 text-amber-700">
                      {brl(apuracao.total.naoClassificado)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-white shadow-md">
          <button
            onClick={() => setVerPlanos((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span>
              <span className="font-semibold text-gray-700">
                Plano de contas do MKAuth
              </span>
              <span className="ml-2 text-xs text-gray-500">
                em qual coluna do CODEF cada um entra
              </span>
            </span>
            <span className="text-sm text-indigo-600">
              {verPlanos ? "Ocultar" : "Mostrar"}
            </span>
          </button>

          {verPlanos && apuracao && (
            <div className="overflow-x-auto border-t border-gray-200">
              <table className="min-w-[52rem] text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Plano de contas</th>
                    <th className="px-3 py-2 text-left">Exemplo de histórico</th>
                    <th className="px-3 py-2 text-right">Valor no ano</th>
                    <th className="px-3 py-2 text-left">Entra em</th>
                  </tr>
                </thead>
                <tbody>
                  {apuracao.planos.map((p) => (
                    <tr
                      key={p.plano}
                      className={`border-t border-gray-100 ${
                        p.origem === "nao_classificado" ? "bg-amber-50" : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-gray-800">
                        {p.plano}
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          {p.lancamentos} lanç.
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {p.exemplo || "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {brl(p.valor)}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={p.categoria ?? ""}
                          onChange={(e) => classificar(p.plano, e.target.value)}
                          className={`rounded border p-1.5 text-sm ${
                            p.origem === "nao_classificado"
                              ? "border-amber-400 bg-white"
                              : "border-gray-300"
                          }`}
                        >
                          <option value="" disabled>
                            {rotuloCategoria(null)}
                          </option>
                          {CATEGORIAS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.rotulo}
                            </option>
                          ))}
                        </select>
                        {p.origem === "padrao" && (
                          <span
                            className="ml-2 text-xs text-gray-400"
                            title="Palpite do sistema. Escolher no seletor grava a decisão."
                          >
                            padrão
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Encargos de folha (FGTS, INSS, previdência) entram em Pessoal, não em
          Carga Tributária. Compra de equipamento, veículo e poste é
          investimento: vira depreciação e a Anatel pede o EBITDA antes dela.
          Feche os números com o contador antes de enviar.
        </p>
      </div>
    </div>
  );
};
