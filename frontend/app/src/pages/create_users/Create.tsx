import axios from "axios";
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { NavBar } from "../../components/navbar/NavBar";
import { ErrorArray } from "../../types";

export const Create = () => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [permission, setPermission] = useState("");
  const [error, setError] = useState<undefined | ErrorArray[]>([]);
  const [sucesso, setSucesso] = useState(false);

  const { user } = useAuth();
  const token = user?.token;

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError([]);
    setSucesso(false);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/auth/create`,
        { login, password, permission },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSucesso(true);
      console.log(response.data);
    } catch (error : any) {
      setError(error.response.data.errors);
      console.log(error.response.data.errors);
    }
  };

  
  

  return (
    <>
      <NavBar></NavBar>
      <div>
        <div className="mt-20 flex flex-col justify-center">
          <h1 className="text-xl">Criar Usuario</h1>
          <form className="p-5 w-1/2 self-center" onSubmit={createUser}>
            <label className="flex flex-col">
              Login
              <input
                className="border h-8 p-2 border-black rounded-sm"
                type="text"
                placeholder="admin"
                onChange={(e) => setLogin(e.target.value)}
              />
            </label>
            <label className="flex flex-col">
              Senha
              <input
                className="border h-8 p-2 border-black rounded-sm"
                type="text"
                placeholder="123"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <label className="flex flex-col">
              Permissão
              <input
                className="border h-8 p-2 border-black rounded-sm"
                type="number"
                placeholder="1 a 5"
                onChange={(e) => setPermission(e.target.value)}
              />
              <button className="bg-slate-500 text-gray-200 mt-2 h-12">Enviar</button>
              <div className="flex flex-col justify-center">
                {sucesso && <span className="bg-green-500 text-gray-200 mt-2 py-5">Usuario Criado</span>}
              {error && error.map((f) => (<><p className="text-red-500 my-2 font-bold">{f.msg}</p></>))}
              </div>
            </label>
          </form>
        </div>
      </div>
    </>
  );
};
