import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("nfcom")
export class NFCom {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 20 })
  nNF!: string;

  @Column({ type: "varchar", length: 5 })
  serie!: string;

  @Column({ type: "varchar", length: 44, unique: true })
  chave!: string;

  @Column({ type: "longtext" })
  xml!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  protocolo!: string;

  @Column({ type: "varchar", length: 20, default: "autorizada" })
  status!: string;

  @Column({ type: "datetime" })
  data_emissao!: Date;

  @Column({ type: "int", nullable: true })
  cliente_id!: number;

  @Column({ type: "int", nullable: true })
  fatura_id!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  qrcodeLink!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  pppoe!: string;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  value!: number;

  @Column({ type: "int", nullable: true, default: 1 })
  tpAmb!: number;
}
