import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

/** Canal que compõe um pacote. `idcanal` aponta para tb_canais (outro banco). */
@Entity("tv_wip_pacote_canais")
@Index(["pacote_id", "idcanal"], { unique: true })
export class TvWipPacoteCanal {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  pacote_id!: number;

  @Column({ type: "int" })
  idcanal!: number;
}
