import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Espelho local das cobranças do Pix Automático.
 *
 * Existe para não depender de a notificação da Efí chegar: a conferência
 * diária lê as cobranças lá e registra aqui o que já foi baixado, de modo que
 * a mesma cobrança nunca dá baixa duas vezes na mensalidade.
 */
@Entity("pix_automatico_cobrancas")
export class PixAutomaticoCobranca {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Identificador da cobrança na Efí. */
  @Index({ unique: true })
  @Column({ type: "varchar", length: 64 })
  txid!: string;

  /** Recorrência a que a cobrança pertence. */
  @Column({ name: "id_rec", type: "varchar", length: 64 })
  idRec!: string;

  /** Login (PPPoE) do cliente, lido do vínculo da recorrência. */
  @Column({ type: "varchar", length: 120, nullable: true })
  login!: string | null;

  /** Mensalidade correspondente no MKAuth (sis_lanc.id). */
  @Column({ name: "titulo_fatura", type: "int", nullable: true })
  tituloFatura!: number | null;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  valor!: string | null;

  @Column({ type: "date", nullable: true })
  vencimento!: string | null;

  /** Último status conhecido na Efí. */
  @Column({ type: "varchar", length: 30, nullable: true })
  status!: string | null;

  /** Identificador do Pix recebido, quando o dinheiro entrou. */
  @Column({
    name: "end_to_end_id",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  endToEndId!: string | null;

  /** Valor e momento em que o pagamento foi confirmado na Efí. */
  @Column({
    name: "valor_pago",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  valorPago!: string | null;

  @Column({ name: "pago_em", type: "datetime", nullable: true })
  pagoEm!: Date | null;

  /** Quando a mensalidade foi marcada como paga no MKAuth. */
  @Column({ name: "baixado_em", type: "datetime", nullable: true })
  baixadoEm!: Date | null;

  @Column({ type: "text", nullable: true })
  erro!: string | null;

  @CreateDateColumn({ name: "criado_em" })
  criadoEm!: Date;

  @UpdateDateColumn({ name: "atualizado_em" })
  atualizadoEm!: Date;
}
