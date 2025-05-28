import { Request, Response } from 'express';
import API_MK from '../database/API_MK';
import Mensagens from '../entities/APIMK/Mensagens';
import Conversations from '../entities/APIMK/Conversations';
import Conversation_Users from '../entities/APIMK/Conversation_Users';
import PeopleConversations from '../entities/APIMK/People_Conversations';
class WhatsappController {
  constructor() {
    // Initialize any necessary properties or services here
  }

  async receiveUsers(req: Request , res : Response){
    try {
        const selectConversations = API_MK.getRepository(Conversations);
        const conversations = await selectConversations.find({
            select: ['nome'],
            order: { id: 'ASC' },
        });

        const selectConversationUsers = API_MK.getRepository(Conversation_Users);
        const conversationUsers = await selectConversationUsers.find({
            select: ['conv_id', 'user_id'],
            order: { conv_id: 'ASC', user_id: 'ASC' },
        });

        const selectPeopleConversations = API_MK.getRepository(PeopleConversations);
        const peopleConversations = await selectPeopleConversations.find({
            select: ['nome', 'telefone'],
            order: { id: 'ASC'},
        });

        const selectMensagens = API_MK.getRepository(Mensagens);
        const mensagens = await selectMensagens.find({
            select: ['conv_id', 'sender_id', 'content'],
            order: { conv_id: 'ASC', sender_id: 'ASC' },
        });

        const conversationObject = {
            
        }

      
      res.status(200).json({ conversations: conversationObject });
    } catch (error) {
      console.error('Error receiving users:', error);
      res.status(500).json({ error: 'Failed to receive users' });
    }
  }

  // Example method to send a message
  async sendMessage(to: string, message: string) {
    // Logic to send a WhatsApp message
    console.log(`Sending message to ${to}: ${message}`);
    // Here you would typically call an external service or API
  }

  // Example method to receive messages
  async receiveMessage() {
    // Logic to handle incoming messages
    console.log('Receiving messages...');
    // Here you would typically listen for incoming messages from an API or webhook
  }
}