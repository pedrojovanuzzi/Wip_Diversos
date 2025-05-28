import React, { useEffect, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import img from "../../assets/users.png";
import { TiPencil } from "react-icons/ti";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../types";

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

export default function WhatsappChat() {
  const [user, setUser] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);

  //ChatGpt
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [newName, setNewName] = useState("");

  //Redux
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;

  function openModal(id: string, currentName: string) {
    setSelectedId(id);
    setNewName(currentName);
    setShowModal(true);
  }

  async function fetchConversations() {
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/whatsapp/conversations",
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.status === 200) {
        setConversations(response.data.conversations);
        console.log(
          "Conversations fetched successfully:",
          response.data.conversations
        );
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
    }
  }

  async function changeName(id: number | string, nome: string) {
    try {
      const response = await axios.post(
        process.env.REACT_APP_URL + "/whatsapp/conversations",
        { id, nome },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.status === 200) {
        setConversations(response.data.conversation);
        console.log(
          "Changed Name:",
          response.data.conversation
        );
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
    }
  }

  useEffect(() => {
    fetchConversations();
  }, []);

  return (
    <>
      <NavBar />
      <div className="grid bg-slate-500 min-h-screen max-w-36 overflow-auto">
        {conversations.length > 0 && (
          <ul>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className="flex flex-col relative items-center justify-center text-white p-4 border-b border-gray-300 hover:bg-gray-600 cursor-pointer"
              >
                <img src={img} className="w-20" alt="" />
                <li>
                  <p>{conv.user.nome}</p>
                </li>
                <p
                  onClick={() => openModal(conv.id, conv.user.nome)}
                  className="p-2 absolute right-0"
                >
                  <TiPencil className="text-white border-gray-300 hover:bg-green-500 cursor-pointer rounded-sm" />
                </p>
              </div>
            ))}
          </ul>
        )}
        {conversations.length <= 0 && (
          <p className="text-center self-center justify-center justify-items-center text-white">
            Sem Clientes encontrados
          </p>
        )}
        {showModal && (
          <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-md w-80">
              <h2 className="text-lg font-semibold mb-4">Alterar nome</h2>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
                placeholder="Novo nome"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-gray-400 text-white px-4 py-2 rounded"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (selectedId) {
                      changeName(selectedId, newName);
                      setShowModal(false);
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
