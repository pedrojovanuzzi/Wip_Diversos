import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../../types";
import { useParams } from "react-router-dom";
import { NavBar } from "../../../components/navbar/NavBar";
import { IoSendOutline } from "react-icons/io5";
import { subHours } from "date-fns";

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
  const [idUser, setIdUser] = useState<string | number | null>(null);
  const [text, setText] = useState<string>("");

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
        setIdUser(conv.user.id);

        console.log("Conversation:", conv);
        conv.messages = conv.messages.map((m: any) => ({
          ...m,
          timestamp: subHours(new Date(m.timestamp), 3),
        }));
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
    }
  }

  async function postConversation() {
    const messageContent = text.trim();

    if (!messageContent || !conversation) return;

    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/whatsapp/sendMsg",
        {
          user: {
            id: meuId,
          },
          message: {
            conv_id: conversation.id,
            sender_id: meuId,
            content: messageContent,
            timestamp: new Date(),
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 200) {
        // Atualiza a conversa com a nova resposta
        const conv = response.data.message;
        fetchConversation(conversation.id);
        setText(""); // limpa o input
        console.log("Message sent successfully:", conv);
      }
    } catch (error) {
      console.log("Error sending message:", error);
    }
  }

  useEffect(() => {
    if (!id) return;

    fetchConversation(id);

    const interval = setInterval(() => {
      fetchConversation(id);
    }, 1000);

    return () => clearInterval(interval);
  }, [id]);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-t from-blue-600 to-blue-900">
      <NavBar />
      <div className="flex flex-col flex-1 p-4 space-y-2 overflow-y-auto">
        <header className="mb-4">
          <h2 className="text-2xl text-gray-50 font-bold">
            {user?.nome || "Carregando..."}
          </h2>
          <p className="text-gray-200">{user?.telefone || "Carregando..."}</p>
        </header>

        <div className="flex flex-col space-y-2">
          {conversation?.messages
            .sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            ) // garante ordem por data
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
                      {new Date(msg.timestamp).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
      <div className="flex relative justify-center items-center">
        <input
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (text.trim()) {
                postConversation();
                setText("");
              }
            }
          }}
          value={text}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setText(e.target.value)
          }
          className="p-5 mb-3 pr-12 shadow-lg w-screen max-w-[70%] bg-green-200 rounded-xl placeholder:text-gray-700"
          placeholder="Digite uma Mensagem"
          type="text"
          name=""
          id=""
        />
        <IoSendOutline
          onClick={() => {
            if (text.trim()) {
              postConversation();
              setText("");
            }
          }}
          className="absolute right-[18%] top-1/2 -translate-y-4 text-xl text-gray-700 cursor-pointer"
        />
      </div>
    </div>
  );
}
