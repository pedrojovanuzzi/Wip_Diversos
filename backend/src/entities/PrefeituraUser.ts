import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity('pref_user')
export class PrefeituraUser {
    @PrimaryGeneratedColumn()
    id?: number

    @Column()
    name?: string

    @Column({nullable: true})
    celular?: string
    
    @Column()
    cpf?: string

    @Column()
    ip?: string

    @Column()
    mac?: string

    @Column()
    uuid?: string

}