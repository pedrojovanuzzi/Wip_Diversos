import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

/**
 * Categorias da coleta mensal CODEF (Anatel).
 *
 * As sete primeiras são as colunas de despesa da planilha. As demais existem
 * para tirar do EBITDA o que não é despesa operacional: tributo entra em
 * "Carga Tributária", investimento (`capex`) vira depreciação e não passa pelo
 * resultado do mês, e juros (`financeiro`) ficam abaixo do EBITDA por
 * definição.
 */
export type CategoriaCodef =
  | "pessoal"
  | "link"
  | "manutencao"
  | "aluguel"
  | "energia"
  | "marketing"
  | "outras"
  | "tributo_das"
  | "tributo_outros"
  | "capex"
  | "financeiro"
  | "ignorar";

export const CATEGORIAS_CODEF: CategoriaCodef[] = [
  "pessoal",
  "link",
  "manutencao",
  "aluguel",
  "energia",
  "marketing",
  "outras",
  "tributo_das",
  "tributo_outros",
  "capex",
  "financeiro",
  "ignorar",
];

/**
 * De-para entre o plano de contas do MKAuth (`sis_contaspagar.planodecontas`)
 * e as colunas do CODEF.
 *
 * Só guarda o que foi decidido na tela. O palpite inicial de cada plano vem da
 * tabela `PLANOS_PADRAO` do serviço; uma linha aqui sempre vence esse palpite.
 *
 * O plano de contas do MKAuth é texto livre — hoje são 152 valores distintos,
 * com maiúsculas, acentos quebrados e nomes de uso único ("COMPRA DE BONES 100
 * UNIDADES"). Por isso a chave é a string crua, normalizada só no caso e nos
 * espaços: qualquer tentativa de agrupar mais que isso juntaria coisas
 * diferentes.
 *
 * `historico_contem`, quando preenchido, restringe a regra aos lançamentos cujo
 * histórico contém aquele texto, e é avaliada antes das regras sem filtro.
 * Existe porque o plano de contas do MKAuth não é confiável: em agosto/2026 o
 * DAS de R$ 44.347 está lançado com `planodecontas = 'icms'`, e só o histórico
 * ("IMPOSTOS SIMPLES NACIONAL") diz o que ele é.
 */
@Entity("codef_plano_contas")
@Index("idx_codef_plano_contas_plano", ["plano_contas"])
export class CodefPlanoConta {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Valor de `sis_contaspagar.planodecontas`, sem espaços nas pontas. */
  @Column({ type: "varchar", length: 255 })
  plano_contas!: string;

  /** Trecho do histórico que a regra exige; nulo = vale para todos. */
  @Column({ type: "varchar", length: 255, nullable: true })
  historico_contem!: string | null;

  @Column({ type: "varchar", length: 32 })
  categoria!: CategoriaCodef;

  /** Quem classificou, para dar rastro a um número que vai para a Anatel. */
  @Column({ type: "varchar", length: 100, nullable: true })
  definido_por!: string | null;

  @CreateDateColumn({ type: "datetime" })
  created_at!: Date;

  @UpdateDateColumn({ type: "datetime" })
  updated_at!: Date;
}
