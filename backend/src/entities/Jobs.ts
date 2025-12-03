// model/Jobs.ts (Exemplo TypeORM)
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("jobs")
export class Jobs {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 40 })
  name!: string;

  @Column({ type: "varchar", length: 255 })
  description!: string;

  @Column({ type: "varchar", length: 40 })
  status!: string; // "pendente", "processando", "concluido", "erro"

  @Column({ type: "int", default: 0 })
  total!: number; // Quantos clientes são no total (ex: 430)

  @Column({ type: "int", default: 0 })
  processados!: number; // Quantos já foram feitos (ex: 15)

  @Column({ type: "json", nullable: true }) // Ou "simple-json" dependendo do DB
  resultado!: any; // O JSON final com as respostas da SEFAZ

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at!: Date;
}
