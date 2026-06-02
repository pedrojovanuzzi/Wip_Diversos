import { useEffect, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import List from "./components/List";

interface Opnion {
  login: string;
  opnion: string;
  time: string;
}

export const Opnion = () => {
  const [feedback, setFeedback] = useState<Opnion[]>([]);
  const { user } = useAuth();
  const token = user?.token;

  function convertToBrasiliaTime(utcTime: string) {
    const date = new Date(utcTime);
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
        },
      );
      if (response.ok) {
        const data = await response.json();
        setFeedback(data);
      }
    } catch (error) {
      console.error("Erro ao mostrar feedbacks:", error);
    }
  }

  useEffect(() => {
    getFeed();
  }, []);

  const people = (feedback || []).map((client) => ({
    login: client.login,
    opnion: client.opnion,
    time: convertToBrasiliaTime(client.time),
  }));

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <List people={people} />
    </div>
  );
};
