import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export type AcaoAuditoria =
  | "CRIAR"
  | "EDITAR"
  | "REMOVER"
  | "LOGIN"
  | "LOGIN_FALHOU";

/**
 * Trilha de auditoria: quem entrou no sistema e quem criou, editou ou removeu
 * algo. Leituras não entram. Gravado por `utils/auditoria.ts`.
 */
@Entity("audit_logs")
@Index("idx_audit_logs_criado_em", ["criado_em"])
@Index("idx_audit_logs_user", ["user_id"])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id?: number;

  /** Nulo em login que falhou por usuário inexistente. */
  @Column({ type: "int", nullable: true })
  user_id?: number | null;

  /** Copiado no momento da ação: continua legível se o usuário for apagado. */
  @Column({ type: "varchar", length: 100, nullable: true })
  user_login?: string | null;

  @Column({ type: "varchar", length: 16 })
  acao!: AcaoAuditoria;

  /** Primeiro trecho da rota depois de /api, ex.: servidores-acesso. */
  @Column({ type: "varchar", length: 64, nullable: true })
  modulo?: string | null;

  @Column({ type: "varchar", length: 8, nullable: true })
  metodo?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  rota?: string | null;

  @Column({ type: "int", nullable: true })
  status_code?: number | null;

  /** Texto legível opcional, preenchido pelo controller com `descreverAcao`. */
  @Column({ type: "varchar", length: 500, nullable: true })
  descricao?: string | null;

  /** Corpo da requisição já sem senhas/tokens e truncado. */
  @Column({ type: "text", nullable: true })
  dados?: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  ip?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  user_agent?: string | null;

  @CreateDateColumn({ type: "datetime" })
  criado_em?: Date;
}
