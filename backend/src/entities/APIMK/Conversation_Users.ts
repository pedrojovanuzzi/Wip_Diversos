import { Entity, PrimaryColumn } from 'typeorm';

@Entity('conversations_users')
export default class ConversationsUsers {
    @PrimaryColumn()
    conv_id!: number;

    @PrimaryColumn()
    user_id!: number;
}