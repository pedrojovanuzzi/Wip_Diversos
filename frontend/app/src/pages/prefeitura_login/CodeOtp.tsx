import icon from "../../assets/icon.png";
import icon_prefeitura from "../../assets/Brasao_Arealva.jpg";
import { MdOutlineSignalWifi4BarLock } from "react-icons/md";
import axios from "axios";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";


export default function CodeOtp() {
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [redirecionado, setRedirecionado] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [dadosHotspot, setDadosHotspot] = useState<any>(null);
  const [loginAutorizado, setLoginAutorizado] = useState<boolean>(false);
  const [authCode, setAuthCode] = useState<string>(""); // Código OTP gerado automaticamente

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

  useEffect(() => {
    if (loginAutorizado && dadosHotspot) {
      console.log("✅ Enviando login automático para o Hotspot...");
      const form = document.createElement("form");
      form.method = "POST";
      form.action = dadosHotspot.linkLogin;
      form.style.display = "none";

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
      setAuthCode(data.get("celular") as string);
      const response = await axios.post(`${process.env.REACT_APP_URL}/Prefeitura/AuthCode`, {
        uuid: authCode,
      });

      console.log("✅ Login aprovado:", response);
      setSucesso(response.data.sucesso);
      setError(null);
      setRedirecionado("Você será conectado à internet agora!");

      setLoginAutorizado(true); // 🔹 Ativar login no Hotspot após sucesso

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
              <label htmlFor="otp" className="block text-sm/6 font-medium text-gray-900">
                Código de Verificação (OTP) <span className="text-red-500">*</span>
              </label>
              <div className="mt-2">
                <input id="otp" name="otp" type="text" required
                  value={authCode} onChange={(e) => setAuthCode(e.target.value)}
                  className="block w-full rounded-md ring-1 ring-black bg-white px-3 py-1.5 text-base text-gray-900"
                />
              </div>
            </div>
            {error && <p className="text-red-500 mt-2">{error}</p>}
            {sucesso && <p className="text-green-500 mt-2">{sucesso}</p>}
            {redirecionado && <p className="text-orange-700 mt-2">{redirecionado}</p>}

            <button type="submit"
              className="w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-white shadow-sm">
              Conectar
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
