import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("sis_produto")
export class SisProduto {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 48, nullable: true })
  uuid_produto!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  nome!: string;

  @Column({ type: "int", nullable: true })
  idforn!: number;

  @Column({ type: "longtext", nullable: true })
  descricao!: string;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  precoatual!: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  precovelho!: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  precocusto!: number;

  @Column({ type: "datetime", nullable: true })
  datacad!: Date;

  @Column({ type: "datetime", nullable: true })
  ultcompra!: Date;

  @Column({ type: "datetime", nullable: true })
  ultalteracao!: Date;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  peso!: number;

  @Column({ type: "enum", enum: ["sim", "nao"], nullable: true })
  ativo!: "sim" | "nao";

  @Column({ type: "varchar", length: 255, nullable: true })
  codbarras!: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  grupo!: string;

  @Column({ type: "varchar", length: 3, nullable: true })
  med!: string;

  @Column({ type: "longtext", nullable: true })
  aplicacao!: string;

  @Column({ type: "int", nullable: true })
  ipi!: number;

  @Column({ type: "int", nullable: true })
  icms!: number;

  @Column({ type: "varchar", length: 50, nullable: true })
  codigo!: string;
}
