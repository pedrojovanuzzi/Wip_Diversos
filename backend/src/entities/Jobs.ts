import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("jobs")
export class Jobs {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255 })
  description!: string;

  @Column({ type: "varchar", length: 255 })
  status!: string;
}
