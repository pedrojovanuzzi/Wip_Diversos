"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import NavBar from "@/components/NavBar";
import type { User } from "@/lib/auth";
import type { WifiData } from "@/lib/types";

export default function AutorizarOnuClient({ user }: { user: User }) {
  const token = user.token;
  const router = useRouter();

  const [bridge, setBridge] = useState(true);
  const [variasOnus, setVariasOnus] = useState(true);
  const [sn, setSn] = useState("");
  const [vlan, setVlan] = useState("");
  const [cos, setCos] = useState("");
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [error, setError] = useState("");
  const [wifiData, setWifiData] = useState<WifiData>({
    pppoe: "", senha_pppoe: "", canal: "", wifi_2ghz: "", wifi_5ghz: "", senha_wifi: "",
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sn");
      if (saved) setSn((JSON.parse(saved) as string[]).join(", "));
    } catch {}
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSucesso("");
    setError("");
    try {
      const endpoint = bridge ? "OnuAuthenticationBridge" : "OnuAuthenticationWifi";
      const body = bridge ? { sn, vlan, cos } : { sn, vlan, cos, wifiData };
      const { data } = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/${endpoint}`,
        body,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 },
      );
      setSucesso(data);
    } catch (err: any) {
      setError(String(err?.response?.data ?? err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <NavBar user={user} />
      <div className="flex justify-center">
        <div className="lg:w-1/4 my-5">
          <h2 className="text-2xl/7 my-5 font-bold text-gray-900 sm:text-3xl">Autorizar Onu</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Toggle Bridge/Wifi */}
            <div className="flex items-center justify-between gap-3">
              <label className="relative inline-flex w-11 shrink-0 rounded-full bg-gray-200 p-0.5 ring-1 ring-gray-900/5 cursor-pointer has-[:checked]:bg-blue-300">
                <input
                  type="checkbox"
                  checked={bridge}
                  onChange={() => { setBridge((p) => !p); if (bridge) setVariasOnus(false); }}
                  className="peer absolute inset-0 appearance-none cursor-pointer"
                />
                <span className={`size-5 rounded-full bg-white shadow-sm ring-1 ring-gray-900/5 transition-transform ${bridge ? "translate-x-5" : ""}`} />
              </label>
              <span className="font-medium text-gray-900">{bridge ? "Bridge" : "Wifi"}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="relative inline-flex w-11 shrink-0 rounded-full has-[:checked]:bg-blue-700 bg-gray-200 p-0.5 ring-1 ring-gray-900/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={variasOnus}
                  disabled={!bridge}
                  onChange={() => setVariasOnus((p) => !p)}
                  className="peer absolute inset-0 appearance-none cursor-pointer disabled:cursor-not-allowed"
                />
                <span className={`size-5 rounded-full bg-white shadow-sm ring-1 ring-gray-900/5 transition-transform ${variasOnus ? "translate-x-5" : ""}`} />
              </label>
              <span className="font-medium text-gray-900">{variasOnus ? "Várias Onu's" : "Uma Onu"}</span>
            </div>

            <label className="block text-sm font-medium text-gray-900">SN</label>
            <input value={sn} onChange={(e) => setSn(e.target.value)} placeholder={variasOnus ? "FHTT0726a260, FHTTfe1aca8b" : "FHTT0726a260"} required className="block w-full rounded-md border px-3 py-1.5" />

            <label className="block text-sm font-medium text-gray-900">VLAN</label>
            <input value={vlan} onChange={(e) => setVlan(e.target.value)} placeholder="Ex: 1008" required className="block w-full rounded-md border px-3 py-1.5" />

            <label className="block text-sm font-medium text-gray-900">Cos</label>
            <input value={cos} onChange={(e) => setCos(e.target.value)} placeholder="Cos" required className="block w-full rounded-md border px-3 py-1.5" />

            {!bridge && (
              <>
                {[
                  { label: "PPPOE", key: "pppoe", ph: "PEDROJOVANUZZI" },
                  { label: "Senha PPPOE", key: "senha_pppoe", ph: "270604" },
                  { label: "Canal", key: "canal", ph: "3" },
                  { label: "Nome da Rede Wifi 2.4", key: "wifi_2ghz", ph: "Wifi_Test" },
                  { label: "Nome da Rede Wifi 5.0", key: "wifi_5ghz", ph: "Wifi_Test_5G" },
                  { label: "Senha Wifi", key: "senha_wifi", ph: "fwgerwhge#" },
                ].map(({ label, key, ph }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-900">{label}</label>
                    <input
                      value={wifiData[key as keyof WifiData]}
                      onChange={(e) => setWifiData({ ...wifiData, [key]: e.target.value })}
                      placeholder={ph}
                      required
                      className="block w-full rounded-md border px-3 py-1.5"
                    />
                  </div>
                ))}
              </>
            )}

            <button type="submit" className="bg-indigo-600 text-white p-3 rounded-md">Criar</button>
            <button type="button" onClick={() => router.push("/Onu/DesautorizarOnu")} className="bg-red-600 text-white p-3 rounded-md">Desautorizar</button>
          </form>

          {loading && <p className="mt-2">Carregando....</p>}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}
          {sucesso && <p className="text-green-500 mt-2">{sucesso}</p>}
        </div>
      </div>
    </div>
  );
}
