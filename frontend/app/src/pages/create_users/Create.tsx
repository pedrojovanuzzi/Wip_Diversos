import axios from "axios";
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export const Create = () => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [permission, setPermission] = useState("");

  const { user } = useAuth();
  const token = user?.token;

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Auth/Create`,
        { login, password, permission },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(response.data);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <>
      <div>Criar Usuario</div>
      <form onSubmit={createUser}>
        <label>
          Login
          <input type="text" onChange={(e) => setLogin(e.target.value)} />
        </label>
        <label>
          Senha
          <input type="text" onChange={(e) => setPassword(e.target.value)} />
        </label>

        <label>
          Permissão
          <input type="text" onChange={(e) => setPermission(e.target.value)} />
        </label>
      </form>
    </>
  );
};
