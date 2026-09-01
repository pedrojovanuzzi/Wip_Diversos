import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

/**
 * O que o CODEF pede e o MKAuth não tem, informado à mão uma vez por mês.
 *
 * São três coisas:
 *
 * - `emprestimos`: saldo devedor de empréstimos e financiamentos no fim do mês.
 *   O MKAuth não tem cadastro de dívida.
 * - `caixa`: saldo em conta e aplicações no fim do mês. O `sis_caixa` existe,
 *   mas é o caixa interno do sistema (acumula desde 2014 e não bate com o
 *   extrato bancário), então não serve para este campo.
 * - `descontos`: só é usado enquanto os descontos não forem lançados no
 *   `sis_lanc`. Hoje `valordesc` está zerado em todas as faturas; quando passar
 *   a ser preenchido, o valor apurado prevalece e este campo pode ficar vazio.
 */
@Entity("codef_competencias")
@Index("uq_codef_competencias", ["ano", "mes"], { unique: true })
export class CodefCompetencia {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  ano!: number;

  /** 1 a 12. */
  @Column({ type: "int" })
  mes!: number;

  @Column({ type: "decimal", precision: 14, scale: 2, default: 0 })
  emprestimos!: string;

  @Column({ type: "decimal", precision: 14, scale: 2, default: 0 })
  caixa!: string;

  /** Descontos concedidos no mês, enquanto não vierem do MKAuth. */
  @Column({ type: "decimal", precision: 14, scale: 2, default: 0 })
  descontos!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  observacao!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  informado_por!: string | null;

  @CreateDateColumn({ type: "datetime" })
  created_at!: Date;

  @UpdateDateColumn({ type: "datetime" })
  updated_at!: Date;
}
