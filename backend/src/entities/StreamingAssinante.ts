import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("streaming_assinantes")
export class StreamingAssinante {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 100 })
  login!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  email!: string;

  @Column({ type: "varchar", length: 30, nullable: true })
  phone!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  pacote!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  ticket!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  chave!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  assinante_id_integracao!: string;

  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  @Column({ type: "text", nullable: true })
  last_response!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
