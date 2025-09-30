import axios from "axios";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { NavBar } from "../../components/navbar/NavBar";

import { OnuData } from "../../types";
import OnuList from "./components/OnuList";

export const OnuSettings = () => {
  const { user } = useAuth();
  const token = user?.token;
  const [loading, setLoading] = useState(false);
  const [loadingHigh, setLoadingHigh] = useState(false);
  const [onu, setOnu] = useState<OnuData[] | []>([]);
  const [timeLeft, setTimeLeft] = useState(90);

  const destravarOnu = async () => {
    try {
      setLoadingHigh(true);
      setTimeLeft(90);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/Destravar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(response.data);

      setOnu(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingHigh(false);
    }
  };

  useEffect(() => {
    if (timeLeft <= 0) return; // para se já acabou
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval); // limpa o intervalo
  }, [timeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div>
      <NavBar></NavBar>
      <h1 className="text-2xl mt-5">Configurações Avançadas</h1>
      <div className="flex justify-center m-5 flex-col">
        {loadingHigh && (
          <>
            <h1>
              Carregando, Tempo Estimado: {minutes}:
              {seconds.toString().padStart(2, "0")}
            </h1>
          </>
        )}

        <button
          onClick={destravarOnu}
          className="p-3 bg-violet-600 text-gray-200 w-full max-w-72 sm:w-52 text-sm self-center"
        >
          Destravar Todas as Onu's
        </button>
      </div>
      {onu && (
        <>
          <pre>
            Onu's Afetadas
            <h1>Total de Onu's {onu.length}</h1>
            <OnuList
              title="Informações da Onu"
              list={Array.isArray(onu) ? onu : [onu]}
            ></OnuList>
          </pre>
        </>
      )}
    </div>
  );
};
