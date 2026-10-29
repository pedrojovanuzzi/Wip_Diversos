import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/**
 * Link que o cliente recebe para criar a própria conta da Watch TV.
 *
 * Quem digita o e-mail é o cliente: a Watch Brasil recusa e-mail já usado em
 * outra conta, e o atendente não tem como saber disso antes. Usar o link
 * substitui a conta anterior do cadastro, então ele também serve para refazer.
 */
@Entity("streaming_convites")
export class StreamingConvite {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 64 })
  token!: string;

  @Index()
  @Column({ type: "varchar", length: 100 })
  login!: string;

  /** Solicitação de serviço que gerou o link, quando veio de uma. */
  @Column({ type: "int", nullable: true })
  solicitacao_id!: number | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  criado_por!: string | null;

  @Column({ type: "datetime" })
  expira_em!: Date;

  /** Preenchido quando o cliente cria a conta; o link deixa de valer. */
  @Column({ type: "datetime", nullable: true })
  usado_em!: Date | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  email_usado!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
