import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState, WifiData } from "../../types";

export const AutorizarOnu = () => {
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;

  const [bridge, setBridge] = useState(true);
  const [variasOnus, setvariasOnus] = useState(true);
  const [sn, setSn] = useState("");
  const [vlan, setVlan] = useState("");
  const [cos, setCos] = useState("");
  const [wifiData, setWifiData] = useState<WifiData>({
    pppoe: "",
    senha_pppoe: "",
    canal: "",
    wifi_2ghz: "",
    wifi_5ghz: "",
    senha_wifi: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // evita reload da página

    try {
      if (bridge) {
        // modo Bridge
        const response = await axios.post(
          `${process.env.REACT_APP_URL}/Onu/OnuAuthenticationBridge`,
          { sn, vlan, cos },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 60000,
          }
        );
        console.log(response.data);
      } else {
        const response = await axios.post(
          `${process.env.REACT_APP_URL}/Onu/OnuAuthenticationWifi`,
          { sn, vlan, cos, wifiData },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 60000,
          }
        );
        console.log(response.data);
      }
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div>
      <NavBar />
      <div className="flex justify-center">
        <div className="lg:w-1/4 my-5">
          <h2 className="text-2xl/7 my-5 font-bold text-gray-900 sm:text-3xl">
            Autorizar Onu
          </h2>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Switch Bridge/Wifi */}
            <div className="flex items-center justify-between gap-3">
              <div className="group relative inline-flex w-11 shrink-0 rounded-full bg-gray-200 p-0.5 ring-1 ring-gray-900/5">
                <label className="group flex items-center gap-2">
                  <span className={`size-5 rounded-full bg-white shadow-sm ring-1 ring-gray-900/5 transition-transform ${!variasOnus ? 'group-has-[:checked]:translate-x-5' : ''}`} />
                <input
                  onClick={() => setBridge((prev) => !variasOnus ? !prev : prev)}
                  type="checkbox"
                  className="absolute inset-0 appearance-none cursor-pointer"
                />
                </label>
              </div>
              <span className="font-medium text-gray-900">
                {bridge ? "Bridge" : "Wifi"}
              </span>
              
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="group relative inline-flex w-11 shrink-0 rounded-full bg-gray-200 p-0.5 ring-1 ring-gray-900/5">
                <label className="group flex items-center gap-2">
                  <span className="size-5 rounded-full bg-white shadow-sm ring-1 ring-gray-900/5 transition-transform group-has-[:checked]:translate-x-5" />
                <input
                  onClick={() => (
                    setvariasOnus((prev) => !prev)
                  )}
                  type="checkbox"
                  className="absolute inset-0 appearance-none cursor-pointer"
                />
                </label>
              </div>
              <span className="font-medium text-gray-900">
                {variasOnus ?  "Varias" : "Uma Onu"}
              </span>
              
            </div>

            {/* Campos comuns */}
            <label className="block text-sm font-medium text-gray-900">SN</label>
            <input
              value={sn}
              onChange={(e) => setSn(e.target.value)}
              placeholder="FHTT0726a260"
              required
              className="block w-full rounded-md border px-3 py-1.5"
            />

            <label className="block text-sm font-medium text-gray-900">VLAN</label>
            <input
              value={vlan}
              onChange={(e) => setVlan(e.target.value)}
              placeholder="Ex: 1008"
              required
              className="block w-full rounded-md border px-3 py-1.5"
            />

            <label className="block text-sm font-medium text-gray-900">Cos</label>
            <input
              value={cos}
              onChange={(e) => setCos(e.target.value)}
              placeholder="Cos"
              required
              className="block w-full rounded-md border px-3 py-1.5"
            />

            {/* Se Wifi for selecionado */}
            {!bridge && (
              <>
                <label className="block text-sm font-medium text-gray-900">PPPOE</label>
                <input
                  value={wifiData.pppoe}
                  placeholder="PEDROJOVANUZZI"
                  onChange={(e) =>
                    setWifiData({ ...wifiData, pppoe: e.target.value })
                  }
                  required
                  className="block w-full rounded-md border px-3 py-1.5"
                />

                <label className="block text-sm font-medium text-gray-900">
                  Senha PPPOE
                </label>
                <input
                  type="text"
                  value={wifiData.senha_pppoe}
                  onChange={(e) =>
                    setWifiData({ ...wifiData, senha_pppoe: e.target.value })
                  }
                  placeholder="270604"
                  required
                  className="block w-full rounded-md border px-3 py-1.5"
                />

                <label className="block text-sm font-medium text-gray-900">Canal</label>
                <input
                placeholder="3"
                  value={wifiData.canal}
                  onChange={(e) =>
                    setWifiData({ ...wifiData, canal: e.target.value })
                  }
                  required
                  className="block w-full rounded-md border px-3 py-1.5"
                />

                <label className="block text-sm font-medium text-gray-900">
                  Nome da Rede Wifi 2.4
                </label>
                <input
                  value={wifiData.wifi_2ghz}
                  onChange={(e) =>
                    setWifiData({ ...wifiData, wifi_2ghz: e.target.value })
                  }
                  placeholder="Wifi_Test"
                  required
                  className="block w-full rounded-md border px-3 py-1.5"
                />

                <label className="block text-sm font-medium text-gray-900">
                  Nome da Rede Wifi 5.0
                </label>
                <input
                  value={wifiData.wifi_5ghz}
                  onChange={(e) =>
                    setWifiData({ ...wifiData, wifi_5ghz: e.target.value })
                  }
                  placeholder="Wifi_Test_5G"
                  required
                  className="block w-full rounded-md border px-3 py-1.5"
                />

                <label className="block text-sm font-medium text-gray-900">
                  Senha Wifi
                </label>
                <input
                  type="text"
                  value={wifiData.senha_wifi}
                  onChange={(e) =>
                    setWifiData({ ...wifiData, senha_wifi: e.target.value })
                  }
                  placeholder="fwgerwhge#"
                  minLength={7}
                  required
                  className="block w-full rounded-md border px-3 py-1.5"
                />
              </>
            )}

            <button
              type="submit"
              className="bg-indigo-600 text-white p-3 rounded-md"
            >
              Criar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
