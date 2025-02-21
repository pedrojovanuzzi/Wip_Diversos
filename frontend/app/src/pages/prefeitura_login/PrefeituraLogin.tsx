import icon from "../../assets/icon.png";
import icon_prefeitura from "../../assets/Brasao_Arealva.jpg";
import { MdOutlineSignalWifi4BarLock } from "react-icons/md";
import axios from "axios";
import { useState } from "react";

export default function PrefeituraLogin() {
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
   try {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.forEach((value, key) => {
      console.log(key, value);
    });

    axios
      .post(`${process.env.REACT_APP_URL}/Prefeitura/Login`, {
        name: data.get("name"),
        email: data.get("email"),
        cpf: data.get("cpf"),
      })
      .then((response) => {
        console.log(response);
        setSucesso(response.data.sucesso);
        setError(null);
      })
      .catch((error) => {
        console.log(error);
        setError(error.response.data.error || String(error.message));
        setSucesso(null);
    });

    event.currentTarget.reset();
   } catch (error) {
    setError("Erro ao enviar os dados");
   }
  };

  return (
    <>
      <div className="flex min-h-full mt-5 flex-1 flex-row justify-center ">
        <div className="self-center">
          <img alt="Wip Telecom" src={icon} className="mx-auto h-28 w-auto" />
          <h2 className="mt-10 text-center text-2xl/9 font-bold tracking-tight font-Atkinson text-gray-900">
            Wip Telecom
          </h2>
        </div>
        <div className="self-center p-5 text-2xl text-indigo-600">
          <MdOutlineSignalWifi4BarLock />
        </div>
        <div className="self-center">
          <img
            alt="Wip Telecom"
            src={icon_prefeitura}
            className="mx-auto h-28 w-auto"
          />
          <h2 className="mt-10 text-center text-2xl/9 font-bold tracking-tight font-Atkinson text-gray-900">
            Prefeitura
          </h2>
        </div>
      </div>
      <div className="flex min-h-full flex-1 flex-row justify-center ">
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <form onSubmit={handleSubmit} method="POST" className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm/6 font-medium text-gray-900"
              >
                Digite seu Nome Completo <span className="text-red-500">*</span>
              </label>
              <div className="mt-2">
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-left text-sm/6 font-medium text-gray-900"
              >
                Digite seu Email
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="cpf"
                  className="block text-sm/6 font-medium text-gray-900"
                >
                  Digite seu CPF <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="mt-2">
                <input
                  id="cpf"
                  name="cpf"
                  type="text"
                  required
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                />
              </div>
              {error && <p className="text-red-500 mt-2">{error}</p>}
              {sucesso && <p className="text-green-500 mt-2">{sucesso}</p>}
            </div>

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Conectar
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
