import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("file_shares")
export class FileShare {
  @PrimaryGeneratedColumn()
  id!: number;

  // Token aleatório usado na URL pública de download
  @Column({ type: "varchar", length: 64, unique: true })
  token!: string;

  // Nome original do arquivo enviado (usado no download)
  @Column({ type: "varchar", length: 255 })
  originalName!: string;

  // Nome do arquivo salvo em disco
  @Column({ type: "varchar", length: 255 })
  storedName!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  mimeType!: string | null;

  @Column({ type: "bigint", default: 0 })
  size!: number;

  @Column({ type: "int", default: 0 })
  downloads!: number;

  @CreateDateColumn()
  created_at!: Date;
}
