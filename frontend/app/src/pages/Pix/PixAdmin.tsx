import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

export const PixAdmin = () => {


const [urlWebhook, setUrlWebhook] = useState('');
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();
  const token = user?.token;

  async function criarWebhookPix(e: React.FormEvent) {
    try {
      e.preventDefault();
      setError("");
      setLoading(true);
      if(!urlWebhook){
        return;
      }
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/criarWebhookPix`,
        { urlWebhook },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(response.data);
    } catch (error: any) {
      const msg = extractErrorMessage(error.response.data);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }



  // 🔧 Função que converte qualquer tipo de erro em string segura
  function stringifySafe(x: any): string {
    if (typeof x === "string") return x;
    try {
      return JSON.stringify(x);
    } catch {
      return String(x);
    }
  }

  // 🔧 Função que captura qualquer tipo de erro (string, objeto, AxiosError, etc.)
  function extractErrorMessage(err: any): string {
    if (err && err.response) {
      const d = err.response.data;
      if (typeof d === "string") return d;
      if (d == null) return `HTTP ${err.response.status || ""}`;
      return stringifySafe(d);
    }
    if (err && err.request) {
      return "Falha de rede ou servidor indisponível.";
    }
    if (err instanceof Error && err.message) return err.message;
    return stringifySafe(err);
  }

  return (
    <div className="sm:p-5 bg-slate-800 min-h-screen text-gray-200">
      <NavBar />
      <div className="bg-gray-100 text-gray-900 p-10 rounded-md flex flex-col gap-4 items-center">
        <h1 className="text-2xl font-bold">Pix</h1>
        <p className="text-gray-700">
          Gerencie e adicione clientes ao Pix
        </p>
        {/* Texto dinâmico */}
        <div className="mt-3 text-lg font-semibold">

        </div>

            <div>
              <form
                onSubmit={(e) => (
                  criarWebhookPix(e)
                )}
                className="flex flex-col gap-3"
              >
                <div className="[&>*:nth-child(odd)]:bg-gray-100 flex flex-col gap-3">
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="Link Webhook"
                    onChange={(e) => 
                      (setUrlWebhook(e.target.value))
                    }
                  />
                </div>
                <button className="rounded-md ring-1 p-2 bg-slate-800 text-white w-full sm:w-60">
                  Enviar
                </button>
              </form>
            </div>
          
        {loading && <p>Carregando ....</p>}
        {error && <p>{error}</p>}
      </div>
    </div>
  );
};
