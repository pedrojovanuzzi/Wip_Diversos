import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("zapsign_templates")
export default class ZapSignTemplates {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255 })
  nome_servico!: string;

  @Column({ type: "longtext", nullable: true })
  base64_docx!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  token_id!: string;
}
