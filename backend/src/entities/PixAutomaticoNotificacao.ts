import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

/**
 * Tudo que a Efí manda nos webhooks do Pix Automático, como chegou.
 *
 * A notificação é gravada antes de ser processada: assim o webhook responde
 * 200 na hora (a Efí só reenvia 9 vezes em ~5 horas e depois desiste), e uma
 * falha no processamento não faz a notificação se perder.
 */
@Entity("pix_automatico_notificacoes")
export class PixAutomaticoNotificacao {
  @PrimaryGeneratedColumn()
  id!: number;

  /** "cobr" (cobranças) ou "rec" (recorrências). */
  @Column({ type: "varchar", length: 10 })
  origem!: string;

  @Column({ type: "text" })
  payload!: string;

  @Column({ type: "tinyint", default: 0 })
  processada!: boolean;

  @Column({ type: "text", nullable: true })
  erro!: string | null;

  @CreateDateColumn({ name: "criado_em" })
  criadoEm!: Date;
}
