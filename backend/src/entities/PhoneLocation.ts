import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("phone_locations")
export class PhoneLocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, unique: true })
  device_id!: string;

  @Column({ type: "varchar", length: 255 })
  person_name!: string;

  @Column({ type: "double", nullable: true })
  latitude!: number | null;

  @Column({ type: "double", nullable: true })
  longitude!: number | null;

  @Column({ type: "float", nullable: true })
  accuracy!: number | null;

  @Column({ type: "float", nullable: true })
  battery!: number | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  device_token!: string | null;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @Column({ type: "timestamp", nullable: true })
  last_position_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
