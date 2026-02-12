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

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
