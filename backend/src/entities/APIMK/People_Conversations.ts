import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('people_conversations')
export default class Mensagens {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'varchar', length: 255, nullable: false})
    nome!: string;

    @Column({type: 'varchar', length: 255, nullable: false})
    telefone!: string;
}