import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id?: number

    @Column()
    login?: string

    @Column()
    password?: string
}