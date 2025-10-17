import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { CiSettings } from "react-icons/ci";
import { useNavigate } from "react-router-dom";
import {
  ParametrosPixAutomaticoList,
  PixAuto,
  PixAutomaticoListPeople,
} from "../../types";

export const PixAutomatico = () => {
  const [remover, setRemover] = useState(false);
  const [parametros, setParametros] = useState<ParametrosPixAutomaticoList>();
  const [people, setPeople] = useState<PixAutomaticoListPeople>();
  const [date, setDate] = useState(() => {
    const hoje = new Date(); // pega a data atual
    hoje.setMonth(hoje.getMonth() + 1); // adiciona +1 mês
    return hoje.toLocaleDateString("pt-BR"); // formata como "DD/MM/AAAA"
  });
  const [pixAutoData, setPixAutoData] = useState<PixAuto>({
    contrato: "",
    cpf: "",
    nome: "",
    servico: "",
    data_inicial: date,
    periodicidade: "",
    valor: "",
    politica: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = user?.token;
  const permission = user?.permission;

  async function criarPixAutomatico(e: React.FormEvent) {
    try {
      console.log(pixAutoData);

      e.preventDefault();
      setError("");
      setLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/criarPixAutomatico`,
        { pixAutoData },
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
  async function getClientesPixAutomatico() {
    try {
      setLoading(true);
      setError("");
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/getPixAutomaticoClients`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(response.data);
      setPeople(response.data.cobsr);
      setParametros(response.data.parametros);
    } catch (error: any) {
      setError(error);
    } finally {
      setLoading(false);
    }
  }

  async function removerPixAutomatico() {}

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
    <div className="p-5 bg-slate-800 min-h-screen text-gray-200">
      <NavBar />

      <div className="bg-gray-100 text-gray-900 relative p-10 rounded-md flex flex-col gap-4 items-center">
        {permission! >= 5 && (
          <CiSettings
            onClick={() => {
              navigate("/Pix/automaticoAdmin");
            }}
            className="text-6xl sm:text-4xl sm:absolute sm:right-10 cursor-pointer"
          />
        )}

        <h1 className="text-2xl font-bold">Pix Automático</h1>
        <p className="text-gray-700">
          Gerencie e adicione clientes ao Pix Automático
        </p>

        {/* Toggle estilizado */}
        <label className="group relative inline-flex w-11 shrink-0 cursor-pointer rounded-full bg-gray-200 p-0.5 outline-offset-2 outline-indigo-600 ring-1 ring-inset ring-gray-900/5 transition-colors duration-200 ease-in-out has-[:checked]:bg-indigo-600 has-[:focus-visible]:outline has-[:focus-visible]:outline-2">
          <span className="relative size-5 rounded-full bg-white shadow-sm ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-[:checked]:translate-x-5">
            <span
              aria-hidden="true"
              className="absolute inset-0 flex size-full items-center justify-center opacity-100 transition-opacity duration-200 ease-in group-has-[:checked]:opacity-0 group-has-[:checked]:duration-100 group-has-[:checked]:ease-out"
            >
              {/* Ícone X (desativado) */}
              <svg
                fill="none"
                viewBox="0 0 12 12"
                className="size-3 text-red-400"
              >
                <path
                  d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span
              aria-hidden="true"
              className="absolute inset-0 flex size-full items-center justify-center opacity-0 transition-opacity duration-100 ease-out group-has-[:checked]:opacity-100 group-has-[:checked]:duration-200 group-has-[:checked]:ease-in"
            >
              {/* Ícone ✓ (ativado) */}
              <svg
                fill="currentColor"
                viewBox="0 0 12 12"
                className="size-3 text-indigo-600"
              >
                <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
              </svg>
            </span>
          </span>
          <input
            name="setting"
            type="checkbox"
            onChange={() => setRemover((prev) => !prev)}
            checked={!remover}
            aria-label="Use setting"
            className="absolute inset-0 appearance-none focus:outline-none"
          />
        </label>

        {/* Texto dinâmico */}
        <div className="mt-3 text-lg font-semibold">
          {remover ? (
            <span className="text-red-600">Remover cliente</span>
          ) : (
            <span className="text-green-600">Adicionar cliente</span>
          )}
        </div>
        {!remover && (
          <>
            <div>
              <form
                onSubmit={criarPixAutomatico}
                className="flex flex-col gap-3"
              >
                <div className="[&>*:nth-child(odd)]:bg-gray-100 flex flex-col gap-3">
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="Contrato"
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        contrato: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="CPF"
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        cpf: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="Nome Completo"
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        nome: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="Serviço"
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        servico: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="Data Inicial"
                    onChange={(e) => setDate(e.target.value)}
                    value={date}
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="Periodicidade"
                    value={"MENSAL"}
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        periodicidade: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="Valor"
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        valor: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="PoliticaRetentativa"
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        politica: e.target.value,
                      }))
                    }
                    value={"NAO_PERMITE"}
                  />
                </div>

                <button className="rounded-md ring-1 p-2 bg-slate-800 text-white w-full sm:w-60">
                  Enviar
                </button>
              </form>
            </div>
          </>
        )}
        {remover && <></>}
        {loading && <p>Carregando ....</p>}
        {error && <p>{error}</p>}
        <div>
          <h1 className="text-xl my-2">Buscar Clientes Já Cadastrados</h1>
          <button
            className="rounded-md ring-1 p-2 bg-cyan-800 text-white w-full sm:w-60"
            onClick={getClientesPixAutomatico}
          >
            Buscar
          </button>
          {people && (
            <div>
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="sm:flex sm:items-center">
                  <div className="sm:flex-auto">
                    <h1 className="text-base font-semibold text-gray-900">
                      Users
                    </h1>
                    <p className="mt-2 text-sm text-gray-700">
                      A list of all the users in your account including their
                      name, title, email and role.
                    </p>
                  </div>
                  <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none"></div>
                </div>
              </div>
              <div className="mt-8 flow-root overflow-hidden">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                  <table className="w-full text-left">
                    <thead className="bg-white">
                      <tr>
                        <th
                          scope="col"
                          className="relative isolate py-3.5 pr-3 text-left text-sm font-semibold text-gray-900"
                        >
                          Name
                          <div className="absolute inset-y-0 right-full -z-10 w-screen border-b border-b-gray-200" />
                          <div className="absolute inset-y-0 left-0 -z-10 w-screen border-b border-b-gray-200" />
                        </th>
                        <th
                          scope="col"
                          className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 sm:table-cell"
                        >
                          Title
                        </th>
                        <th
                          scope="col"
                          className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 md:table-cell"
                        >
                          Email
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Role
                        </th>
                        <th scope="col" className="py-3.5 pl-3">
                          <span className="sr-only">Edit</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {people?.recs?.length ? (
                        people.recs.map((person) => (
                          <tr key={person.idRec}>
                            <td className="relative py-4 pr-3 text-sm font-medium text-gray-900">
                              {person.vinculo.contrato}
                              <div className="absolute bottom-0 right-full h-px w-screen bg-gray-100" />
                              <div className="absolute bottom-0 left-0 h-px w-screen bg-gray-100" />
                            </td>

                            <td className="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">
                              {person.vinculo.devedor.nome}
                            </td>

                            <td className="px-3 py-4 text-sm text-gray-500">
                              R$ {parseFloat(person.valor.valorRec).toFixed(2)}
                            </td>

                            <td className="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">
                              {person.calendario.periodicidade}
                            </td>

                            <td className="px-3 py-4 text-sm text-gray-500">
                              {person.status}
                            </td>

                            <td className="py-4 pl-3 text-right text-sm font-medium">
                              <a
                                href="#"
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                Editar
                                <span className="sr-only">
                                  , {person.vinculo.devedor.nome}
                                </span>
                              </a>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center py-4 text-gray-500"
                          >
                            Nenhum registro encontrado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
