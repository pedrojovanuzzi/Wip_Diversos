import { Request, Response } from "express";
import API_MK from "../database/API_MK";
import Mensagens from "../entities/APIMK/Mensagens";
import Conversations from "../entities/APIMK/Conversations";
import Conversation_Users from "../entities/APIMK/Conversation_Users";
import PeopleConversations from "../entities/APIMK/People_Conversations";
import { In } from "typeorm";
import axios from "axios";

const url = `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;
const urlMedia = `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/media`;
const token = process.env.CLOUD_API_ACCESS_TOKEN;

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

  getLastMessages = async (req: Request, res: Response) => {
    try {
       const lastMessagesSelect = API_MK.getRepository(Mensagens);
       const lastMessages = await lastMessagesSelect.find({order: {id: 'DESC'}, take: 30});

       console.log(lastMessages);

       const conversationsSelect = API_MK.getRepository(Conversations);
       const conversations = await Promise.all(lastMessages.filter((msg) => msg.sender_id !== 1).map((msg) => (conversationsSelect.findOne({where: {id: msg.sender_id}}))));

       console.log(conversations);
       
       

      

       res.status(200).json()

    } catch (error) {
      res.status(500).json(error);
    }
  }

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

  sendMessage = async (req: Request, res: Response) => {
    const { user, message } = req.body;

    if (!user || !message || !message.content) {
      res
        .status(400)
        .json({ message: "User and message content are required" });
      return;
    }

    const selectConversations = API_MK.getRepository(Conversations);
    const conversation = await selectConversations.findOneBy({
      id: message.conv_id,
    });

    if (!conversation) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    const selectMensagens = API_MK.getRepository(Mensagens);
    const newMessage = new Mensagens();
    newMessage.conv_id = message.conv_id;
    newMessage.sender_id = message.sender_id;
    newMessage.content = message.content;
    newMessage.timestamp = message.timestamp
      ? new Date(message.timestamp)
      : new Date(Date.now() - 3 * 60 * 60 * 1000);

    await selectMensagens.save(newMessage);

    const selectConversationUsers = API_MK.getRepository(Conversation_Users);
    const conversationUsers = await selectConversationUsers.find({
      where: { conv_id: message.conv_id },
      select: ["user_id"],
    });

    const userIds = conversationUsers.map((cu) => cu.user_id);
    const selectPeopleConversations = API_MK.getRepository(PeopleConversations);
    const peopleConversations = await selectPeopleConversations.find({
      where: { id: In(userIds) },
      select: ["id", "nome", "telefone"],
    });

    const recipient = peopleConversations.find(
      (pc) => pc.id !== message.sender_id
    );

    if (!recipient) {
      res.status(404).json({ message: "Recipient not found" });
      return;
    }

    const recipient_number = recipient.telefone.replace(/\D/g, ""); // Remove non-numeric characters
    if (!recipient_number) {
      res.status(400).json({ message: "Invalid recipient phone number" });
      return;
    }

    await this.MensagensComuns(recipient_number, message.content);

    res.status(200).json({ message: "Message sent successfully" });
  };

  MensagensComuns = async (recipient_number: string, msg: string) => {
    try {
      const response = await axios.post(
        url,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient_number,
          type: "text",
          text: {
            preview_url: false,
            body: msg,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Example method to receive messages
  async receiveMessage() {
    // Logic to handle incoming messages
    console.log("Receiving messages...");
    // Here you would typically listen for incoming messages from an API or webhook
  }
}

export default new WhatsappController();
