import { Entity, PrimaryColumn, Column, UpdateDateColumn } from "typeorm";

/**
 * Se o cliente tem direito à Watch TV, num lugar só: 1 tem, 0 não tem.
 *
 * Antes era preciso juntar a linha do serviço em `sis_ser_contratos` (avulsa
 * ou colaborador) com o plano do cadastro (combo, que nem sempre tem a linha
 * de R$ 0,00). A conta na Watch Brasil é outra coisa: fica em
 * `streaming_assinantes`, e o cliente pode ter direito sem ter criado a conta.
 */
@Entity("clientes_watchtv")
export class ClienteWatchTv {
  @PrimaryColumn({ type: "varchar", length: 100 })
  login!: string;

  @Column({ type: "tinyint", width: 1, default: 0 })
  watchtv!: number;

  /** De onde vem o direito: "contrato" (linha do serviço) ou "plano" (combo). */
  @Column({ type: "varchar", length: 20, nullable: true })
  origem!: string | null;

  @UpdateDateColumn()
  atualizado_em!: Date;
}
