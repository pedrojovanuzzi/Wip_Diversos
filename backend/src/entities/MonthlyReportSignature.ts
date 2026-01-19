import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Employee } from "./Employee";

@Entity("monthly_report_signature")
export class MonthlyReportSignature {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", name: "employee_id" })
  employeeId!: number;

  @ManyToOne(() => Employee, { onDelete: "CASCADE" })
  @JoinColumn({ name: "employee_id" })
  employee!: Employee;

  @Column({ type: "varchar", length: 10 })
  month!: string; // "01", "02", etc.

  @Column({ type: "varchar", length: 10 })
  year!: string; // "2024", etc.

  @Column({ type: "longtext" })
  signature!: string; // Base64 image

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
