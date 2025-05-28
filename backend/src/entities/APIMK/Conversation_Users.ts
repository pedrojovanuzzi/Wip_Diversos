import { Entity, PrimaryColumn } from 'typeorm';

@Entity('conversation_users')
export default class ConversationsUsers {
    @PrimaryColumn()
    conv_id!: number;

    @PrimaryColumn()
    user_id!: number;
}