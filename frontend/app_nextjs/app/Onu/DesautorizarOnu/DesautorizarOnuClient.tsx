"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import NavBar from "@/components/NavBar";
import type { User } from "@/lib/auth";

export default function DesautorizarOnuClient({ user }: { user: User }) {
  const token = user.token;

  const [sn, setSn] = useState("");
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [error, setError] = useState("");

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
      const { data } = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/Desautorize`,
        { sn },
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
          <h2 className="text-2xl/7 my-5 font-bold text-gray-900 sm:text-3xl">Desautorizar Onu</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="block text-sm font-medium text-gray-900">SN</label>
            <input
              value={sn}
              onChange={(e) => setSn(e.target.value)}
              placeholder="FHTT0726a260"
              required
              className="block w-full rounded-md border px-3 py-1.5"
            />
            <button type="submit" className="bg-red-600 text-white p-3 rounded-md">Desautorizar</button>
          </form>
          {loading && <p className="mt-2">Carregando....</p>}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}
          {sucesso && <p className="text-green-500 mt-2">{sucesso}</p>}
        </div>
      </div>
    </div>
  );
}
