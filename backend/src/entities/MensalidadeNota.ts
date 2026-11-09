import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * Notas dos títulos na tela Mensalidades. O MK-Auth guarda as dele em
 * `sis_notas`, ligadas ao título por um token calculado dentro do código
 * fechado do MK-Auth; como não dá para gerar esse token, as notas daqui ficam
 * neste banco e não aparecem dentro do MK-Auth (nem as de lá aqui).
 */
@Entity("mensalidade_notas")
@Index("idx_mensalidade_notas_titulo", ["titulo_id"])
export class MensalidadeNota {
  @PrimaryGeneratedColumn()
  id!: number;

  /** sis_lanc.id */
  @Column({ type: "int" })
  titulo_id!: number;

  @Column({ type: "varchar", length: 64 })
  login_cliente!: string;

  @Column({ type: "text" })
  texto!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  usuario!: string | null;

  @CreateDateColumn()
  criado_em!: Date;
}
