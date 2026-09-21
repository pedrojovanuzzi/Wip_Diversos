import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("licencas")
export class LicencaEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255 })
  cliente_nome!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  software!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  chave!: string; // Pode ser HWID, MAC ou Serial

  @Column({
    type: "enum",
    enum: ["ativo", "bloqueado", "cancelado"],
    default: "ativo",
  })
  status!: "ativo" | "bloqueado" | "cancelado";

  @Column({ type: "text", nullable: true })
  observacao!: string;

  // --- Dados fiscais do tomador, usados na NFS-e da licença ---
  // Ficam aqui porque esse cliente não está no MKAuth, que é de onde a nota
  // avulsa costuma puxar os dados.

  /** CPF ou CNPJ, só dígitos. */
  @Column({ type: "varchar", length: 14, nullable: true })
  documento!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  razao_social!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  email!: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  telefone!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  endereco!: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  numero!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  complemento!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  bairro!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  cidade!: string | null;

  /** Código IBGE do município do tomador (7 dígitos). */
  @Column({ type: "varchar", length: 7, nullable: true })
  codigo_municipio!: string | null;

  @Column({ type: "varchar", length: 2, nullable: true })
  uf!: string | null;

  @Column({ type: "varchar", length: 8, nullable: true })
  cep!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
