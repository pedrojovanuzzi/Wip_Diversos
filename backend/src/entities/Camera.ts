import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("cameras")
export class Camera {
  @PrimaryGeneratedColumn()
  id?: number;

  // FK lógica -> camera_clientes.id
  @Index()
  @Column({ type: "int" })
  cliente_id!: number;

  @Column({ type: "varchar", length: 255 })
  nome!: string;

  // Fonte RTSP (pode conter usuário/senha da câmera).
  @Column({ type: "text" })
  rtsp_url!: string;

  // Identificador do path no MediaMTX (ex: cli3_cam_ab12cd34).
  @Column({ type: "varchar", length: 64, unique: true })
  path_name!: string;

  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  @CreateDateColumn({ type: "timestamp" })
  created_at?: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at?: Date;
}
