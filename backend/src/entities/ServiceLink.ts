import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

export type ServiceLinkStatus =
  | "pendente"
  | "em_andamento"
  | "concluido"
  | "cancelado";

@Entity("service_links")
export class ServiceLink {
  @PrimaryGeneratedColumn()
  id?: number;

  /** Token aleatório usado na URL pública (/s/:token). */
  @Column({ type: "varchar", length: 64, unique: true })
  token!: string;

  /** Id do serviço no catálogo (mudanca_comodo, wifi_extendido, ...). */
  @Column({ type: "varchar", length: 64 })
  servico!: string;

  /** Cliente pré-vinculado ao gerar o link (opcional). */
  @Column({ type: "varchar", length: 255, nullable: true })
  login_cliente?: string | null;

  @Column({ type: "varchar", length: 32, nullable: true })
  cpf?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  nome_cliente?: string | null;

  @Column({ type: "varchar", length: 32, default: "pendente" })
  status!: ServiceLinkStatus;

  @Column({ type: "timestamp", nullable: true })
  expira_em?: Date | null;

  @Column({ type: "timestamp", nullable: true })
  aberto_em?: Date | null;

  @Column({ type: "timestamp", nullable: true })
  concluido_em?: Date | null;

  /** Tentativas de identificação por CPF, para travar força bruta. */
  @Column({ type: "int", default: 0 })
  tentativas!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  criado_por?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  observacao?: string | null;

  /**
   * Valor cobrado neste link. Nulo = usa o valor padrão do catálogo; o
   * atendimento pode combinar outro preço na hora de gerar o link.
   */
  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  valor?: string | null;

  /** Estado do preenchimento: cliente escolhido, forma de pagamento, formulário. */
  @Column({ type: "json", nullable: true })
  dados?: any;

  /** Resultado: solicitação, chamado, lançamento, Pix e contrato ZapSign. */
  @Column({ type: "json", nullable: true })
  resultado?: any;

  /** Solicitação gerada quando o cliente conclui o formulário. */
  @Column({ type: "int", nullable: true })
  solicitacao_id?: number | null;

  @CreateDateColumn({ type: "timestamp" })
  criado_em?: Date;
}
