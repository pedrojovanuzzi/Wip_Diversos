import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { Link, useSearchParams } from "react-router-dom";
import { FaFileExcel } from "react-icons/fa";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { paginaMk } from "./mkauthEstilo";
import { Botao, campo as campoUi } from "./ConfigUi";
import { SeloWipDiversos } from "./SeloWipDiversos";
import { mensagemDeErro } from "./api";

/**
 * Relatório das mensalidades para o Excel, por mês de vencimento.
 * Wip 1: todas as mensalidades do mês. Wip 2: os serviços dessas mesmas
 * mensalidades, uma linha por serviço, com o valor do serviço em "valor".
 * Origem "atrelado": linha gravada no título (sis_mlanc); "contrato":
 * serviço do contrato do cliente (sis_sercontratos), quando o título não
 * tem as linhas "Valor adicional".
 * As colunas seguem a exportação do MK-Auth. Só nível 5 (tem CPF).
 */

type Aba = "wip1" | "wip2";
type Linha = Record<string, string | number | null>;

const ABAS: { valor: Aba; rotulo: string; descricao: string }[] = [
  { valor: "wip1", rotulo: "Wip 1", descricao: "todas as mensalidades" },
  { valor: "wip2", rotulo: "Wip 2", descricao: "serviços das mensalidades da Wip 1" },
];

// [campo do backend, título da coluna (o mesmo da exportação do MK-Auth), número?]
const COLUNAS: [string, string, boolean?][] = [
  ["titulo", "Titulo"],
  ["login", "Login"],
  ["nome", "Nome"],
  ["endereco", "Endereco"],
  ["numero", "Numero"],
  ["complemento", "Complemento"],
  ["bairro", "Bairro"],
  ["cidade", "Cidade"],
  ["estado", "Estado"],
  ["cep", "CEP"],
  ["cpf_cnpj", "CPF/CNPJ"],
  ["telefone", "Telefone"],
  ["celular", "Celular"],
  ["operadora", "Operadora"],
  ["email", "E-Mail"],
  ["datavenc", "datavenc"],
  ["nossonum", "nossonum"],
  ["datapag", "datapag"],
  ["valor", "valor", true],
  ["valorpag", "valorpag", true],
  ["ramal", "ramal"],
  ["coletor", "Coletor"],
  ["codigo", "Codigo"],
  ["grupo", "Grupo"],
  ["vendedor", "Vendedor"],
  ["formapag", "Forma de pagamento"],
  ["tarifa_paga", "Tarifa paga", true],
  ["fchequebanco", "Cheque banco"],
  ["fchequenumero", "Cheque numero"],
  ["fchequeagcc", "Cheque AG/CC"],
  ["fcartaobandeira", "Cartao bandeira"],
  ["fcartaonumero", "Cartao numero"],
  ["ativo", "Ativo"],
];

/** Na Wip 2, o serviço atrelado logo depois do título. */
const COLUNAS_SERVICO: [string, string, boolean?][] = [
  ["servico", "Servico"],
  ["tipo_servico", "Origem do servico"],
];

const colunasDa = (aba: Aba) =>
  aba === "wip2" ? [COLUNAS[0], ...COLUNAS_SERVICO, ...COLUNAS.slice(1)] : COLUNAS;

const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const reais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Valor da célula: número de verdade nas colunas de valor (soma no Excel). */
function valorCelula(l: Linha, chave: string, numero?: boolean) {
  const v = l[chave];
  if (v === null || v === undefined || v === "") return numero ? null : "";
  if (numero) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return v;
}

export function RelatorioMensalidades() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const aba: Aba = params.get("aba") === "wip2" ? "wip2" : "wip1";
  const mesUrl = params.get("mes") || "";
  const mes = /^\d{4}-\d{2}$/.test(mesUrl) ? mesUrl : mesAtual();

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const mudar = (novos: Record<string, string>) => {
    const p = new URLSearchParams(params);
    Object.entries(novos).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p, { replace: true });
  };

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro("");
    axios
      .get(`${process.env.REACT_APP_URL}/mensalidades/relatorio`, {
        params: { aba, mes },
        headers: { Authorization: `Bearer ${user?.token}` },
      })
      .then(({ data }) => vivo && setLinhas(data.linhas || []))
      .catch((e) => {
        if (!vivo) return;
        setLinhas([]);
        setErro(mensagemDeErro(e, "Erro ao carregar o relatório."));
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [aba, mes, user?.token]);

  const colunas = colunasDa(aba);
  const total = useMemo(
    () => linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0),
    [linhas],
  );
  const clientes = useMemo(() => new Set(linhas.map((l) => l.login)).size, [linhas]);
  const rotuloAba = ABAS.find((a) => a.valor === aba)!;

  const exportar = () => {
    const dados = linhas.map((l) => {
      const o: Record<string, string | number | null> = {};
      for (const [chave, titulo, numero] of colunas) o[titulo] = valorCelula(l, chave, numero);
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(dados, { header: colunas.map((c) => c[1]) });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, rotuloAba.rotulo);
    XLSX.writeFile(wb, `${aba}-${mes}.xlsx`);
  };

  return (
    <div style={paginaMk}>
      <NavBar />
      <div className="max-w-[1500px] mx-auto px-3 sm:px-6 pt-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-[22px] sm:text-[26px] font-bold text-[#363636] leading-tight">
                <Link to="/mensalidades" className="hover:text-[#3273dc]">
                  Mensalidades
                </Link>{" "}
                <span className="text-[#7a7a7a] font-normal">/ Relatório</span>
              </h1>
              <SeloWipDiversos />
            </div>
            <p className="text-[13px] text-[#7a7a7a] mt-0.5">
              {carregando
                ? "Carregando..."
                : `${linhas.length} linha(s) · ${clientes} cliente(s) · ${reais(total)} · ${rotuloAba.descricao}`}
            </p>
          </div>
          <Botao
            variante="sucesso"
            onClick={exportar}
            disabled={carregando || !linhas.length}
            className="inline-flex items-center justify-center gap-2"
          >
            <FaFileExcel /> Exportar Excel
          </Botao>
        </div>

        <div className="bg-white rounded-lg border border-[#e3e6ea] shadow-[0_1px_2px_rgba(0,0,0,.04)] p-3 sm:p-4 mb-4 flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
          <div
            role="tablist"
            aria-label="Relatório"
            className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-[#f1f2f4] max-w-full self-start"
          >
            {ABAS.map((a) => (
              <button
                key={a.valor}
                type="button"
                role="tab"
                aria-selected={aba === a.valor}
                onClick={() => mudar({ aba: a.valor })}
                title={a.descricao}
                className={`h-[30px] px-4 rounded-md text-[13px] font-semibold transition-colors ${
                  aba === a.valor
                    ? "bg-white text-[#3273dc] shadow-[0_1px_2px_rgba(0,0,0,.08)]"
                    : "text-[#7a7a7a] hover:text-[#363636]"
                }`}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-[#4a4a4a] sm:w-[200px]">
            Mês de vencimento
            <input
              type="month"
              value={mes}
              onChange={(e) => e.target.value && mudar({ mes: e.target.value })}
              className={campoUi}
            />
          </label>
        </div>

        {erro && (
          <div className="mb-4 rounded-md border border-[#f14668] bg-[#feecf0] text-[#cc0f35] px-3 py-2 text-[14px]">
            {erro}
          </div>
        )}

        <div className="bg-white rounded-lg border border-[#e3e6ea] shadow-[0_1px_2px_rgba(0,0,0,.04)] overflow-auto max-h-[70vh]">
          <table className="min-w-full text-[13px] border-collapse">
            <thead className="sticky top-0 bg-[#f5f6f8] z-10">
              <tr>
                {colunas.map(([chave, titulo, numero]) => (
                  <th
                    key={chave}
                    className={`px-2.5 py-2 font-semibold text-[#4a4a4a] whitespace-nowrap border-b border-[#e3e6ea] ${
                      numero ? "text-right" : "text-left"
                    }`}
                  >
                    {titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!carregando && !linhas.length && (
                <tr>
                  <td colSpan={colunas.length} className="px-3 py-8 text-center text-[#7a7a7a]">
                    {aba === "wip1"
                      ? "Nenhuma mensalidade vence neste mês."
                      : "Nenhuma mensalidade deste mês tem serviço adicional."}
                  </td>
                </tr>
              )}
              {linhas.map((l, i) => (
                <tr key={`${l.titulo}-${i}`} className="odd:bg-white even:bg-[#fafbfc] hover:bg-[#eef4fc]">
                  {colunas.map(([chave, , numero]) => {
                    const v = valorCelula(l, chave, numero);
                    return (
                      <td
                        key={chave}
                        className={`px-2.5 py-1.5 whitespace-nowrap border-b border-[#f0f1f3] ${
                          numero ? "text-right tabular-nums" : ""
                        }`}
                      >
                        {chave === "login" && l.login ? (
                          <Link
                            to={`/mensalidades/${encodeURIComponent(String(l.login))}`}
                            className="text-[#3273dc] hover:underline"
                          >
                            {String(v)}
                          </Link>
                        ) : numero && typeof v === "number" ? (
                          v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                        ) : (
                          v
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
