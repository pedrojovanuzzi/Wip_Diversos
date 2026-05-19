import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("declaracao_quitacao")
export class DeclaracaoQuitacao {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 20 })
  tipo_pessoa!: string;

  @Column({ type: "varchar", length: 255 })
  nome!: string;

  @Column({ type: "varchar", length: 30 })
  cpf_cnpj!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  login!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  contrato!: string;

  @Column({ type: "date", nullable: true })
  data_declaracao!: Date;

  @Column({ type: "varchar", length: 255, nullable: true })
  endereco!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  bairro!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  cidade!: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  ano_referencia!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  signatario_nome!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  signatario_empresa!: string;

  @Column({ type: "longtext", nullable: true })
  pdf_base64!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  declarante_nome!: string;

  @Column({ type: "varchar", length: 30, nullable: true })
  declarante_cpf_cnpj!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  declarante_endereco!: string;

  @Column({ type: "date", nullable: true })
  periodo_inicio!: Date;

  @Column({ type: "date", nullable: true })
  periodo_fim!: Date;

  @Column({ type: "varchar", length: 30, nullable: true })
  signatario_cpf!: string;

  @Column({ type: "longtext", nullable: true })
  assinatura_base64!: string;

  @CreateDateColumn()
  created_at!: Date;
}
