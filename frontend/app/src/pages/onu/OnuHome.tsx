import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { OnuData, RootState } from "../../types";
import OnuList from "./components/OnuList";
import { useNavigate } from "react-router-dom";
export const OnuHome = () => {
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;
  const navigate = useNavigate();

  const [onuOn, setOnuOn] = useState<OnuData[] | []>([]);
  const [localizarMac, setLocalizarMac] = useState(false);
  const [slot, setSlot] = useState("");
  const [pon, setPon] = useState("");
  const [sn, setSn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>("");

  async function createOnuRedirect() {
    try {
      navigate("/Onu/AutorizarOnu");
    } catch (error) {
      console.error(error);
    }
  }

  function resetState() {
    setOnuOn([]);
    setLoading(false);
    setError("");
  }

  async function verifyOnlineOnu(slot: string, pon: string) {
    try {
      resetState();
      setLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/OnuShowOnline`,
        { slot, pon },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );

      console.log(response.data);
      setLoading(false);
      setOnuOn(response.data);
    } catch (error: any) {
      setError(String(error?.response?.data));
      setLoading(false);
      console.error(error);
    }
  }

  async function querySn(sn : string) {
    try {
      resetState();
      setLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/querySn`,
        { sn },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );

      console.log(response.data);
      setLoading(false);
      setOnuOn(response.data);
    } catch (error: any) {
      setError(String(error?.response?.data));
      setLoading(false);
      console.error(error);
    }
  }

  async function verifyWhitListOnu() {
    try {
      resetState();
      setLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/OnuShowAuth`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );

      console.log(response.data);
      setLoading(false);
      setOnuOn(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div>
      <NavBar />
      <div className="flex  flex-col sm:justify-around sm:flex-row">
        <button
          onClick={() => {
            setLocalizarMac(true);
            resetState();
          }}
          className="p-3 bg-slate-800 hover:bg-slate-700 transition-all text-gray-200 text-nowrap w-full max-h-20  text-sm self-center"
        >
          Localizar Informações pelo SN
        </button>
        <button
          onClick={() => {
            setLocalizarMac(false);
            resetState();
          }}
          className="p-3 bg-slate-800 hover:bg-slate-700 transition-all text-gray-200 text-nowrap w-full max-h-20  text-sm self-center"
        >
          Verificar Onu's / Autorizar
        </button>
      </div>
      {!localizarMac && (
        <>
          {onuOn && (
            <div className="flex justify-center flex-col">
              <div className="w-1/4 my-5 self-center">
                <label className="block text-sm/6 font-medium text-gray-900">
                  Slot
                </label>
                <div className="mt-2">
                  <input
                    onChange={(e) => setSlot(e.target.value)}
                    placeholder="11"
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                  />
                </div>
                <label className="block text-sm/6 font-medium text-gray-900">
                  Pon
                </label>
                <div className="mt-2">
                  <input
                    onChange={(e) => setPon(e.target.value)}
                    placeholder="04"
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                  />
                </div>
              </div>
              <pre>
                <OnuList list={onuOn}></OnuList>
              </pre>
              {loading && <p>Carregando...</p>}
              {error && (
                <h3 className="text-red-500 text-2xl">Erro: {error}</h3>
              )}
            </div>
          )}
          <div className="flex flex-col sm:flex sm:flex-row gap-2 sm:justify-evenly my-5 pt-10">
            <button
              className="p-3 bg-violet-600 text-gray-200 w-full max-w-72 sm:w-52 text-sm self-center"
              onClick={() => {
                verifyWhitListOnu();
              }}
            >
              Verificar Onu's para Autorizar
            </button>
            <button
              className="p-3 bg-slate-600 text-gray-200 w-full max-w-72 sm:w-52 text-sm self-center"
              onClick={() => {
                verifyOnlineOnu(slot, pon);
              }}
            >
              Verificar Onu's Online
            </button>
            <button
              className="p-3 bg-blue-600 text-gray-200 w-full max-w-72 sm:w-52 text-sm self-center"
              onClick={createOnuRedirect}
            >
              Autorizar Onu
            </button>
          </div>
        </>
      )}
      {localizarMac && (
        <>
          {onuOn && (
            <div className="flex justify-center flex-col">
              <div className="w-1/4 my-5 self-center">
                <label className="block text-sm/6 font-medium text-gray-900">
                  SN
                </label>
                <div className="mt-2">
                  <input
                    onChange={(e) => setSn(e.target.value)}
                    placeholder="ITBS8bab7c72"
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                  />
                </div>
              </div>
              <pre>
                <OnuList title="Informações da Onu" list={Array.isArray(onuOn) ? onuOn : [onuOn]}></OnuList>
              </pre>
              {loading && <p className="my-5">Carregando...</p>}
              {error && (
                <h3 className="text-red-500 my-5 text-2xl">Erro: {error}</h3>
              )}
              <button
              className="p-3 py-5 bg-blue-600 text-gray-200 w-full max-w-72 sm:w-40 text-sm self-center"
              onClick={() => {
                querySn(sn);
              }}
            >
              Buscar
            </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
