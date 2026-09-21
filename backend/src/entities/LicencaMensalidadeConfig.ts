import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Regra de cobrança de cada software licenciado: em que dia vence, quanto
 * custa e se deve gerar mensalidade todo mês.
 *
 * Nada acontece com a licença quando a mensalidade vence — a cobrança aqui é
 * só registro e Pix; bloqueio continua sendo feito na mão.
 */
@Entity("licenca_mensalidade_configs")
export class LicencaMensalidadeConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Nome do software, como está cadastrado na licença. */
  @Index({ unique: true })
  @Column({ type: "varchar", length: 255 })
  software!: string;

  /** Dia do vencimento. Em mês mais curto, cai no último dia. */
  @Column({ name: "dia_vencimento", type: "int", default: 10 })
  diaVencimento!: number;

  /** Gera mensalidade automaticamente todo mês. */
  @Column({ name: "gerar_todo_mes", type: "tinyint", default: 1 })
  gerarTodoMes!: boolean;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  valor!: string;

  /** Desligado, o software para de gerar mensalidade. */
  @Column({ type: "tinyint", default: 1 })
  ativo!: boolean;

  @Column({ type: "text", nullable: true })
  observacao!: string | null;

  @CreateDateColumn({ name: "criado_em" })
  criadoEm!: Date;

  @UpdateDateColumn({ name: "atualizado_em" })
  atualizadoEm!: Date;
}
