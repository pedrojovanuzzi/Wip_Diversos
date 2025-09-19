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
  const [slot, setSlot] = useState('');
  const [pon, setPon] = useState('');
  const [loading, setLoading] = useState(false);

  async function createOnu() {
    try {
        navigate('/Onu/AutorizarOnu');
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/OnuAuthentication`,
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
    } catch (error) {
      console.error(error);
    }
  }

  async function verifyOnlineOnu(slot: string, pon: string) {
    try {
        setOnuOn([]);
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
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div>
      <NavBar />
      {onuOn && (
        <div  className="flex justify-center flex-col">
          <div className="w-1/4 my-5 self-center">
            <label
              
              className="block text-sm/6 font-medium text-gray-900"
            >
              Slot
            </label>
            <div className="mt-2">
              <input
                onChange={(e) => (
                    setSlot(e.target.value)
                )}
                placeholder="11"
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              />
            </div>
            <label
              
              className="block text-sm/6 font-medium text-gray-900"
            >
              Pon
            </label>
            <div className="mt-2">
              <input
              onChange={(e) => (
                    setPon(e.target.value)
                )}
                placeholder="04"
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              />
            </div>
          </div>
          <pre>
            <OnuList list={onuOn}></OnuList>
          </pre>
          {loading && <p>Carregando...</p>}
        </div>
      )}
      <div className="flex sm:flex gap-2 sm:justify-evenly flex-col-reverse sm:flex-row-reverse my-5 pt-10">
        <button className="p-3 bg-blue-600 text-gray-200 w-40 text-sm self-center" onClick={createOnu}>Autorizar Onu</button>
        <button className="p-3 bg-slate-600 text-gray-200 w-40 text-sm self-center"
          onClick={() => {
            verifyOnlineOnu(slot, pon);
          }}
        >
          Verificar Onu's Online
        </button>
      </div>
    </div>
  );
};
