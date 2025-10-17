import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { CiFilter, CiSettings } from "react-icons/ci";
import { useNavigate } from "react-router-dom";
import {
  FiltrosPix,
  ParametrosPixAutomaticoList,
  PixAuto,
  PixAutomaticoListPeople,
} from "../../types";

export const PixAutomatico = () => {
  const [remover, setRemover] = useState(false);
  const [parametros, setParametros] = useState<ParametrosPixAutomaticoList>();
  const [people, setPeople] = useState<PixAutomaticoListPeople>();
  const [status, setStatus] = useState<"CANCELADA">("CANCELADA");
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
    periodicidade: "MENSAL",
    valor: "",
    politica: "NAO_PERMITE",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [idRec, setIdRec] = useState("");
  const token = user?.token;
  const permission = user?.permission;
  const [filtros, setFiltros] = useState<FiltrosPix>({});

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
      setPeople(response.data);
      setParametros(response.data.parametros);
    } catch (error: any) {
      setError(error);
    } finally {
      setLoading(false);
    }
  }

  async function atualizarPixAutomatico(e: React.FormEvent) {
    try {
      e.preventDefault();
      setError("");
      setLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/atualizarPixAutomaticoClients`,
        { idRec, status },
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
            <>
              <span className="text-red-600">Desativar Cliente</span>
              <form className="flex flex-col" onSubmit={atualizarPixAutomatico}>
                <input
                  className="my-2 ring-1 rounded-sm p-2"
                  type="text"
                  placeholder="IdRec"
                  onChange={(e) => setIdRec(e.target.value)}
                />
                <select
                  className="my-2 ring-1 rounded-sm p-2"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "CANCELADA")}
                >
                  <option value="CANCELADA">CANCELADA</option>
                </select>

                <button className="rounded-md ring-1 p-2 bg-slate-800 text-white w-full sm:w-60">
                  Enviar
                </button>
              </form>
            </>
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
                    value={pixAutoData.contrato}
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
                    value={pixAutoData.cpf}
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
                    value={pixAutoData.nome}
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
                    value={pixAutoData.servico}
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
                    value={pixAutoData.periodicidade}
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
                    value={pixAutoData.valor}
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
                    value={pixAutoData.politica}
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        politica: e.target.value,
                      }))
                    }
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
        {error && <p className="text-red-500">{error}</p>}
        <div>
          <h1 className="text-xl my-2">Buscar Clientes Já Cadastrados</h1>
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center">
              <p>Filtros</p>
              <CiFilter />
            </div>
            <label htmlFor="Status">Status</label>
            <select className="ring-1 rounded-sm p-2" name="" id="">
              <option value="">ATIVO</option>
              <option value="">CANCELADO</option>
            </select>
            
            <button
              className="rounded-md ring-1 p-2 bg-cyan-800 text-white w-full sm:w-60"
              onClick={getClientesPixAutomatico}
            >
              Buscar
            </button>
          </div>
          {people && (
            <div className="flex flex-col justify-center">
              <div className="self-center w-1/2 sm:w-full">
              <div className="w-full overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left my-4">
                  <thead className="bg-white">
                    <tr>
                      <th className="py-3.5 pl-4 pr-3 text-sm font-semibold text-gray-900 sm:pl-6 whitespace-nowrap">
                        IdRec
                      </th>
                      <th className="py-3.5 px-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                        Contrato
                      </th>
                      <th className="hidden sm:table-cell py-3.5 px-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                        Devedor
                      </th>
                      <th className="py-3.5 px-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                        Valor
                      </th>
                      <th className="hidden md:table-cell py-3.5 px-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                        Periodicidade
                      </th>
                      <th className="py-3.5 px-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                        Status
                      </th>
                      <th className="py-3.5 pl-3 pr-4 sm:pr-6 text-right">
                        <span className="sr-only">Editar</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 bg-white">
                    {people?.recs && people.recs.length > 0 ? (
                      people.recs.map((person) => (
                        <tr
                          key={person.idRec}
                          className="hover:bg-gray-50 transition duration-150 ease-in-out"
                        >
                          <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 whitespace-nowrap">
                            {person.idRec || "-"}
                          </td>
                          <td className="px-3 py-4 text-sm text-gray-900 whitespace-nowrap">
                            {person.vinculo.contrato || "-"}
                          </td>
                          <td className="hidden sm:table-cell px-3 py-4 text-sm text-gray-600 whitespace-nowrap">
                            {person.vinculo.devedor?.nome || "Sem nome"}
                          </td>
                          <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap">
                            {person.valor?.valorRec
                              ? `R$ ${parseFloat(person.valor.valorRec).toFixed(
                                  2
                                )}`
                              : "R$ 0,00"}
                          </td>
                          <td className="hidden md:table-cell px-3 py-4 text-sm text-gray-600 whitespace-nowrap">
                            {person.calendario?.periodicidade || "-"}
                          </td>
                          <td className="px-3 py-4 text-sm whitespace-nowrap">
                            <span
                              className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                                person.status === "APROVADA"
                                  ? "bg-green-100 text-green-800"
                                  : person.status === "CRIADA"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {person.status || "-"}
                            </span>
                          </td>
                          <td className="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 whitespace-nowrap">
                            <button
                              onClick={() =>
                                console.log("Editar:", person.idRec)
                              }
                              className="text-indigo-600 hover:text-indigo-900 transition-colors"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center py-6 text-sm text-gray-500 italic"
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
