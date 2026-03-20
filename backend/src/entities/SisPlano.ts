import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity("sis_plano")
export class SisPlano {
  @PrimaryColumn({ type: "varchar", length: 255 })
  nome!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  valor!: string;

  @Column({ type: "varchar", length: 3, nullable: true })
  oculto!: "sim" | "nao";
}
