import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/** Pacote atribuído a uma conta da TV WIP. */
@Entity("tv_wip_conta_pacotes")
@Index(["login", "pacote_id"], { unique: true })
export class TvWipContaPacote {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100 })
  login!: string;

  @Column({ type: "int" })
  pacote_id!: number;

  @CreateDateColumn({ type: "datetime" })
  created_at!: Date;
}
