import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity('pref_user')
export class PrefeituraUser {
    @PrimaryGeneratedColumn()
    id?: number

    @Column({type: 'varchar'})
    name?: string

    @Column({type: 'varchar', nullable: true})
    celular?: string
    
    @Column({type: 'varchar'})
    cpf?: string
    

    @Column({type: 'varchar'})
    ip?: string

    @Column({type: 'varchar'})
    mac?: string

    @Column({type: 'varchar'})
    uuid?: string

}