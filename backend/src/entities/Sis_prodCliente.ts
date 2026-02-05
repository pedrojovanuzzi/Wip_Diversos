import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("sis_prodcliente")
export class Sis_prodCliente {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", nullable: true })
  idprod!: number;

  @Column({ type: "int", nullable: true })
  qtdcli!: number;

  @Column({ type: "datetime", nullable: true })
  datains!: Date;

  @Column({ type: "varchar", length: 32, nullable: true })
  usuario!: string;

  @Column({ type: "varchar", length: 32, nullable: true })
  cliente!: string;
}
