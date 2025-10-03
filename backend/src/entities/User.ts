import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id?: number

    @Column({type: 'varchar'})
    login?: string

    @Column({type: 'varchar'})
    
    password?: string

    @Column({type: 'int', default: 1})
    permission?: number
}