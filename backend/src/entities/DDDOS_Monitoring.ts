import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, } from "typeorm";

@Entity('dddos_monitoring')
export class DDDOS_MonitoringEntities{
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({type: 'varchar'})
    pppoe?: string;

    @Column({type: 'varchar'})
    ip?: string;

    @Column({type: 'varchar'})
    host?: string;

    @CreateDateColumn({type: 'datetime', name: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    timestamp?: Date;

}