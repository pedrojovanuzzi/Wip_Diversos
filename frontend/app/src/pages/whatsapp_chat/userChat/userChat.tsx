import axios from "axios";
import React, { useEffect, useState } from "react";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../../types";
import { useParams } from "react-router-dom";
import { NavBar } from "../../../components/navbar/NavBar";

interface User {
  nome: string;
  telefone: string;
}

interface Conversation {
  id: string;
  user: User;
  messages: Array<{
    conv_id: number;
    sender_id: number;
    content: string;
    timestamp: Date;
  }>;
}

export default function UserChat() {
  const [conversation, setConversation] = useState<Conversation>();
  const [user, setUser] = useState<User>();

  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;
  const meuId = 1;

  const { id } = useParams();

  async function fetchConversation(id: string | number) {
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/whatsapp/conversation",
        { id },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.status === 200) {
        const conv = response.data.conversations[0]; // ou buscar por id se preferir
        setConversation(conv);
        setUser(conv.user);
        console.log("Conversation:", conv);
        

        console.log(
          "Conversations fetched successfully:",
          response.data.conversations
        );
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
    }
  }

  async function postConversation() {
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/whatsapp/sendMsg",
        {
          user: {
            nome: "John Doe",
            telefone: "1234567890",
          },
          message: [
            {
              conv_id: 1,
              sender_id: 1,
              content: "Hello, this is a test message.",
              timestamp: new Date(),
            },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.status === 200) {
        setConversation(response.data.conversations);
        console.log("Message sent successfully:", response.data.conversations);
      }
    } catch (error) {
      console.log("Error sending message:", error);
    }
  }

  useEffect(() => {
    if (id) {
      fetchConversation(id);
    }
  }, [id]);

return (
  <div className="flex flex-col min-h-screen bg-gray-100">
    <NavBar />
    <div className="flex flex-col flex-1 p-4 space-y-2 overflow-y-auto">
      <header className="mb-4">
        <h2 className="text-2xl font-bold">{user?.nome || "Carregando..."}</h2>
        <p className="text-gray-600">{user?.telefone || "Carregando..."}</p>
      </header>

      <div className="flex flex-col space-y-2">
        {conversation?.messages
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) // garante ordem por data
          .map((msg, index) => {
            const isMe = msg.sender_id === meuId;
            return (
              <div
                key={index}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-lg shadow ${
                    isMe
                      ? "bg-blue-500 text-white rounded-br-none"
                      : "bg-green-200 text-gray-800 rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <span className="block text-xs text-right mt-1 opacity-60">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  </div>
);



}
