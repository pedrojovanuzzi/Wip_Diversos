import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { CiSettings } from "react-icons/ci";
import { useNavigate } from "react-router-dom";

export const PixAutomatico = () => {
  interface PixAuto {
    contrato: string;
    cpf: string;
    nome: string;
    servico: string;
    data_inicial: string;
    periodicidade: string;
    valor: string;
    politica: string;
  }

  const [remover, setRemover] = useState(false);
  const [date, setDate] = useState(new Date().toLocaleDateString("pt-BR"));
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
  async function getClientesPixAutomatico() {}
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
        {permission! >= 5 && <CiSettings onClick={() => {navigate('/Pix/automaticoAdmin')}} className="text-6xl sm:text-4xl sm:absolute sm:right-10 cursor-pointer"/>}

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
                        politica: e.target.value,
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
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        data_inicial: e.target.value,
                      }))
                    }
                    value={date}
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="Periodicidade"
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
      </div>
    </div>
  );
};
