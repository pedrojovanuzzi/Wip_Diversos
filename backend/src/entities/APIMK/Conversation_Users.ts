import { Entity, PrimaryColumn } from 'typeorm';

@Entity('conversation_users') 
export default class ConversationsUsers { 

  @PrimaryColumn({ type: 'int', name: 'conv_id' })
  conv_id!: number;                                

  @PrimaryColumn({ type: 'int', name: 'user_id' })
  user_id!: number;                                
}
