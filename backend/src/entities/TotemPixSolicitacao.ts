import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("totem_solicitacoes")
export class TotemPixSolicitacao {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "varchar", length: 100, nullable: true })
  txid!: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  valor!: string | null;

  @Index()
  @Column({ type: "varchar", length: 20, nullable: true })
  cpf_cnpj!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  login!: string | null;

  @Column({ type: "text", nullable: true })
  pix_url!: string | null;

  @CreateDateColumn()
  horario!: Date;
}
