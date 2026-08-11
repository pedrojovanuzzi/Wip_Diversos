import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

// Monitoramento agendado de um cliente PPPoE por uma janela de X horas.
// Os eventos coletados durante a janela ficam em ClientMonitorEvent.
@Entity("client_monitors")
export class ClientMonitor {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 128 })
  pppoe!: string;

  // Duração da janela de monitoramento, em horas
  @Column({ type: "int" })
  horas!: number;

  // Intervalo entre as coletas, em segundos
  @Column({ type: "int", default: 60 })
  intervalo!: number;

  // ativo | finalizado | cancelado
  @Column({ type: "varchar", length: 20, default: "ativo" })
  status!: string;

  @Column({ type: "timestamp" })
  iniciado_em!: Date;

  @Column({ type: "timestamp" })
  expira_em!: Date;

  @Column({ type: "timestamp", nullable: true })
  finalizado_em!: Date | null;

  @Column({ type: "timestamp", nullable: true })
  ultima_verificacao!: Date | null;

  // Login do usuário do sistema que abriu o monitoramento
  @Column({ type: "varchar", length: 128, nullable: true })
  criado_por!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
