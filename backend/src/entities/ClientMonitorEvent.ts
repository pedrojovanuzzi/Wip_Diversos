import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from "typeorm";

// Registro de conexão coletado durante um monitoramento (ClientMonitor).
@Entity("client_monitor_events")
export class ClientMonitorEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index("IDX_client_monitor_events_monitor")
  @Column({ type: "int" })
  monitor_id!: number;

  @Column({ type: "varchar", length: 128 })
  pppoe!: string;

  // inicio | conectado | desconectado | online | offline | erro | fim
  @Column({ type: "varchar", length: 20 })
  tipo!: string;

  // true quando o evento representa mudança de estado (conectou/caiu)
  @Column({ type: "boolean", default: false })
  mudanca!: boolean;

  @Column({ type: "varchar", length: 32, nullable: true })
  servidor!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  ip!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  caller_id!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  uptime!: string | null;

  // Consumo acumulado da sessão corrente (radacct), em bytes
  @Column({ type: "bigint", nullable: true })
  download!: number | null;

  @Column({ type: "bigint", nullable: true })
  upload!: number | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  mensagem!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
