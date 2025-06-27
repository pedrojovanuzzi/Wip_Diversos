import icon from "../../assets/icon.png";
import icon_prefeitura from "../../assets/Brasao_Arealva.jpg";
import { MdOutlineSignalWifi4BarLock } from "react-icons/md";
import axios from "axios";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";


export default function PrefeituraLogin() {
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [dadosHotspot, setDadosHotspot] = useState<any>(null);
  const [loginAutorizado, setLoginAutorizado] = useState<boolean>(false);
  const [generatedOtp, setGeneratedOtp] = useState<string>(""); // Código OTP gerado automaticamente
  const [celular, setCelular] = useState<string>("");

  useEffect(() => {
    const mac = searchParams.get("mac");
    const ip = searchParams.get("ip");
    const username = searchParams.get("username") || "cliente";
    const password = "";
    const linkLogin = searchParams.get("link-login");
    const linkLoginOnly = searchParams.get("link-login-only");
    const linkOrig = searchParams.get("link-orig");
    const errorMsg = searchParams.get("error");
  
    const dados = { mac, ip, username, password, linkLogin, linkLoginOnly, linkOrig, error: errorMsg, celular: celular };
    setDadosHotspot(dados);
    console.log("🔹 Dados do Hotspot:", dados);
  
    // const fetchData = async () => {
    //   try {
    //     console.log("Enviando dados para debug:", dados);
    //     const response = await axios.post(`${process.env.REACT_APP_URL}/Prefeitura/Debug`, { dados });
    //     console.log("Resposta do servidor:", response.data);
    //   } catch (error) {
    //     console.error("Erro ao enviar dados:", error);
    //   }
    // };
  
    // fetchData();
  }, [searchParams]); // Dependência correta
  

  useEffect(() => {
    console.log("🔹 Login autorizado:", loginAutorizado); 
    console.log("🔹 Dados do Hotspot:", dadosHotspot); 
  
    if (!loginAutorizado || !dadosHotspot.ip || !dadosHotspot.mac || !dadosHotspot.linkOrig) {
      return; // Se faltar alguma informação, não executa a requisição
    }


    //     const fetchDataDebug = async () => {
    //   try {
    //     console.log("Enviando dados para debug:", dadosHotspot);
    //     const response = await axios.post(`${process.env.REACT_APP_URL}/Prefeitura/Debug`, { dadosHotspot });
    //     console.log("Resposta do servidor:", response.data);
    //   } catch (error) {
    //     console.error("Erro ao enviar dados:", error);
    //   }
    // };
  
    // fetchDataDebug();
  
    const fetchData = async () => { 
      try {
        console.log("✅ Enviando dados para a API do backend...");       
  
        const response = await axios.post(`${process.env.REACT_APP_URL}/Prefeitura/redirect_2`, {
          username: dadosHotspot.username,
          password: dadosHotspot.password,
          celular: dadosHotspot.celular,
          mac: dadosHotspot.mac,
          ip: dadosHotspot.ip,
          linkOrig: dadosHotspot.linkOrig,
          error: dadosHotspot.error,
          linkLogin: dadosHotspot.linkLogin,
          linkLoginOnly: dadosHotspot.linkLoginOnly,
        });
  
        console.log("✅ Resposta da API:", response.data);
        
        if (response.data.redirectUrl) {
          window.location.href = response.data.redirectUrl; // 🔹 Redireciona para a URL retornada
        }
      } catch (error) {
        console.error("❌ Erro ao enviar para a API:", error);
      }
    };
  
    fetchData();
  }, [loginAutorizado, dadosHotspot]); // 🔹 Executa sempre que `loginAutorizado` ou `dadosHotspot` mudar
  


  useEffect(() => {
    const newOtp = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase(); // Exemplo: "A1B2C3D4"
    setGeneratedOtp(newOtp);
  }, []);

  
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    try {
      setCelular(data.get("celular") as string);
      const response = await axios.post(`${process.env.REACT_APP_URL}/Prefeitura/Login`, {
        name: data.get("name"),
        celular: data.get("celular"),
        cpf: data.get("cpf"),
        ip: dadosHotspot?.ip,
        mac: dadosHotspot?.mac,
        uuid: generatedOtp,
      });

      console.log("✅ Login aprovado:", response);
      setSucesso(response.data.sucesso);
      setError(null);

      const sendotp = await axios.post(`${process.env.REACT_APP_URL}/Prefeitura/SendOtp`, {
        celular: data.get("celular"),
        otp: generatedOtp,
        mac: dadosHotspot?.mac,
      });

      setLoginAutorizado(true); // 🔹 Ativar login no Hotspot após sucesso

      console.log("✅ OTP enviado:", sendotp);

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
                Nome Completo <span className="text-red-500">*</span>
              </label>
              <div className="mt-2">
                <input id="name" name="name" type="text" required autoComplete="name"
                  className="block w-full ring-1 ring-black rounded-md bg-white px-3 py-1.5 text-base text-gray-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="celular" className="block text-sm/6 font-medium text-gray-900">
                Celular <span className="text-red-500">*</span>
              </label>
              <div className="mt-2">
                <input id="celular" name="celular" type="text" autoComplete="celular" required
                  className="block w-full ring-1 ring-black rounded-md bg-white px-3 py-1.5 text-base text-gray-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="cpf" className="block text-sm/6 font-medium text-gray-900">
                CPF <span className="text-red-500">*</span>
              </label>
              <div className="mt-2">
                <input id="cpf" name="cpf" type="text" required
                  className="block w-full ring-1 ring-black rounded-md bg-white px-3 py-1.5 text-base text-gray-900"
                />
              </div>
            </div>
            {error && <p className="text-red-500 m-2">{error}</p>}
            {sucesso && <p className="text-green-500 m-2">{sucesso}</p>}

            <button type="submit"
              className="w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 mb-5 text-white shadow-sm">
              Conectar
            </button>
          </form>
        </div>
      </div>
      <div className="relative p-10 mt-10">
      <footer className="absolute mb-1 left-1/2 -translate-x-1/2 bottom-0 text-gray-400 text-sm">© 2025 Prefeitura de Arealva, Wip Telecom Multimia Eirelli, Pedro Artur Jovanuzzi.</footer>
      </div>
    </>
  );
}
