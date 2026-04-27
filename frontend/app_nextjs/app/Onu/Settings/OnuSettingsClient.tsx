"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import NavBar from "@/components/NavBar";
import OnuList from "../components/OnuList";
import type { User } from "@/lib/auth";
import type { OnuData } from "@/lib/types";

export default function OnuSettingsClient({ user }: { user: User }) {
  const token = user.token;

  const [loading, setLoading] = useState(false);
  const [onu, setOnu] = useState<OnuData[]>([]);
  const [timeLeft, setTimeLeft] = useState(90);
  const [slot, setSlot] = useState("");
  const [pon, setPon] = useState("");

  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  async function destravarOnu(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeLeft(90);
    try {
      const { data } = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/Destravar`,
        { slot, pon },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setOnu(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <NavBar user={user} />
      <h1 className="text-2xl mt-5">Configurações Avançadas</h1>
      <div className="flex justify-center m-5">
        <form onSubmit={destravarOnu} className="flex flex-col gap-2">
          {loading && (
            <h1>Carregando, Tempo Estimado: {minutes}:{seconds.toString().padStart(2, "0")}</h1>
          )}
          Slot
          <input className="border p-2 rounded-sm border-black" onChange={(e) => setSlot(e.target.value)} placeholder="11" type="number" />
          Pon
          <input className="border p-2 rounded-sm border-black" onChange={(e) => setPon(e.target.value)} placeholder="04" type="number" />
          <button type="submit" className="p-3 bg-violet-600 text-gray-200 w-full max-w-72 sm:w-52 text-sm self-center">
            Destravar Todas as Onu&apos;s
          </button>
        </form>
      </div>
      {onu.length > 0 && (
        <pre>
          Onu&apos;s Afetadas
          <h1>Total de Onu&apos;s {onu.length}</h1>
          <OnuList title="Informações da Onu" list={Array.isArray(onu) ? onu : [onu]} />
        </pre>
      )}
    </div>
  );
}
