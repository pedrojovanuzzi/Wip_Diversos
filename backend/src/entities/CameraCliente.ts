import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("camera_clientes")
export class CameraCliente {
  @PrimaryGeneratedColumn()
  id?: number;

  // Login PPPOE (vem do sis_cliente). Travado e único: 1 conta por login.
  @Column({ type: "varchar", length: 255, unique: true })
  login!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  email?: string | null;

  // Hash bcrypt, definido pelo cliente no link de setup.
  @Column({ type: "varchar", length: 255, nullable: true })
  password?: string | null;

  // Token do link de cadastro. Invalidado (null) após o cliente definir a senha.
  @Column({ type: "varchar", length: 36, nullable: true, unique: true })
  setup_uuid?: string | null;

  @Column({
    type: "enum",
    enum: ["pendente", "ativo", "bloqueado"],
    default: "pendente",
  })
  status!: "pendente" | "ativo" | "bloqueado";

  // Cota de armazenamento (GB) das gravações. Plano: 5 (padrão), 10, 15 ou 20.
  @Column({ type: "int", default: 5 })
  storage_gb!: number;

  @CreateDateColumn({ type: "timestamp" })
  created_at?: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at?: Date;
}
