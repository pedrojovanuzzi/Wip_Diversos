import { NavBar } from "../../components/navbar/NavBar";
import List from "./components/List";
import { useEffect, useState } from "react";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../types";

export const Opnion = () => {
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const { user } = useTypedSelector((state) => state.auth);
  const [feedback, setFeedback] = useState<Opnion[]>([]);

  interface Opnion {
    login: string;
    opnion: string;
    time: string;
  }

  async function getFeed() {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL}/feedback/NoteFeedbackOpnion`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
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
  });

  const people = feedback?.map((client) => ({
    login: client.login,
    opnion: client.opnion,
    time: client.time,
  }));

  return (
    <div>
      <NavBar />
      <header className="p-5 sm:bg-slate-700 text-gray-200 text-xl font-Park"></header>
      <List people={people} />
    </div>
  );
};
