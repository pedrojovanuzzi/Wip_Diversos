import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("sis_sercontratos")
export class SisSerContratos {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 20, nullable: true })
  cfop_serc!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  nome!: string;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  valor!: number;

  @Column({ type: "varchar", length: 10, nullable: true, default: "sim" })
  incluir!: string;

  @Column({ type: "datetime", nullable: true })
  data!: Date;

  @Column({ type: "varchar", length: 100, nullable: true })
  insuser!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  login!: string;
}
