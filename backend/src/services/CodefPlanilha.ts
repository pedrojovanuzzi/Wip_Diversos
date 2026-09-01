import * as XLSX from "xlsx";

import { Apuracao, LinhaMes } from "./CodefService";

/**
 * Gera o arquivo da Coleta Mensal CODEF no mesmo desenho da planilha de apoio:
 * uma linha por mês, colunas A a Q, e as colunas calculadas como fórmula de
 * verdade (ROL, Total de Despesas, EBITDA e Dívida Líquida).
 *
 * As fórmulas ficam como fórmula de propósito. Quem recebe o arquivo mexe nos
 * números à mão antes de fechar com o contador, e com valor fixo o total
 * deixaria de acompanhar a correção — que é justamente o erro que a planilha
 * manual já cometia.
 */

const CABECALHOS = [
  "Mês",
  "ROB – Receita\nOperacional Bruta",
  "Descontos\nConcedidos",
  "ROL – Receita\nOperacional Líquida",
  "Desp. Pessoal",
  "Desp. Link /\nBackbone",
  "Desp. Manutenção\nde Rede",
  "Desp. Aluguel /\nCondomínio",
  "Desp. Energia",
  "Desp. Marketing /\nComissões",
  "Outras\nDespesas",
  "Total Despesas\nOperacionais",
  "EBITDA",
  "Carga Tributária\nTotal",
  "Total Empréstimos /\nFinanciamentos",
  "Caixa e Aplicações\nFinanceiras",
  "Dívida\nLíquida",
];

/** Primeira linha de dados na planilha (as quatro de cima são cabeçalho). */
const LINHA_INICIAL = 5;

const moeda = "#,##0.00";

const numero = (v: number): XLSX.CellObject => ({
  t: "n",
  v,
  z: moeda,
});

/**
 * Célula de fórmula, sempre com o valor já calculado junto.
 *
 * O `v` não é enfeite: o SheetJS descarta na escrita a célula que só tem `f`,
 * e a coluna sairia em branco. De quebra, o valor fica visível em leitor que
 * não recalcula fórmula.
 */
const formula = (f: string, v: number): XLSX.CellObject => ({
  t: "n",
  v,
  f,
  z: moeda,
});

const texto = (v: string): XLSX.CellObject => ({ t: "s", v });

export function gerarPlanilhaCodef(apuracao: Apuracao): Buffer {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, abaMensal(apuracao), "CODEF Mensal");
  XLSX.utils.book_append_sheet(wb, abaConferencia(apuracao), "Conferência");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function abaMensal(apuracao: Apuracao): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const escrever = (ref: string, cell: XLSX.CellObject) => {
    ws[ref] = cell;
  };

  escrever(
    "A1",
    texto(`Coleta Mensal CODEF – Dados Econômico-Financeiros (${apuracao.ano})`),
  );
  escrever(
    "A2",
    texto(
      `Apurado do MKAuth por ${
        apuracao.base === "pagamento" ? "data de pagamento" : "data de vencimento"
      }. Carga tributária: ${
        apuracao.tributos === "das" ? "somente DAS" : "todos os tributos"
      }. Empréstimos e caixa são informados à mão.`,
    ),
  );

  CABECALHOS.forEach((titulo, i) =>
    escrever(XLSX.utils.encode_cell({ r: 3, c: i }), texto(titulo)),
  );

  apuracao.meses.forEach((linha, i) => {
    const l = LINHA_INICIAL + i;
    escreverLinha(escrever, l, linha);
  });

  const primeira = LINHA_INICIAL;
  const ultima = LINHA_INICIAL + apuracao.meses.length - 1;
  const linhaTotal = ultima + 2;
  const total = apuracao.total;

  const totaisPorColuna: [string, number][] = [
    ["B", total.rob],
    ["C", total.descontos],
    ["D", total.rol],
    ["E", total.pessoal],
    ["F", total.link],
    ["G", total.manutencao],
    ["H", total.aluguel],
    ["I", total.energia],
    ["J", total.marketing],
    ["K", total.outras],
    ["L", total.totalDespesas],
    ["M", total.ebitda],
    ["N", total.cargaTributaria],
  ];

  escrever(`A${linhaTotal}`, texto("Total do ano"));
  for (const [col, valor] of totaisPorColuna)
    escrever(
      `${col}${linhaTotal}`,
      formula(`SUM(${col}${primeira}:${col}${ultima})`, valor),
    );

  // Dívida e caixa são saldo, não fluxo: somar os doze meses não significaria
  // nada. A planilha original repete o valor de dezembro, e é o que se faz aqui.
  const dezembro = apuracao.meses[apuracao.meses.length - 1];
  const linhaSaldo = linhaTotal + 1;
  escrever(`A${linhaSaldo}`, texto("Saldo em Dezembro"));
  escrever(`O${linhaSaldo}`, formula(`O${ultima}`, dezembro.emprestimos));
  escrever(`P${linhaSaldo}`, formula(`P${ultima}`, dezembro.caixa));
  escrever(`Q${linhaSaldo}`, formula(`Q${ultima}`, dezembro.dividaLiquida));

  ws["!ref"] = `A1:Q${linhaSaldo}`;
  ws["!cols"] = [{ wch: 18 }, ...CABECALHOS.slice(1).map(() => ({ wch: 16 }))];

  return ws;
}

function escreverLinha(
  escrever: (ref: string, cell: XLSX.CellObject) => void,
  l: number,
  linha: LinhaMes,
): void {
  // Mês em aberto vai marcado: a receita do mês inteiro já está lançada e a
  // despesa não, então o EBITDA da linha não significa nada ainda.
  escrever(
    `A${l}`,
    texto(linha.fechado ? linha.nome : `${linha.nome} (em aberto)`),
  );
  escrever(`B${l}`, numero(linha.rob));
  escrever(`C${l}`, numero(linha.descontos));
  escrever(`D${l}`, formula(`B${l}-C${l}`, linha.rol));
  escrever(`E${l}`, numero(linha.pessoal));
  escrever(`F${l}`, numero(linha.link));
  escrever(`G${l}`, numero(linha.manutencao));
  escrever(`H${l}`, numero(linha.aluguel));
  escrever(`I${l}`, numero(linha.energia));
  escrever(`J${l}`, numero(linha.marketing));
  escrever(`K${l}`, numero(linha.outras));
  escrever(`L${l}`, formula(`SUM(E${l}:K${l})`, linha.totalDespesas));
  escrever(`M${l}`, formula(`D${l}-L${l}`, linha.ebitda));
  escrever(`N${l}`, numero(linha.cargaTributaria));
  escrever(`O${l}`, numero(linha.emprestimos));
  escrever(`P${l}`, numero(linha.caixa));
  escrever(`Q${l}`, formula(`O${l}-P${l}`, linha.dividaLiquida));
}

/**
 * Aba de conferência: o que ficou de fora do EBITDA e por quê.
 *
 * Existe para o número não chegar na Anatel sem ninguém ter visto o que foi
 * descartado — principalmente a despesa sem classificação, que some da planilha
 * mensal sem deixar rastro.
 */
function abaConferencia(apuracao: Apuracao): XLSX.WorkSheet {
  const linhas: (string | number)[][] = [
    ["Conferência da apuração"],
    [],
    ["Fora do EBITDA, por mês"],
    [
      "Mês",
      "Investimento (capex)",
      "Despesa financeira",
      "Sem classificação",
      "Tributos (DAS)",
      "Tributos (demais)",
    ],
    ...apuracao.meses.map((m) => [
      m.nome,
      m.capex,
      m.financeiro,
      m.naoClassificado,
      m.tributoDas,
      m.tributoOutros,
    ]),
    [],
    ["Planos de contas do período"],
    ["Plano de contas", "Categoria", "Origem", "Valor", "Lançamentos", "Exemplo de histórico"],
    ...apuracao.planos.map((p) => [
      p.plano,
      p.categoria ?? "não classificado",
      p.origem,
      p.valor,
      p.lancamentos,
      p.exemplo ?? "",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws["!cols"] = [
    { wch: 42 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 42 },
  ];
  return ws;
}
