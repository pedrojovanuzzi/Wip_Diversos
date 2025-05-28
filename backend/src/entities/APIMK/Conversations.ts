import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('conversations')
export default class Conversations{
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'varchar', length: 255, nullable: false})
    nome!: string;
}