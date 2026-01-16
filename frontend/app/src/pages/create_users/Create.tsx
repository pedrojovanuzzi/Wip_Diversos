import axios from "axios";
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { NavBar } from "../../components/navbar/NavBar";
import { ErrorArray } from "../../types";
import {
  FaUser,
  FaLock,
  FaShieldAlt,
  FaCheckCircle,
  FaExclamationCircle,
} from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

export const Create = () => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [permission, setPermission] = useState("");
  const [error, setError] = useState<undefined | ErrorArray[]>([]);
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();
  const token = user?.token;

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError([]);
    setSucesso(false);
    setLoading(true);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/auth/create`,
        { login, password, permission },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSucesso(true);
      setLogin("");
      setPassword("");
      setPermission("");
      console.log(response.data);
    } catch (error: any) {
      if (error.response && error.response.data && error.response.data.errors) {
        setError(error.response.data.errors);
      } else {
        setError([
          {
            msg: "Erro desconhecido ao criar usuário.",
            type: "",
            value: "",
            path: "",
            location: "",
          },
        ]);
      }
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="bg-blue-600 p-6 text-center">
            <h1 className="text-2xl font-bold text-white">
              Criar Novo Usuário
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              Adicione um novo colaborador ao sistema
            </p>
          </div>

          <form onSubmit={createUser} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="relative">
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Login
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaUser className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2.5 border"
                    placeholder="Ex: admin"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                  />
                </div>
              </div>

              <div className="relative">
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaLock className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2.5 border"
                    placeholder="Ex: 123456"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="relative">
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Nível de Permissão (1-5)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaShieldAlt className="text-gray-400" />
                  </div>
                  <input
                    type="number"
                    required
                    min="1"
                    max="5"
                    className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2.5 border"
                    placeholder="Ex: 1"
                    value={permission}
                    onChange={(e) => setPermission(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 ${
                loading ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <AiOutlineLoading3Quarters className="animate-spin text-xl" />
              ) : (
                "Cadastrar Usuário"
              )}
            </button>

            {sucesso && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md flex items-start animate-fade-in">
                <FaCheckCircle className="text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                <p className="text-green-700 text-sm font-medium">
                  Usuário criado com sucesso!
                </p>
              </div>
            )}

            {error && error.length > 0 && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md space-y-2 animate-fade-in">
                {error.map((err, index) => (
                  <div key={index} className="flex items-start">
                    <FaExclamationCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                    <p className="text-red-700 text-sm font-medium">
                      {err.msg}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
};
