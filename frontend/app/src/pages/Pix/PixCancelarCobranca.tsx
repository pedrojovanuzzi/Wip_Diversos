import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";

export const PixCancelarCobranca = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [txid, setTxId] = useState("");
  const token = user?.token;

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

  async function cancelarCobranca() {
    try {
      setLoading(true);
      setError("");
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/cancelarCobranca`,
        { txid },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(response.data);
    } catch (error: any) {
      console.log(error);
      const msg = extractErrorMessage(error);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col">
        <NavBar></NavBar>
        <h1 className="text-2xl my-2 font-bold">Cancelar Cobrança</h1>
        <p>TxId:</p>
        <input
          type="text"
          placeholder="25df0dfec3464a4690e..."
          className="ring-1 rounded-sm p-2 w-1/4 self-center mt-2"
          onChange={(e) => (setTxId(e.target.value))}
        />
        <button
          onClick={cancelarCobranca}
          className=" sm:rounded-md ring-1 p-4 sm:p-2 self-center mt-4 bg-slate-800 text-white w-full sm:w-[30vw]"
        >
          Enviar
        </button>{" "}
        {loading && <p className="mt-2">Carregando ....</p>}
        {error && <p className="text-red-500 break-all self-center w-1/2 mt-2">Erro: {error}</p>}
      </div>
    </div>
  );
};
