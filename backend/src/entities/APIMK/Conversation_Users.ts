import { Entity, PrimaryGeneratedColumn, Column, PrimaryColumn } from 'typeorm';

@Entity('conversations_users')
export default class Mensagens {
    @PrimaryColumn()
    conv_id!: number;

    @PrimaryColumn()
    user_id!: number;
}