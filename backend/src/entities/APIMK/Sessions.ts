import { Entity, PrimaryColumn, Column, UpdateDateColumn } from "typeorm";

@Entity("sessions")
export default class Sessions {
  @PrimaryColumn({ type: "varchar", length: 20 })
  celular!: string;

  @Column({ type: "varchar", length: 50, default: "" })
  stage!: string;

  @Column({ type: "json", nullable: true })
  dados!: any; // Guarda session.dadosCadastro, service, etc.

  @UpdateDateColumn()
  updated_at!: Date;
}
