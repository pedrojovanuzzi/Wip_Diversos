"use client";

import axios from "axios";
import React, { ReactElement, useEffect, useState } from "react";
import type { User } from "@/lib/auth";
import NavBar from "@/components/NavBar";

import { OnuData } from "@/lib/types";
import OnuList from "./components/OnuList";

/**
 * Origem: frontend/app/src/pages/onu/OnuSettings.tsx
 * As consultas vão à OLT ao clicar; não há o que buscar ao abrir.
 */
export function OnuSettings({ user }: { user: User }) {
  const token = user?.token;
  const [loading, setLoading] = useState(false);
  const [loadingHigh, setLoadingHigh] = useState(false);
  const [onu, setOnu] = useState<OnuData[] | []>([]);
  const [timeLeft, setTimeLeft] = useState(90);
  const [slot, setSlot] = useState<string | undefined>();
  const [pon, setPon] = useState<string | undefined>();

  const destravarOnu = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoadingHigh(true);
      setTimeLeft(90);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/Destravar`,
        {slot, pon},
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
      <NavBar user={user} />
      <h1 className="text-2xl mt-5">Configurações Avançadas</h1>
      <div className="flex justify-center m-5 ">
        
        <form className="flex flex-col gap-2">
          {loadingHigh && (
          <>
            <h1>
              Carregando, Tempo Estimado: {minutes}:
              {seconds.toString().padStart(2, "0")}
            </h1>
          </>
        )}
          Slot
          <label>
            <input className="border p-2 rounded-sm border-black"
              onChange={(e) => setSlot(e.target.value)}
              placeholder="11"
              type="number"
            />
          </label>
          Pon
          <label>
            <input className="border p-2 rounded-sm border-black"
              onChange={(e) => setPon(e.target.value)}
              placeholder="04"
              type="number"
            />
          </label>
          <button
            onClick={destravarOnu}
            className="p-3 bg-violet-600 text-gray-200 w-full max-w-72 sm:w-52 text-sm self-center"
          >
            Destravar Todas as Onu's
          </button>
        </form>
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
}
