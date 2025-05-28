import { Request, Response } from "express";
import API_MK from "../database/API_MK";
import Mensagens from "../entities/APIMK/Mensagens";
import Conversations from "../entities/APIMK/Conversations";
import Conversation_Users from "../entities/APIMK/Conversation_Users";
import PeopleConversations from "../entities/APIMK/People_Conversations";
import { time } from "console";
import { In } from "typeorm";
class WhatsappController {
  getConversations = async () => {
    try {
      const selectConversations = API_MK.getRepository(Conversations);
      const conversations = await selectConversations.find({
        select: ["id", "nome"],
        order: { id: "ASC" },
      });

      const selectConversationUsers = API_MK.getRepository(Conversation_Users);
      const conversationUsers = await selectConversationUsers.find({
        select: ["conv_id", "user_id"],
        order: { conv_id: "ASC", user_id: "ASC" },
      });

      const selectPeopleConversations =
        API_MK.getRepository(PeopleConversations);
      const peopleConversations = await selectPeopleConversations.find({
        select: ["id", "nome", "telefone"],
        order: { id: "ASC" },
      });

      const selectMensagens = API_MK.getRepository(Mensagens);
      const mensagens = await selectMensagens.find({
        select: ["id", "conv_id", "sender_id", "content"],
        order: { conv_id: "ASC", sender_id: "ASC" },
      });

      const userByConvId = new Map();
      conversationUsers.forEach((user) => {
        const users = peopleConversations.find(
          (people) => people.id === user.user_id
        );
        if (users)
          userByConvId.set(user.conv_id, {
            nome: users.nome,
            telefone: users.telefone,
          });
      });

      const messagesByConvId = new Map();
      mensagens.forEach((message) => {
        if (!messagesByConvId.has(message.conv_id)) {
          messagesByConvId.set(message.conv_id, []);
        }
        messagesByConvId.get(message.conv_id).push({
          conv_id: message.conv_id,
          sender_id: message.sender_id,
          content: message.content,
          timestamp: message.timestamp,
        });
      });

      let conversationObjects = conversations.map((conv) => ({
        id: conv.id,
        user: userByConvId.get(conv.id) || {
          nome: "Desconhecido",
          telefone: "",
        },
        messages: messagesByConvId.get(conv.id) || [],
      }));

      conversationObjects = conversationObjects.filter((conv) => conv.id !== 1);

      return conversationObjects;
    } catch (error) {
      console.error("Error getting conversations:", error);
    }
  };

  getConversation = async (userId: number) => {
    try {
      const selectConversations = API_MK.getRepository(Conversations);
      const selectConversationUsers = API_MK.getRepository(Conversation_Users);
      const selectPeopleConversations =
        API_MK.getRepository(PeopleConversations);
      const selectMensagens = API_MK.getRepository(Mensagens);

      // busca todos os relacionamento do usuário com conversas
      const conversationUsers = await selectConversationUsers.find({
        where: { user_id: userId },
        select: ["conv_id", "user_id"],
      });

      // pega os IDs de conversas associadas a esse user_id
      const convIds = conversationUsers.map((conv) => conv.conv_id);

      // busca as conversas desse usuário
      const conversations = await selectConversations.find({
        where: { id: In(convIds) },
        select: ["id", "nome"],
        order: { id: "ASC" },
      });

      // busca os dados do usuário
      const user = await selectPeopleConversations.findOneBy({ id: userId });

      // busca todas as mensagens associadas às conversas dele
      const mensagens = await selectMensagens.find({
        where: convIds.length ? { conv_id: In(convIds) } : undefined,
        select: ["id", "conv_id", "sender_id", "content", "timestamp"],
        order: { conv_id: "ASC", sender_id: "ASC" },
      });

      const messagesByConvId = new Map();
      mensagens.forEach((message) => {
        if (!messagesByConvId.has(message.conv_id)) {
          messagesByConvId.set(message.conv_id, []);
        }
        messagesByConvId.get(message.conv_id).push({
          conv_id: message.conv_id,
          sender_id: message.sender_id,
          content: message.content,
          timestamp: message.timestamp,
        });
      });

      const conversationObjects = conversations.map((conv) => ({
        id: conv.id,
        user: user
          ? { nome: user.nome, telefone: user.telefone }
          : { nome: "Desconhecido", telefone: "" },
        messages: messagesByConvId.get(conv.id) || [],
      }));

      return conversationObjects;
    } catch (error) {
      console.error("Error getting conversations by user ID:", error);
    }
  };

  receiveUsers = async (req: Request, res: Response) => {
    try {
      const conversationObjects = await this.getConversations();
      res.status(200).json({ conversations: conversationObjects });
    } catch (error) {
      console.error("Error receiving users:", error);
      res.status(500).json({ error: "Failed to receive users" });
    }
  };

  receiveUser = async (req: Request, res: Response) => {
    try {
      const conversationObjects = await this.getConversation(req.body.id);
      res.status(200).json({ conversations: conversationObjects });
    } catch (error) {
      console.error("Error receiving users:", error);
      res.status(500).json({ error: "Failed to receive users" });
    }
  };

  changeName = async (req: Request, res: Response) => {
    const { id, nome } = req.body;

    try {
      const selectConversations = API_MK.getRepository(Conversations);
      const conversation = await selectConversations.findOneBy({ id });

      const selectPeopleConversations =
        API_MK.getRepository(PeopleConversations);
      const peopleConversation = await selectPeopleConversations.findOneBy({
        id,
      });

      if (!peopleConversation) {
        res.status(404).json({ error: "People conversation not found" });
        return;
      }

      if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      peopleConversation.nome = nome;
      await selectPeopleConversations.save(peopleConversation);

      conversation.nome = nome;
      await selectConversations.save(conversation);

      const conversations = await this.getConversations();

      res.status(200).json({ conversation: conversations });
    } catch (error) {
      console.error("Error changing conversation name:", error);
      res.status(500).json({ error: "Failed to change conversation name" });
    }
  };

  async sendMessage(res: Response, req: Request) {
    const { user, message } = req.body;
    console.log(`Sending message to ${user}: ${message}`);
    return;
  }

  // Example method to receive messages
  async receiveMessage() {
    // Logic to handle incoming messages
    console.log("Receiving messages...");
    // Here you would typically listen for incoming messages from an API or webhook
  }
}

export default new WhatsappController();
