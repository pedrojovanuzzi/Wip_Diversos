import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/** Pacote (grupo) de canais da TV WIP. */
@Entity("tv_wip_pacotes")
export class TvWipPacote {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, unique: true })
  nome!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  descricao!: string | null;

  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  /**
   * Pacote aplicado a quem não tem nenhum vínculo — evita que um cliente novo
   * fique sem canal nenhum até alguém lembrar de atribuir.
   */
  @Column({ type: "boolean", default: false })
  padrao!: boolean;

  @CreateDateColumn({ type: "datetime" })
  created_at!: Date;

  @UpdateDateColumn({ type: "datetime" })
  updated_at!: Date;
}
