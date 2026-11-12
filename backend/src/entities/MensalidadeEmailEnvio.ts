import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Cada lembrete de boleto mandado por e-mail pela engrenagem da tela
 * Mensalidades (services/MensalidadesLembretes.ts). A chave única
 * (título, etapa, vencimento) é o que impede mandar a mesma etapa duas vezes;
 * se o vencimento do título mudar, a etapa vale de novo.
 */
@Entity("mensalidade_email_envio")
@Index("uq_mensalidade_email_envio", ["titulo_id", "dias_antes", "vencimento"], {
  unique: true,
})
@Index("idx_mensalidade_email_envio_login", ["login_cliente"])
export class MensalidadeEmailEnvio {
  @PrimaryGeneratedColumn()
  id!: number;

  /** sis_lanc.id */
  @Column({ type: "int" })
  titulo_id!: number;

  @Column({ type: "varchar", length: 64 })
  login_cliente!: string;

  /** Etapa: quantos dias antes do vencimento (0 = no dia). */
  @Column({ type: "int" })
  dias_antes!: number;

  @Column({ type: "date" })
  vencimento!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  email!: string | null;

  /** enviado | erro */
  @Column({ type: "varchar", length: 16 })
  situacao!: string;

  @Column({ type: "int", default: 1 })
  tentativas!: number;

  @Column({ type: "bigint", nullable: true })
  charge_id!: string | null;

  /** O PDF do boleto foi anexado. */
  @Column({ type: "tinyint", default: 0 })
  com_pdf!: number;

  @Column({ type: "text", nullable: true })
  erro!: string | null;

  @CreateDateColumn()
  criado_em!: Date;

  @UpdateDateColumn()
  atualizado_em!: Date;
}
