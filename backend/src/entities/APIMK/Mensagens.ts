import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('mensagens')
export default class Mensagens {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'int', nullable: false})
    conv_id!: number;

    @Column({type: 'int', nullable: false})
    sender_id!: number;

    @Column({type: 'varchar', length: 255, nullable: false})
    content!: string;

    @Column({type: 'timestamp'})
    timestamp!: Date;
}