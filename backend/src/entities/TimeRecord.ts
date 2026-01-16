import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Employee } from "./Employee";

@Entity("time_records")
export class TimeRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", name: "employee_id" })
  employeeId!: number;

  @ManyToOne(() => Employee, { onDelete: "CASCADE" })
  @JoinColumn({ name: "employee_id" })
  employee!: Employee;

  @Column({ type: "timestamp" })
  timestamp!: Date;

  @Column({ type: "varchar", length: 50, nullable: true })
  type!: string; // 'entry', 'interval_start', 'interval_end', 'exit', etc.

  @Column({ type: "varchar", length: 255, nullable: true })
  location!: string; // JSON string or "lat,long"

  @Column({ type: "varchar", length: 255, nullable: true })
  photo_url!: string;

  @CreateDateColumn()
  created_at!: Date;
}
