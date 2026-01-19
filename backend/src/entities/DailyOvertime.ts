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

@Entity("daily_overtime")
export class DailyOvertime {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", name: "employee_id" })
  employeeId!: number;

  @ManyToOne(() => Employee, { onDelete: "CASCADE" })
  @JoinColumn({ name: "employee_id" })
  employee!: Employee;

  @Column({ type: "date" })
  date!: string; // YYYY-MM-DD

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  hours50!: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  hours100!: number;

  @Column({ type: "longtext", nullable: true })
  signature!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
