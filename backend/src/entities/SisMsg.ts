import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity('sis_msg')
export class SisMsg {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ type: 'varchar', length: 255 })
    chamado?: string;

    @Column({ type: 'longtext', nullable: true })
    msg?: string;

    @Column({ type: 'varchar', length: 255, default: 'provedor' })
    tipo?: string;

    @Column({ type: 'varchar', length: 255, default: '' })
    login?: string;

    @Column({ type: 'varchar', length: 255, default: '' })
    atendente?: string;

    @Column({ type: 'datetime', nullable: true })
    msg_data?: Date;
}
