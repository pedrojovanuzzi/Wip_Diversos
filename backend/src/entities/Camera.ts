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

  // Marca/protocolo da câmera. A detecção de movimento (CGI Dahua) só funciona
  // em Intelbras/Dahua. Default 'intelbras'.
  @Column({ type: "varchar", length: 20, default: "intelbras" })
  tipo!: string;

  // Fonte RTSP (pode conter usuário/senha da câmera).
  @Column({ type: "text" })
  rtsp_url!: string;

  // Porta HTTP da câmera (eventos de movimento + config via CGI). Padrão 80;
  // câmeras com IP público/port-forward costumam usar outra porta.
  @Column({ type: "int", default: 80 })
  http_port!: number;

  // Identificador do path no MediaMTX (ex: cli3_cam_ab12cd34).
  @Column({ type: "varchar", length: 64, unique: true })
  path_name!: string;

  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  // Gravação 24/7 ligada (true) ou pausada (false). O "ao vivo" continua mesmo pausado.
  @Column({ type: "boolean", default: true })
  gravando!: boolean;

  // Segundos que o MediaMTX continua gravando DEPOIS que o movimento para
  // (latch). 0 = para na hora que o movimento acaba. Default 8.
  @Column({ type: "int", default: 8 })
  record_latch!: number;

  // Regiões de interesse da detecção de movimento: JSON com array de retângulos
  // [{x,y,w,h}] normalizado (0..1). NULL = analisa o quadro inteiro.
  @Column({ type: "varchar", length: 1024, nullable: true })
  motion_roi?: string | null;

  @CreateDateColumn({ type: "timestamp" })
  created_at?: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at?: Date;
}
