import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * Mensalidades que o Wip Diversos criou no MK-Auth para clientes com o
 * boleto automático ativado. A chave única
 * (login, competência) é a trava contra duplicar: dois processos não criam
 * o mesmo mês juntos. O mês volta a ser criado se o título for excluído ou
 * ficar em atraso (ver reservarMes em services/MensalidadesCriacao.ts).
 */
@Entity("mensalidade_titulo_criado")
@Index("uq_mensalidade_titulo_criado", ["login", "competencia"], { unique: true })
export class MensalidadeTituloCriado {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 64 })
  login!: string;

  /** AAAA-MM */
  @Column({ type: "varchar", length: 7 })
  competencia!: string;

  /** sis_lanc.id (nulo se a criação falhou depois de reservar o mês). */
  @Column({ type: "int", nullable: true })
  titulo_id!: number | null;

  @Column({ type: "date" })
  vencimento!: string;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  valor!: string;

  /** Quando o mês foi reservado (ou reservado de novo). */
  @CreateDateColumn()
  criado_em!: Date;
}
