import { Request, Response } from 'express';
import API_MK from '../database/API_MK';
import Mensagens from '../entities/APIMK/Mensagens';
import Conversations from '../entities/APIMK/Conversations';
import Conversation_Users from '../entities/APIMK/Conversation_Users';
import PeopleConversations from '../entities/APIMK/People_Conversations';
import { time } from 'console';
class WhatsappController {


  getConversations = async () =>{
    try {

        const selectConversations = API_MK.getRepository(Conversations);
        const conversations = await selectConversations.find({
            select: ['id','nome'],
            order: { id: 'ASC' },
        });

        const selectConversationUsers = API_MK.getRepository(Conversation_Users);
        const conversationUsers = await selectConversationUsers.find({
            select: ['conv_id', 'user_id'],
            order: { conv_id: 'ASC', user_id: 'ASC' },
        });

        const selectPeopleConversations = API_MK.getRepository(PeopleConversations);
        const peopleConversations = await selectPeopleConversations.find({
            select: ['id', 'nome', 'telefone'],
            order: { id: 'ASC'},
        });

        const selectMensagens = API_MK.getRepository(Mensagens);
        const mensagens = await selectMensagens.find({
            select: ['id', 'conv_id', 'sender_id', 'content'],
            order: { conv_id: 'ASC', sender_id: 'ASC' },
        });

        const userByConvId = new Map();
        conversationUsers.forEach((user) => {
            const users = peopleConversations.find(people => people.id === user.user_id);
            if (users) userByConvId.set(user.conv_id, { nome: users.nome, telefone: users.telefone });
        })

        const messagesByConvId = new Map();
        mensagens.forEach((message) => {
            if(!messagesByConvId.has(message.conv_id)){
                messagesByConvId.set(message.conv_id, [])
            }
            messagesByConvId.get(message.conv_id).push({
                conv_id: message.conv_id,
                sender_id: message.sender_id,
                content: message.content,
                timestamp: message.timestamp
            })
        })

        let conversationObjects = conversations.map(conv => ({
        id: conv.id,
        user: userByConvId.get(conv.id) || { nome: 'Desconhecido', telefone: '' },
        messages: messagesByConvId.get(conv.id) || []
        }));

        conversationObjects = conversationObjects.filter(conv => conv.id !== 1);


        return conversationObjects
    } catch (error) {
      console.error('Error getting conversations:', error);
    }
  }

  receiveUsers = async (req: Request , res : Response) => {
    try {
      const conversationObjects = await this.getConversations();
      res.status(200).json({ conversations: conversationObjects });
    } catch (error) {
      console.error('Error receiving users:', error);
      res.status(500).json({ error: 'Failed to receive users' });
    }
  }

  changeName = async (req: Request, res: Response) => {
    const { id, nome } = req.body;

    try {
      const selectConversations = API_MK.getRepository(Conversations);
      const conversation = await selectConversations.findOneBy({ id });

      const selectPeopleConversations = API_MK.getRepository(PeopleConversations);
      const peopleConversation = await selectPeopleConversations.findOneBy({ id });

        if (!peopleConversation) {
            res.status(404).json({ error: 'People conversation not found' });
            return;
        }

        if (!conversation) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }

      peopleConversation.nome = nome;
      await selectPeopleConversations.save(peopleConversation);

      conversation.nome = nome;
      await selectConversations.save(conversation);

      const conversations = await this.getConversations();

      res.status(200).json({ conversation: conversations });
    } catch (error) {
      console.error('Error changing conversation name:', error);
      res.status(500).json({ error: 'Failed to change conversation name' });
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

export default new WhatsappController();