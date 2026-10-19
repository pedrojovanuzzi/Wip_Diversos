import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Onde o botão "Testar domínio" da tela de DNS roda o `dig`. Tabela de uma
 * linha só: com host preenchido, o comando roda nesse servidor por SSH; sem
 * host, roda na própria máquina do backend.
 */
@Entity("powerdns_config")
export class PowerDnsConfig {
  @PrimaryGeneratedColumn()
  id?: number;

  /** Servidor acessado por SSH para rodar o dig. Vazio = roda local. */
  @Column({ type: "varchar", length: 128, nullable: true })
  host?: string | null;

  @Column({ type: "int", default: 22 })
  porta!: number;

  @Column({ type: "varchar", length: 128, nullable: true })
  login?: string | null;

  /** Guardada cifrada (AES-256-GCM); nunca sai pela API. */
  @Column({ type: "text", nullable: true })
  senha?: string | null;

  /** Servidor DNS consultado: dig @servidor_dns dominio. */
  @Column({ type: "varchar", length: 128, default: "143.255.135.34" })
  servidor_dns!: string;

  @CreateDateColumn({ type: "timestamp" })
  criado_em?: Date;

  @UpdateDateColumn({ type: "timestamp" })
  atualizado_em?: Date;
}
