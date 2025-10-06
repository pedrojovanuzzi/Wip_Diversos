import React, { useEffect, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import img from "../../assets/users.png";
import { TiPencil } from "react-icons/ti";
import { useAuth } from "../../context/AuthContext";

interface User {
  nome: string;
  telefone: string;
}

interface Conversation {
  id: string;
  user: User;
}

export default function WhatsappChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  //ChatGpt
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [newName, setNewName] = useState("");
  const [recentConvBool, setRecentConvBool] = useState(true);

  const { user } = useAuth();
  const token = user?.token;

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

  async function fetchLastConversations() {
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/whatsapp/Lastconversation",
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.status === 200) {
        setConversations(response.data);
        console.log("Last Conversations:", response.data);
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
        console.log("Changed Name:", response.data.conversation);
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
    }
  }

  useEffect(() => {
    let interval: any;
    if (recentConvBool) {
      fetchLastConversations();
      interval = setInterval(() => {
        fetchLastConversations();
      }, 10000);
    } else if (!recentConvBool) {
      fetchConversations();
      interval = setInterval(() => {
        fetchConversations();
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [recentConvBool]);

  return (
    <div className="bg-cover bg-center h-screen shadow-lg bg-gradient-to-t from-blue-600 to-blue-900">
      <NavBar />
      <div className="grid bg-blue-500 shadow-lg  sm:w-2/12">
        {conversations.length > 0 && (
          <ul className="overflow-y-auto overflow-x-hidden scrollbar-none sm:scrollbar scrollbar-thumb-green-400 scrollbar-track-blue-900 flex flex-col max-h-[100vh]">
            {recentConvBool && (
              <button
                onClick={() => {
                  setRecentConvBool((prev) => !prev);
                }}
                className="p-4 bg-purple-900 w-full shadow-sm text-gray-200"
              >
                
                Conversas Recentes
              </button>
            )}
            {!recentConvBool && (
              <button
                onClick={() => {
                  setRecentConvBool((prev) => !prev);
                }}
                className="p-4 bg-emerald-500 w-full shadow-sm text-gray-200"
              >
                Todas as Conversas
              </button>
            )}
            {conversations.map((conv) => (
              <div className="relative">
                <a
                  href={"/Whatsapp/" + conv.id}
                  key={conv.id}
                  className="flex transition-all flex-col items-center justify-center text-white p-4 border-b border-gray-300 hover:bg-gray-500 cursor-pointer"
                >
                  <img src={img} className="w-20" alt="" />
                  <li>
                    <p>{conv.user.nome}</p>
                  </li>
                </a>
                <p
                  onClick={() => openModal(conv.id, conv.user.nome)}
                  className="absolute right-0 top-0"
                >
                  <TiPencil className="text-white border-gray-300 text-xl hover:bg-green-500 cursor-pointer rounded-sm" />
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
    </div>
  );
}
