import { Entity, PrimaryGeneratedColumn, Column, Unique } from "typeorm";

@Entity("nfe")
@Unique(["nNF", "serie"])
export class NFE {
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

  @Column({ type: "varchar", length: 255, nullable: true })
  destinatario_nome!: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  destinatario_cpf_cnpj!: string;

  @Column({ type: "varchar", length: 50 })
  tipo_operacao!: string; // 'saida_comodato' | 'entrada_comodato'

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  valor_total!: number;

  @Column({ type: "int", nullable: true, default: 1 })
  tpAmb!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  pdf_path!: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  tipo!: string; // 'producao' | 'homologacao'
}
