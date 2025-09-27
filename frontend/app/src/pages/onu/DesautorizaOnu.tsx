import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { WifiData } from "../../types";
import { useAuth } from "../../context/AuthContext";

export const DesautorizaOnu = () => {

  const { user } = useAuth();
  const token = user?.token;

  const [sn, setSn] = useState("");
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const [error, setError] = useState("");


  const saved = localStorage.getItem('sn');

  useState(() => {
    if(saved){
    const array = JSON.parse(saved) as string[];
    setSn(array.join(", "));
  }
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // evita reload da página

    try {
      setLoading(true);
      const response = await axios.post(
          `${process.env.REACT_APP_URL}/Onu/Desautorize`,
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
        setSucesso(response.data)
    } catch (error : any) {
      console.error(error);
      setError(error);
    }
    finally{
      setLoading(false);
    }
  }

  return (
    <div>
      <NavBar />
      <div className="flex justify-center">
        <div className="lg:w-1/4 my-5">
          <h2 className="text-2xl/7 my-5 font-bold text-gray-900 sm:text-3xl">
            Desautorizar Onu
          </h2>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Switch Bridge/Wifi */}
            


            {/* Campos comuns */}
            <label className="block text-sm font-medium text-gray-900">SN</label>
            <input
              value={sn}
              onChange={(e) => setSn(e.target.value)}
              placeholder={`FHTT0726a260`}
              required
              className="block w-full rounded-md border px-3 py-1.5"
            />


            <button
              type="submit"
              className="bg-red-600 text-white p-3 rounded-md"
            >
              Desautorizar
            </button>
            
          </form>
          {loading && <p className="mt-2">Carregando....</p>}
              {error && <p className="text-red-500 mt-2">Error: {error}</p>}
              {sucesso && <p className="text-green-500 mt-2">{sucesso}</p>}
        </div>
      </div>
    </div>
  );
};
