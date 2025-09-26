import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import List from "./components/List";
import { useEffect, useState } from "react";

export const Opnion = () => {
  
  const [feedback, setFeedback] = useState<Opnion[]>([]);
  const { user } = useAuth();
  const token = user?.token;
  interface Opnion {
    login: string;
    opnion: string;
    time: string;
  }

  function convertToBrasiliaTime(utcTime: string) {
    const date = new Date(utcTime);
    date.setHours(date.getHours());
    return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }

  async function getFeed() {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL}/feedback/NoteFeedbackOpnion`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setFeedback(data);
      }
    } catch (error) {
      console.error("Erro ao Mostrar Feedbacks:", error);
    }
  }

  useEffect(() => {
    getFeed();
  }, []);

  const people = feedback?.map((client) => ({
    login: client.login,
    opnion: client.opnion,
    time: convertToBrasiliaTime(client.time),
  }));

  return (
    <div>
      <NavBar />
      <header className="p-5 sm:bg-slate-700 text-gray-200 text-xl font-Park"></header>
      <List people={people} />
    </div>
  );
};
