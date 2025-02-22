import icon from "../../assets/icon.png";
import icon_prefeitura from "../../assets/Brasao_Arealva.jpg";
import { MdOutlineSignalWifi4BarLock } from "react-icons/md";
import axios from "axios";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function PrefeituraLogin() {
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [redirecionado, setRedirecionado] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [dadosHotspot, setDadosHotspot] = useState<any>(null);
  const [loginAutorizado, setLoginAutorizado] = useState<boolean>(false);

  useEffect(() => {
    const mac = searchParams.get("mac");
    const ip = searchParams.get("ip");
    const username = searchParams.get("username") || "cliente"; // Usuário padrão
    const password = ""; // Senha vazia
    const linkLogin = searchParams.get("link-login");
    const linkOrig = searchParams.get("link-orig");
    const errorMsg = searchParams.get("error");

    if (mac && ip && username && linkLogin) {
      const dados = { mac, ip, username, password, linkLogin, linkOrig, error: errorMsg };
      setDadosHotspot(dados);
      console.log("🔹 Dados do Hotspot:", dados);
    }
  }, [searchParams]);

  // 🔹 Envia o login para o Hotspot somente quando `loginAutorizado` for true
  useEffect(() => {
    if (loginAutorizado && dadosHotspot) {
      console.log("✅ Enviando login automático para o Hotspot...");
      const form = document.createElement("form");
      form.method = "POST";
      form.action = dadosHotspot.linkLogin;
      form.style.display = "none"; // Formulário oculto

      // Criar campos ocultos
      function addHiddenField(name: string, value: string) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }

      addHiddenField("username", dadosHotspot.username);
      addHiddenField("password", dadosHotspot.password);
      addHiddenField("dst", dadosHotspot.linkOrig || "http://www.google.com");
      addHiddenField("popup", "true");

      document.body.appendChild(form);
      form.submit();
    }
  }, [loginAutorizado, dadosHotspot]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    try {
      const response = await axios.post(`${process.env.REACT_APP_URL}/Prefeitura/Login`, {
        name: data.get("name"),
        email: data.get("email"),
        cpf: data.get("cpf"),
        ip: dadosHotspot.ip,
      });

      console.log("✅ Login aprovado:", response);
      setSucesso(response.data.sucesso);
      setError(null);
      setRedirecionado("Você será conectado à internet agora!");

      // 🔹 Ativar login no Hotspot após sucesso
      setLoginAutorizado(true);
    } catch (error: any) {
      console.log("❌ Erro ao fazer login:", error);
      setError(error.response?.data?.error || "Erro ao fazer login");
      setSucesso(null);
      setLoginAutorizado(false);
    }
  };

  return (
    <>
      <div className="flex min-h-full mt-5 flex-1 flex-row justify-center">
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
          <img alt="Wip Telecom" src={icon_prefeitura} className="mx-auto h-28 w-auto" />
          <h2 className="mt-10 text-center text-2xl/9 font-bold tracking-tight font-Atkinson text-gray-900">
            Prefeitura
          </h2>
        </div>
      </div>
      <div className="flex min-h-full flex-1 flex-row justify-center">
        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <form onSubmit={handleSubmit} method="POST" className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm/6 font-medium text-gray-900">
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
              <label htmlFor="email" className="block text-left text-sm/6 font-medium text-gray-900">
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
                <label htmlFor="cpf" className="block text-sm/6 font-medium text-gray-900">
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
              {redirecionado && <p className="text-orange-700 mt-2">{redirecionado}</p>}
            </div>

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm hover:bg-indigo-500"
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
