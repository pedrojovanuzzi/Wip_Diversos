import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Histórico dos testes grátis da Watch TV.
 *
 * A assinatura de teste é apagada de `streaming_assinantes` quando o prazo
 * acaba, então sem este registro não sobraria nada dizendo que o cliente usou
 * o teste. É daqui que sai a soma dos dias de teste quando ele contrata a
 * Watch TV paga depois.
 */
@Entity("streaming_testes")
export class StreamingTeste {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "varchar", length: 100 })
  login!: string;

  /** Quando o teste começou. */
  @Column({ type: "datetime" })
  inicio!: Date;

  /** Quando terminaria pelo prazo concedido. */
  @Column({ name: "fim_previsto", type: "datetime", nullable: true })
  fimPrevisto!: Date | null;

  /** Quando terminou de fato. Nulo = teste em andamento. */
  @Column({ type: "datetime", nullable: true })
  fim!: Date | null;

  /** Dias efetivamente usados, fechados no fim do teste. */
  @Column({ type: "int", default: 0 })
  dias!: number;

  /** expirou | convertido | removido */
  @Column({ name: "motivo_fim", type: "varchar", length: 20, nullable: true })
  motivoFim!: string | null;

  @CreateDateColumn({ name: "criado_em" })
  criadoEm!: Date;

  @UpdateDateColumn({ name: "atualizado_em" })
  atualizadoEm!: Date;
}
