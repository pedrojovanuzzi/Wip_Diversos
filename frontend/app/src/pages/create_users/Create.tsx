import axios from "axios";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { NavBar } from "../../components/navbar/NavBar";
import { ErrorArray } from "../../types";
import {
  FaUser,
  FaLock,
  FaShieldAlt,
  FaHashtag,
  FaCheckCircle,
  FaExclamationCircle,
  FaSearch,
  FaUsers,
} from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { BsArrowRepeat } from "react-icons/bs";

interface Usuario {
  id: number;
  login: string;
  permission: number;
}

const erroSimples = (msg: string): ErrorArray => ({
  msg,
  type: "",
  value: "",
  path: "",
  location: "",
});

const corPermissao = (p: number) =>
  p >= 5
    ? "bg-purple-100 text-purple-800"
    : p >= 2
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-700";

export const Create = () => {
  const [id, setId] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [permission, setPermission] = useState("");
  const [error, setError] = useState<undefined | ErrorArray[]>([]);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [proximoId, setProximoId] = useState<number | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [destaque, setDestaque] = useState<number | null>(null);

  const { user } = useAuth();
  const token = user?.token;

  const carregarUsuarios = useCallback(
    async (preencherId: boolean) => {
      setCarregandoLista(true);
      try {
        const res = await axios.get(`${process.env.REACT_APP_URL}/auth/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsuarios(res.data.usuarios);
        setProximoId(res.data.proximoId);
        if (preencherId) setId(String(res.data.proximoId));
      } catch (e) {
        console.log(e);
        setError([erroSimples("Não foi possível carregar a lista de usuários.")]);
      } finally {
        setCarregandoLista(false);
      }
    },
    [token],
  );

  useEffect(() => {
    carregarUsuarios(true);
  }, [carregarUsuarios]);

  // Avisos enquanto digita, antes de enviar.
  const donoDoId = useMemo(
    () => usuarios.find((u) => String(u.id) === id.trim()),
    [usuarios, id],
  );
  const donoDoLogin = useMemo(
    () =>
      usuarios.find(
        (u) => u.login.toLowerCase() === login.trim().toLowerCase(),
      ),
    [usuarios, login],
  );

  const filtrados = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return usuarios;
    return usuarios.filter(
      (u) => u.login.toLowerCase().includes(t) || String(u.id) === t,
    );
  }, [usuarios, filtro]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError([]);
    setSucesso(null);

    if (donoDoId) {
      setError([erroSimples(`O ID ${id} já pertence ao usuário "${donoDoId.login}".`)]);
      return;
    }
    if (donoDoLogin) {
      setError([erroSimples(`O login "${login}" já existe (ID ${donoDoLogin.id}).`)]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/auth/create`,
        { id, login, password, permission },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSucesso(`Usuário "${login}" criado com o ID ${response.data.id}.`);
      setDestaque(Number(response.data.id));
      setLogin("");
      setPassword("");
      setPermission("");
      await carregarUsuarios(true);
    } catch (error: any) {
      if (error.response && error.response.data && error.response.data.errors) {
        setError(error.response.data.errors);
      } else {
        setError([erroSimples("Erro desconhecido ao criar usuário.")]);
      }
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const input =
    "pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2.5 border";

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          {/* Formulário */}
          <div className="h-fit overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="bg-blue-600 p-6 text-center">
              <h1 className="text-2xl font-bold text-white">
                Criar Novo Usuário
              </h1>
              <p className="mt-1 text-sm text-blue-100">
                Adicione um novo colaborador ao sistema
              </p>
            </div>

            <form onSubmit={createUser} className="space-y-6 p-8">
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">ID</label>
                    {proximoId !== null && id !== String(proximoId) && (
                      <button
                        type="button"
                        onClick={() => setId(String(proximoId))}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Usar próximo livre ({proximoId})
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <FaHashtag className="text-gray-400" />
                    </div>
                    <input
                      type="number"
                      min="1"
                      className={`${input} ${donoDoId ? "border-red-400" : ""}`}
                      placeholder="Em branco: o banco numera"
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                    />
                  </div>
                  {donoDoId ? (
                    <p className="mt-1 text-xs text-red-600">
                      Já pertence a "{donoDoId.login}".
                    </p>
                  ) : (
                    proximoId !== null && (
                      <p className="mt-1 text-xs text-gray-500">
                        Próximo ID livre: {proximoId}
                      </p>
                    )
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Login
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <FaUser className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      className={`${input} ${donoDoLogin ? "border-red-400" : ""}`}
                      placeholder="Ex: joao.silva"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                    />
                  </div>
                  {donoDoLogin && (
                    <p className="mt-1 text-xs text-red-600">
                      Login já usado pelo ID {donoDoLogin.id}.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Senha
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <FaLock className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      minLength={6}
                      className={input}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nível de Permissão (1-5)
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <FaShieldAlt className="text-gray-400" />
                    </div>
                    <input
                      type="number"
                      required
                      min="1"
                      max="5"
                      className={input}
                      placeholder="Ex: 2 (5 = administrador)"
                      value={permission}
                      onChange={(e) => setPermission(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !!donoDoId || !!donoDoLogin}
                className="flex w-full justify-center rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <AiOutlineLoading3Quarters className="animate-spin text-xl" />
                ) : (
                  "Cadastrar Usuário"
                )}
              </button>

              {sucesso && (
                <div className="flex items-start rounded-md border-l-4 border-green-500 bg-green-50 p-4">
                  <FaCheckCircle className="mr-3 mt-0.5 flex-shrink-0 text-green-500" />
                  <p className="text-sm font-medium text-green-700">{sucesso}</p>
                </div>
              )}

              {error && error.length > 0 && (
                <div className="space-y-2 rounded-md border-l-4 border-red-500 bg-red-50 p-4">
                  {error.map((err, index) => (
                    <div key={index} className="flex items-start">
                      <FaExclamationCircle className="mr-3 mt-0.5 flex-shrink-0 text-red-500" />
                      <p className="text-sm font-medium text-red-700">{err.msg}</p>
                    </div>
                  ))}
                </div>
              )}
            </form>
          </div>

          {/* Usuários já cadastrados */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
                <FaUsers className="text-blue-600" />
                Usuários cadastrados
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                  {usuarios.length}
                </span>
              </h2>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <div className="relative flex-1 sm:w-56 sm:flex-none">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <FaSearch className="text-gray-400" />
                  </div>
                  <input
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    placeholder="Buscar login ou ID"
                    className="block w-full rounded-lg border border-gray-300 p-2 pl-9 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => carregarUsuarios(false)}
                  disabled={carregandoLista}
                  title="Atualizar lista"
                  className="rounded-lg border border-gray-300 p-2.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  {carregandoLista ? (
                    <AiOutlineLoading3Quarters className="animate-spin" />
                  ) : (
                    <BsArrowRepeat />
                  )}
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="w-20 px-4 py-2">ID</th>
                    <th className="px-4 py-2">Login</th>
                    <th className="w-28 px-4 py-2">Permissão</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((u) => (
                    <tr
                      key={u.id}
                      className={`border-t ${
                        u.id === destaque
                          ? "bg-green-50"
                          : String(u.id) === id.trim()
                            ? "bg-red-50"
                            : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-4 py-2 font-mono font-semibold text-gray-800">
                        {u.id}
                      </td>
                      <td className="px-4 py-2">{u.login}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${corPermissao(
                            u.permission,
                          )}`}
                        >
                          {u.permission}
                          {u.permission >= 5 ? " · admin" : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!filtrados.length && !carregandoLista && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
