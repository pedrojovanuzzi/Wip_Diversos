import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * Bolix (boleto + QR Pix) da Efí gerado pela tela Mensalidades para um título
 * do MK-Auth (sis_lanc.id). Um título pode ter vários ao longo do tempo (valor
 * alterado, vencimento novo); só um fica "ativo" por vez.
 */
@Entity("mensalidade_bolix")
@Index("idx_mensalidade_bolix_titulo", ["titulo_id"])
@Index("idx_mensalidade_bolix_charge", ["charge_id"], { unique: true })
export class MensalidadeBolix {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  titulo_id!: number;

  @Column({ type: "varchar", length: 64 })
  login_cliente!: string;

  /** charge_id da Efí. */
  @Column({ type: "bigint" })
  charge_id!: string;

  /** ativo | pago | cancelado | substituido | cancelado_manual (botão) */
  @Column({ type: "varchar", length: 16, default: "ativo" })
  situacao!: string;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  valor!: string;

  @Column({ type: "date" })
  vencimento!: string;

  /** Mês cobrado (AAAA-MM), da referência do título no MK-Auth. */
  @Column({ type: "varchar", length: 7, nullable: true })
  competencia!: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  linha_digitavel!: string | null;

  @Column({ type: "text", nullable: true })
  pix_copia_cola!: string | null;

  /** data:image/svg+xml;base64,... que a Efí devolve. */
  @Column({ type: "mediumtext", nullable: true })
  pix_qrcode_imagem!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  link!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  pdf!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  usuario!: string | null;

  @CreateDateColumn()
  criado_em!: Date;

  @Column({ type: "datetime", nullable: true })
  pago_em!: Date | null;
}
