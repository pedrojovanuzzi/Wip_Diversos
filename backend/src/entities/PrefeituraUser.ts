import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity('pref_user')
export class PrefeituraUser {
    @PrimaryGeneratedColumn()
    id?: number

    @Column()
    name?: string

    @Column({nullable: true})
    email?: string
    

    @Column()
    cpf?: string

}