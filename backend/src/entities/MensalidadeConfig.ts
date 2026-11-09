import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

/**
 * Configurações da tela Mensalidades (a engrenagem), uma linha por chave com
 * o valor em JSON. Ex.: "geracao_boletos" e "geracao_boletos_ultima".
 */
@Entity("mensalidade_config")
export class MensalidadeConfig {
  @PrimaryColumn({ type: "varchar", length: 64 })
  chave!: string;

  @Column({ type: "text" })
  valor!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  atualizado_por!: string | null;

  @UpdateDateColumn()
  atualizado_em!: Date;
}
