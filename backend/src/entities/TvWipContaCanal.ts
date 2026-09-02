import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/**
 * Exceção de canal para um cliente específico.
 *
 * `permitido = true`  → libera um canal que os pacotes dele não dariam.
 * `permitido = false` → bloqueia um canal que os pacotes dariam.
 *
 * É o que permite "esse canal só para fulano" sem criar um pacote por cliente.
 */
@Entity("tv_wip_conta_canais")
@Index(["login", "idcanal"], { unique: true })
export class TvWipContaCanal {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100 })
  login!: string;

  @Column({ type: "int" })
  idcanal!: number;

  @Column({ type: "boolean", default: true })
  permitido!: boolean;

  @CreateDateColumn({ type: "datetime" })
  created_at!: Date;
}
