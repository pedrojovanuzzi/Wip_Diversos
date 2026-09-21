import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Mensalidade de uma licença de software.
 *
 * Fica separada das mensalidades de internet: estas vivem no MKAuth
 * (`sis_lanc`) e são baixadas pelo webhook do Pix; as de licença vivem só
 * aqui. O Pix de licença é marcado com a informação adicional "LICENCA", que é
 * o que faz o webhook do MKAuth passar direto por ele.
 */
@Entity("licenca_mensalidades")
@Index(["licencaId", "competencia"], { unique: true })
export class LicencaMensalidade {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "licenca_id", type: "int" })
  licencaId!: number;

  /** Cópia do software e do cliente, para o histórico não mudar depois. */
  @Column({ type: "varchar", length: 255, nullable: true })
  software!: string | null;

  @Column({
    name: "cliente_nome",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  clienteNome!: string | null;

  /** Mês de referência, no formato AAAA-MM. */
  @Column({ type: "varchar", length: 7 })
  competencia!: string;

  @Column({ type: "date" })
  vencimento!: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  valor!: string;

  /** aberta | paga | cancelada. Vencida é só a aberta com data passada. */
  @Column({ type: "varchar", length: 20, default: "aberta" })
  status!: string;

  /** Cobrança Pix gerada para esta mensalidade. */
  @Column({ type: "varchar", length: 64, nullable: true })
  txid!: string | null;

  @Column({ name: "pix_copia_cola", type: "text", nullable: true })
  pixCopiaCola!: string | null;

  @Column({ name: "pix_link", type: "varchar", length: 255, nullable: true })
  pixLink!: string | null;

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

  @Column({
    name: "end_to_end_id",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  endToEndId!: string | null;

  /** Como foi dada a baixa: pix, manual. */
  @Column({
    name: "forma_pagamento",
    type: "varchar",
    length: 30,
    nullable: true,
  })
  formaPagamento!: string | null;

  @Column({ type: "text", nullable: true })
  observacao!: string | null;

  // --- NFS-e desta mensalidade (emissão manual) ---

  /** Id da nota na tabela `nfse`. */
  @Column({ name: "nfse_id", type: "int", nullable: true })
  nfseId!: number | null;

  @Column({ name: "nfse_numero", type: "varchar", length: 30, nullable: true })
  nfseNumero!: string | null;

  @Column({ name: "nfse_chave", type: "varchar", length: 60, nullable: true })
  nfseChave!: string | null;

  @Column({ name: "nfse_emitida_em", type: "datetime", nullable: true })
  nfseEmitidaEm!: Date | null;

  @Column({ name: "nfse_cancelada_em", type: "datetime", nullable: true })
  nfseCanceladaEm!: Date | null;

  @Column({ name: "nfse_erro", type: "text", nullable: true })
  nfseErro!: string | null;

  @CreateDateColumn({ name: "criado_em" })
  criadoEm!: Date;

  @UpdateDateColumn({ name: "atualizado_em" })
  atualizadoEm!: Date;
}
