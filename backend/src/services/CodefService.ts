import AppDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { CategoriaCodef, CodefPlanoConta } from "../entities/CodefPlanoConta";
import { CodefCompetencia } from "../entities/CodefCompetencia";
import {
  HISTORICOS_PADRAO,
  PLANOS_PADRAO,
  normalizarPlano,
} from "./codefPlanosPadrao";

/**
 * Coleta Mensal CODEF (Anatel) — apuração a partir do MKAuth.
 *
 * A Anatel pede cinco valores por mês: ROB, Descontos Concedidos, EBITDA,
 * Carga Tributária Total e Dívida Líquida. Faturamento e despesas saem do
 * MKAuth, EBITDA e ROL são fórmula, e o resto depende de informação que o
 * MKAuth não guarda:
 *
 * - Dívida e caixa: não existe cadastro de empréstimo, e o `sis_caixa` é o
 *   caixa interno do sistema (acumulado desde 2014), não o saldo bancário.
 *   Vêm de `codef_competencias`, preenchidos na tela.
 * - Descontos concedidos: `sis_lanc.valordesc` está zerado em toda a base — o
 *   desconto é dado no valor do contrato, não lançado na fatura. A apuração usa
 *   o campo quando ele tiver valor e cai no informado à mão enquanto não tiver.
 *
 * Nada aqui escreve no MKAuth.
 */

/** Como o mês de um lançamento é decidido. */
export type BaseCompetencia = "vencimento" | "pagamento";

/** O que entra em "Carga Tributária Total". */
export type BaseTributos = "das" | "todos";

export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** As sete colunas de despesa operacional da planilha, na ordem dela. */
export const COLUNAS_DESPESA: CategoriaCodef[] = [
  "pessoal",
  "link",
  "manutencao",
  "aluguel",
  "energia",
  "marketing",
  "outras",
];

export interface LinhaMes {
  mes: number;
  nome: string;
  /** Receita Operacional Bruta: tudo que foi faturado no mês. */
  rob: number;
  descontos: number;
  /** ROB menos descontos. */
  rol: number;
  pessoal: number;
  link: number;
  manutencao: number;
  aluguel: number;
  energia: number;
  marketing: number;
  outras: number;
  totalDespesas: number;
  /** ROL menos despesas operacionais. */
  ebitda: number;
  tributoDas: number;
  tributoOutros: number;
  /** O que vai no campo da Anatel, conforme a base escolhida. */
  cargaTributaria: number;
  emprestimos: number;
  caixa: number;
  /** Empréstimos menos caixa. Pode ser negativa. */
  dividaLiquida: number;
  /** Investimento no mês. Fica fora do EBITDA; mostrado só para conferência. */
  capex: number;
  /** Juros e encargos de dívida. Também fora do EBITDA. */
  financeiro: number;
  /** Despesa sem classificação: não entra em nenhuma coluna. */
  naoClassificado: number;
  /** Se o mês tem dívida/caixa informados. */
  manualPreenchido: boolean;
  /**
   * Se o mês já terminou.
   *
   * Mês em aberto engana: as faturas do MKAuth são geradas com vencimento
   * futuro, então setembro já mostra a receita inteira do mês enquanto quase
   * nenhuma conta a pagar foi lançada — e o EBITDA sai perto de 100%. Quem
   * copiasse esse número para a Anatel mandaria um valor errado.
   */
  fechado: boolean;
  observacao: string | null;
}

export interface PlanoApurado {
  plano: string;
  categoria: CategoriaCodef | null;
  origem: "manual" | "padrao" | "nao_classificado";
  valor: number;
  lancamentos: number;
  /** Um histórico de exemplo, para dar contexto na hora de classificar. */
  exemplo: string | null;
}

export interface Apuracao {
  ano: number;
  base: BaseCompetencia;
  tributos: BaseTributos;
  meses: LinhaMes[];
  total: LinhaMes;
  planos: PlanoApurado[];
  naoClassificados: PlanoApurado[];
}

interface LinhaDespesa {
  mes: number;
  plano: string;
  historico: string | null;
  total: number;
  lancamentos: number;
}

/** Campos numéricos de LinhaMes — os únicos que a apuração soma. */
type CampoValor = {
  [K in keyof LinhaMes]: LinhaMes[K] extends number ? K : never;
}[keyof LinhaMes];

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Arredonda em centavos, senão a soma de floats vira 1234.5600000000002. */
const cent = (v: number): number => Math.round(v * 100) / 100;

class CodefService {
  /**
   * Apura os doze meses do ano.
   *
   * `base` decide o mês de cada lançamento: `vencimento` usa a data de
   * vencimento (competência — é o padrão, e é o que a planilha descreve como
   * "faturado no mês"); `pagamento` usa a data de baixa e considera só o que
   * foi pago, útil para bater com o extrato.
   */
  public async apurar(
    ano: number,
    base: BaseCompetencia = "vencimento",
    tributos: BaseTributos = "todos",
  ): Promise<Apuracao> {
    this.exigirBancos();

    const inicio = `${ano}-01-01`;
    const fim = `${ano + 1}-01-01`;

    const [receitas, despesas, regras, competencias] = await Promise.all([
      this.buscarReceitas(inicio, fim, base),
      this.buscarDespesas(inicio, fim, base),
      AppDataSource.getRepository(CodefPlanoConta).find(),
      AppDataSource.getRepository(CodefCompetencia).find({ where: { ano } }),
    ]);

    const meses: LinhaMes[] = MESES.map((nome, i) =>
      this.linhaVazia(i + 1, nome),
    );

    const agora = new Date();
    for (const linha of meses)
      // O primeiro dia do mês seguinte já passou, logo este mês acabou.
      linha.fechado = new Date(ano, linha.mes, 1) <= agora;

    for (const r of receitas) {
      const linha = meses[r.mes - 1];
      if (!linha) continue;
      linha.rob = cent(linha.rob + r.rob);
      linha.descontos = cent(linha.descontos + r.descontos);
    }

    // Acumulado por plano de contas, que alimenta a tela de classificação.
    const porPlano = new Map<string, PlanoApurado>();

    for (const d of despesas) {
      const linha = meses[d.mes - 1];
      if (!linha) continue;

      const { categoria, origem } = this.classificar(
        d.plano,
        d.historico,
        regras,
      );

      if (!categoria) {
        linha.naoClassificado = cent(linha.naoClassificado + d.total);
      } else if (categoria !== "ignorar") {
        const campo = this.campoDa(categoria);
        linha[campo] = cent(linha[campo] + d.total);
      }

      const acumulado = porPlano.get(d.plano) ?? {
        plano: d.plano,
        categoria,
        origem,
        valor: 0,
        lancamentos: 0,
        exemplo: d.historico,
      };
      acumulado.valor = cent(acumulado.valor + d.total);
      acumulado.lancamentos += d.lancamentos;
      if (!acumulado.exemplo) acumulado.exemplo = d.historico;
      porPlano.set(d.plano, acumulado);
    }

    for (const c of competencias) {
      const linha = meses[c.mes - 1];
      if (!linha) continue;
      linha.emprestimos = num(c.emprestimos);
      linha.caixa = num(c.caixa);
      linha.observacao = c.observacao;
      linha.manualPreenchido = true;
      // O desconto lançado na fatura manda; o informado à mão só cobre a
      // ausência dele, para não contar o mesmo desconto duas vezes.
      if (linha.descontos === 0) linha.descontos = num(c.descontos);
    }

    for (const linha of meses) this.aplicarFormulas(linha, tributos);

    const planos = Array.from(porPlano.values()).sort(
      (a, b) => b.valor - a.valor,
    );

    return {
      ano,
      base,
      tributos,
      meses,
      total: this.somarAno(meses, tributos),
      planos,
      naoClassificados: planos.filter((p) => p.origem === "nao_classificado"),
    };
  }

  /**
   * Grava a classificação de um plano de contas.
   *
   * Uma regra com `historicoContem` convive com a regra geral do mesmo plano:
   * são as duas linhas que separam o DAS lançado como `icms` do ICMS de
   * verdade.
   */
  public async classificarPlano(
    plano: string,
    categoria: CategoriaCodef,
    usuario: string,
    historicoContem?: string | null,
  ): Promise<CodefPlanoConta> {
    const repo = AppDataSource.getRepository(CodefPlanoConta);
    const chaveHistorico = historicoContem?.trim() || null;

    const existente = await repo
      .createQueryBuilder("r")
      .where("r.plano_contas = :plano", { plano: plano.trim() })
      .andWhere(
        chaveHistorico === null
          ? "r.historico_contem IS NULL"
          : "r.historico_contem = :hist",
        chaveHistorico === null ? {} : { hist: chaveHistorico },
      )
      .getOne();

    const registro = existente ?? repo.create({ plano_contas: plano.trim() });
    registro.historico_contem = chaveHistorico;
    registro.categoria = categoria;
    registro.definido_por = usuario || null;

    return repo.save(registro);
  }

  public async removerClassificacao(id: number): Promise<boolean> {
    const resultado = await AppDataSource.getRepository(
      CodefPlanoConta,
    ).delete(id);
    return (resultado.affected ?? 0) > 0;
  }

  /** Salva (ou atualiza) dívida, caixa e descontos de um mês. */
  public async salvarCompetencia(
    ano: number,
    mes: number,
    valores: {
      emprestimos?: number;
      caixa?: number;
      descontos?: number;
      observacao?: string | null;
    },
    usuario: string,
  ): Promise<CodefCompetencia> {
    const repo = AppDataSource.getRepository(CodefCompetencia);
    const registro =
      (await repo.findOne({ where: { ano, mes } })) ?? repo.create({ ano, mes });

    if (valores.emprestimos !== undefined)
      registro.emprestimos = String(valores.emprestimos);
    if (valores.caixa !== undefined) registro.caixa = String(valores.caixa);
    if (valores.descontos !== undefined)
      registro.descontos = String(valores.descontos);
    if (valores.observacao !== undefined)
      registro.observacao = valores.observacao;

    registro.informado_por = usuario || null;

    return repo.save(registro);
  }

  /** Regras gravadas, para a tela mostrar o que já foi decidido. */
  public listarRegras(): Promise<CodefPlanoConta[]> {
    return AppDataSource.getRepository(CodefPlanoConta).find({
      order: { plano_contas: "ASC" },
    });
  }

  /**
   * Faturamento por mês.
   *
   * `valor` é varchar no MKAuth e uma linha da base usa vírgula decimal, daí o
   * REPLACE antes do CAST. Título apagado (`deltitulo`) ou cancelado fica de
   * fora: não foi faturado.
   */
  private async buscarReceitas(
    inicio: string,
    fim: string,
    base: BaseCompetencia,
  ): Promise<{ mes: number; rob: number; descontos: number }[]> {
    const coluna = base === "pagamento" ? "datapag" : "datavenc";
    const filtroPago = base === "pagamento" ? "AND status = 'pago'" : "";

    const linhas = await MkauthSource.query(
      `SELECT MONTH(${coluna}) AS mes,
              SUM(CAST(REPLACE(valor, ',', '.') AS DECIMAL(14,2))) AS rob,
              SUM(valordesc) AS descontos
         FROM sis_lanc
        WHERE deltitulo = 0
          AND status <> 'cancelado'
          ${filtroPago}
          AND ${coluna} >= ? AND ${coluna} < ?
        GROUP BY MONTH(${coluna})`,
      [inicio, fim],
    );

    return linhas.map((l: any) => ({
      mes: num(l.mes),
      rob: num(l.rob),
      descontos: num(l.descontos),
    }));
  }

  /**
   * Contas a pagar por mês, plano de contas e histórico.
   *
   * Agrupa pelo histórico também porque é ele que desempata quando o plano de
   * contas está errado. São poucas centenas de linhas por ano.
   */
  private async buscarDespesas(
    inicio: string,
    fim: string,
    base: BaseCompetencia,
  ): Promise<LinhaDespesa[]> {
    const coluna = base === "pagamento" ? "datapg" : "vencimento";
    const filtroPago = base === "pagamento" ? "AND status = 'liquidado'" : "";

    const linhas = await MkauthSource.query(
      `SELECT MONTH(${coluna}) AS mes,
              planodecontas AS plano,
              historico,
              SUM(valor) AS total,
              COUNT(*) AS lancamentos
         FROM sis_contaspagar
        WHERE ${coluna} >= ? AND ${coluna} < ?
          ${filtroPago}
        GROUP BY MONTH(${coluna}), planodecontas, historico`,
      [inicio, fim],
    );

    return linhas.map((l: any) => ({
      mes: num(l.mes),
      plano: String(l.plano ?? "").trim() || "(sem plano de contas)",
      historico: l.historico ? String(l.historico) : null,
      total: num(l.total),
      lancamentos: num(l.lancamentos),
    }));
  }

  /**
   * Decide a categoria de um lançamento.
   *
   * Ordem: regra gravada com histórico, regra gravada do plano, histórico
   * padrão, plano padrão, não classificado. O histórico vem antes do plano
   * porque é o mais específico dos dois.
   */
  private classificar(
    plano: string,
    historico: string | null,
    regras: CodefPlanoConta[],
  ): { categoria: CategoriaCodef | null; origem: PlanoApurado["origem"] } {
    const planoNorm = normalizarPlano(plano);
    const historicoNorm = normalizarPlano(historico ?? "");

    const doPlano = regras.filter(
      (r) => normalizarPlano(r.plano_contas) === planoNorm,
    );

    const porHistorico = doPlano.find(
      (r) =>
        r.historico_contem &&
        historicoNorm.includes(normalizarPlano(r.historico_contem)),
    );
    if (porHistorico)
      return { categoria: porHistorico.categoria, origem: "manual" };

    const geral = doPlano.find((r) => !r.historico_contem);
    if (geral) return { categoria: geral.categoria, origem: "manual" };

    const padraoHistorico = HISTORICOS_PADRAO.find((r) =>
      historicoNorm.includes(normalizarPlano(r.contem)),
    );
    if (padraoHistorico)
      return { categoria: padraoHistorico.categoria, origem: "padrao" };

    const padrao = PLANOS_PADRAO[planoNorm];
    if (padrao) return { categoria: padrao, origem: "padrao" };

    return { categoria: null, origem: "nao_classificado" };
  }

  /** Campo de `LinhaMes` que recebe cada categoria. */
  private campoDa(categoria: CategoriaCodef): CampoValor {
    const mapa: Partial<Record<CategoriaCodef, CampoValor>> = {
      pessoal: "pessoal",
      link: "link",
      manutencao: "manutencao",
      aluguel: "aluguel",
      energia: "energia",
      marketing: "marketing",
      outras: "outras",
      tributo_das: "tributoDas",
      tributo_outros: "tributoOutros",
      capex: "capex",
      financeiro: "financeiro",
    };
    return mapa[categoria] ?? "outras";
  }

  /** Aplica as fórmulas da planilha depois que os totais estão somados. */
  private aplicarFormulas(linha: LinhaMes, tributos: BaseTributos): void {
    linha.rol = cent(linha.rob - linha.descontos);
    linha.totalDespesas = cent(
      COLUNAS_DESPESA.reduce((soma, c) => soma + linha[this.campoDa(c)], 0),
    );
    linha.ebitda = cent(linha.rol - linha.totalDespesas);
    linha.cargaTributaria =
      tributos === "das"
        ? linha.tributoDas
        : cent(linha.tributoDas + linha.tributoOutros);
    linha.dividaLiquida = cent(linha.emprestimos - linha.caixa);
  }

  private linhaVazia(mes: number, nome: string): LinhaMes {
    return {
      mes,
      nome,
      rob: 0,
      descontos: 0,
      rol: 0,
      pessoal: 0,
      link: 0,
      manutencao: 0,
      aluguel: 0,
      energia: 0,
      marketing: 0,
      outras: 0,
      totalDespesas: 0,
      ebitda: 0,
      tributoDas: 0,
      tributoOutros: 0,
      cargaTributaria: 0,
      emprestimos: 0,
      caixa: 0,
      dividaLiquida: 0,
      capex: 0,
      financeiro: 0,
      naoClassificado: 0,
      manualPreenchido: false,
      fechado: false,
      observacao: null,
    };
  }

  /**
   * Total do ano.
   *
   * Dívida e caixa não são somados: são saldo, não fluxo. A planilha usa o
   * saldo de dezembro, e é isso que aparece aqui — de dezembro, ou do último
   * mês que alguém preencheu.
   */
  private somarAno(meses: LinhaMes[], tributos: BaseTributos): LinhaMes {
    const total = this.linhaVazia(0, "Total do ano");

    const fluxo: CampoValor[] = [
      "rob",
      "descontos",
      "pessoal",
      "link",
      "manutencao",
      "aluguel",
      "energia",
      "marketing",
      "outras",
      "tributoDas",
      "tributoOutros",
      "capex",
      "financeiro",
      "naoClassificado",
    ];

    for (const linha of meses)
      for (const campo of fluxo)
        total[campo] = cent(total[campo] + linha[campo]);

    const ultimoPreenchido = [...meses]
      .reverse()
      .find((m) => m.manualPreenchido);
    total.emprestimos = ultimoPreenchido?.emprestimos ?? 0;
    total.caixa = ultimoPreenchido?.caixa ?? 0;
    total.manualPreenchido = Boolean(ultimoPreenchido);

    this.aplicarFormulas(total, tributos);
    return total;
  }

  /**
   * Erro claro quando um dos bancos ainda não subiu. Sem isso o TypeORM
   * responde "No metadata for ..." e ninguém liga o problema à conexão.
   */
  private exigirBancos(): void {
    if (!MkauthSource.isInitialized)
      throw new Error(
        "Sem conexão com o MKAuth. Tente novamente em instantes.",
      );
    if (!AppDataSource.isInitialized)
      throw new Error("Sem conexão com o banco do sistema.");
  }
}

export default new CodefService();
