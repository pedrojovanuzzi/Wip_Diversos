import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

/**
 * Preferências da tela Mensalidades por cliente do MK-Auth. Sem linha aqui,
 * vale o padrão: automático DESLIGADO.
 */
@Entity("mensalidade_cliente")
export class MensalidadeCliente {
  /** sis_cliente.login */
  @PrimaryColumn({ type: "varchar", length: 64 })
  login!: string;

  /**
   * 1 = a engrenagem cuida do cliente (mensalidade de isento, bolix e
   * lembrete por e-mail). 0 = nada automático; os botões manuais continuam.
   */
  @Column({ type: "tinyint", default: 0 })
  automatico!: number;

  @Column({ type: "varchar", length: 100, nullable: true })
  atualizado_por!: string | null;

  @UpdateDateColumn()
  atualizado_em!: Date;
}
