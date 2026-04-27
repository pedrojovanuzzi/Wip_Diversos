"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { HiCog6Tooth } from "react-icons/hi2";
import NavBar from "@/components/NavBar";
import OnuList from "./components/OnuList";
import type { User } from "@/lib/auth";
import type { OnuData } from "@/lib/types";

export default function OnuHomeClient({ user }: { user: User }) {
  const token = user.token;
  const router = useRouter();

  const [onuOn, setOnuOn] = useState<OnuData[]>([]);
  const [localizarMac, setLocalizarMac] = useState(false);
  const [slot, setSlot] = useState("");
  const [pon, setPon] = useState("");
  const [sn, setSn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function resetState() {
    setOnuOn([]);
    setLoading(false);
    setError("");
  }

  async function verifyOnlineOnu() {
    resetState();
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/OnuShowOnline`,
        { slot, pon },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 },
      );
      setOnuOn(data);
    } catch (err: any) {
      setError(String(err?.response?.data ?? err));
    } finally {
      setLoading(false);
    }
  }

  async function querySn() {
    resetState();
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/querySn`,
        { sn },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 },
      );
      setOnuOn(data);
    } catch (err: any) {
      setError(String(err?.response?.data ?? err));
    } finally {
      setLoading(false);
    }
  }

  async function verifyWhitListOnu() {
    resetState();
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/OnuShowAuth`,
        {},
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 },
      );
      setOnuOn(data);
    } catch (err: any) {
      setError(String(err?.response?.data ?? err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <NavBar user={user} />
      <div className="flex flex-col sm:justify-around sm:flex-row">
        <button
          onClick={() => { setLocalizarMac(true); resetState(); }}
          className="p-3 bg-slate-800 hover:bg-slate-700 transition-all text-gray-200 text-nowrap w-full max-h-20 text-sm self-center"
        >
          Localizar Informações pelo SN
        </button>
        <button
          onClick={() => { setLocalizarMac(false); resetState(); }}
          className="p-3 bg-slate-800 hover:bg-slate-700 transition-all text-gray-200 text-nowrap w-full max-h-20 text-sm self-center"
        >
          Verificar Onu&apos;s / Autorizar
        </button>
      </div>

      {user.permission >= 5 && (
        <HiCog6Tooth
          onClick={() => router.push("/Onu/Settings")}
          className="text-5xl absolute right-10 cursor-pointer"
        />
      )}

      {!localizarMac && (
        <>
          <div className="flex justify-center flex-col">
            <div className="w-1/4 my-5 self-center">
              <label className="block text-sm/6 font-medium text-gray-900">Slot</label>
              <div className="mt-2">
                <input
                  onChange={(e) => setSlot(e.target.value)}
                  placeholder="11"
                  type="number"
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-indigo-600 sm:text-sm/6"
                />
              </div>
              <label className="block text-sm/6 font-medium text-gray-900">Pon</label>
              <div className="mt-2">
                <input
                  onChange={(e) => setPon(e.target.value)}
                  placeholder="04"
                  type="number"
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-indigo-600 sm:text-sm/6"
                />
              </div>
            </div>
            <pre><OnuList list={onuOn} /></pre>
            {loading && <p>Carregando...</p>}
            {error && <h3 className="text-red-500 text-2xl">Erro: {error}</h3>}
          </div>
          <div className="flex flex-col sm:flex sm:flex-row gap-2 sm:justify-evenly my-5 pt-10">
            <button
              className="p-3 bg-violet-600 text-gray-200 w-full max-w-72 sm:w-52 text-sm self-center"
              onClick={verifyWhitListOnu}
            >
              Verificar Onu&apos;s para Autorizar
            </button>
            <button
              className="p-3 bg-slate-600 text-gray-200 w-full max-w-72 sm:w-52 text-sm self-center"
              onClick={verifyOnlineOnu}
            >
              Verificar Onu&apos;s Online
            </button>
            <button
              className="p-3 bg-blue-600 text-gray-200 w-full max-w-72 sm:w-52 text-sm self-center"
              onClick={() => router.push("/Onu/AutorizarOnu")}
            >
              Autorizar Onu
            </button>
          </div>
        </>
      )}

      {localizarMac && (
        <div className="flex justify-center flex-col">
          <div className="w-1/4 my-5 self-center">
            <label className="block text-sm/6 font-medium text-gray-900">SN</label>
            <div className="mt-2">
              <input
                onChange={(e) => setSn(e.target.value)}
                placeholder="ITBS8bab7c72"
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-indigo-600 sm:text-sm/6"
              />
            </div>
          </div>
          <pre>
            <OnuList title="Informações da Onu" list={Array.isArray(onuOn) ? onuOn : [onuOn]} />
          </pre>
          {loading && <p className="my-5">Carregando...</p>}
          {error && <h3 className="text-red-500 my-5 text-2xl">Erro: {error}</h3>}
          <div className="flex flex-col justify-evenly gap-5 my-5 sm:flex-row">
            <button
              className="p-3 bg-stone-800 text-gray-200 w-full max-w-72 sm:w-40 text-sm self-center"
              onClick={querySn}
            >
              Buscar
            </button>
            <button
              className="p-3 bg-blue-600 text-gray-200 w-full max-w-72 sm:w-52 text-sm self-center"
              onClick={() => router.push("/Onu/AutorizarOnu")}
            >
              Autorizar Onu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
