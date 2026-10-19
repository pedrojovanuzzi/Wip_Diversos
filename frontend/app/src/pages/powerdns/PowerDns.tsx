import React, { useRef, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import SendPdf from "./components/SendPdf";
import ConfigDig from "./components/ConfigDig";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

export const PowerDns = () => {
  const { user } = useAuth();
  const token = user?.token;
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [dominioText, setDominioText] = useState("");
  const [fileMode, setFileMode] = useState<"inserir" | "remover">("inserir");
  const [dominioMode, setDominioMode] = useState<"inserir" | "remover">(
    "inserir",
  );
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [testeText, setTesteText] = useState("");
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{
    comando: string;
    executado_em: string;
    status: string;
    saida: string;
  } | null>(null);
  const [configAberta, setConfigAberta] = useState(false);

  async function handleFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    setMessage("");
    setMessageType("");

    const endpoint = fileMode === "inserir" ? "inserirPdf" : "removerPdf";

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/PowerDns/${endpoint}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          timeout: 60000,
        },
      );
      console.log("✅ Enviado:", response.data);
      setMessage(response.data.message);
      setMessageType("success");
    } catch (error: any) {
      console.error("❌ Erro:", error);
      setMessage(error.response?.data?.error || "Erro ao processar o arquivo.");
      setMessageType("error");
    }
  }

  async function handleDomainSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dominioText.trim()) return;

    if (dominioMode === "remover") {
      const ok = window.confirm(
        `Tem certeza que deseja REMOVER o domínio "${dominioText}" da lista?`,
      );
      if (!ok) return;
    }

    setMessage("");
    setMessageType("");

    const endpoint =
      dominioMode === "inserir" ? "inserirDominio" : "removerDominio";

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/PowerDns/${endpoint}`,
        { dominio: dominioText },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        },
      );
      console.log("✅ Domínio processado:", response.data);
      setMessage(response.data.message);
      setMessageType("success");
      setDominioText(""); // Limpa o campo após sucesso
    } catch (error: any) {
      console.error("❌ Erro:", error);
      setMessage(
        error.response?.data?.error ||
          `Erro ao ${dominioMode === "inserir" ? "inserir" : "remover"} domínio.`,
      );
      setMessageType("error");
    }
  }

  async function handleTestarDominio(e: React.FormEvent) {
    e.preventDefault();
    if (!testeText.trim()) return;

    setTestando(true);
    setResultadoTeste(null);
    setMessage("");
    setMessageType("");

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/PowerDns/testarDominio`,
        { dominio: testeText },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        },
      );
      setResultadoTeste(response.data);
    } catch (error: any) {
      console.error("❌ Erro ao testar domínio:", error);
      setMessage(error.response?.data?.error || "Erro ao testar o domínio.");
      setMessageType("error");
    } finally {
      setTestando(false);
    }
  }

  async function handleDownloadDominios() {
    setMessage("");
    setMessageType("");

    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/PowerDns/obterDominios`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 60000,
        },
      );

      const dominios: string[] = response.data.dominios;

      if (!dominios || dominios.length === 0) {
        setMessage("Nenhum domínio cadastrado no banco de dados.");
        setMessageType("error");
        return;
      }

      // Converte o array em string separando por quebra de linha
      const textContent = dominios.join("\n");
      const blob = new Blob([textContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "dominios_powerdns.txt";
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage("Download da lista de domínios realizado com sucesso.");
      setMessageType("success");
    } catch (error: any) {
      console.error("❌ Erro ao baixar domínios:", error);
      setMessage(
        error.response?.data?.error ||
          "Erro ao baixar os domínios do banco de dados.",
      );
      setMessageType("error");
    }
  }

  return (
    <>
      <NavBar />
      <div className="bg-gray-200 min-h-screen flex flex-col justify-center items-center gap-8 p-4">
        {/* Envio por Lote (Arquivo) */}
        <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center w-full max-w-md">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            {fileMode === "inserir"
              ? "Adicionar domínios por arquivo"
              : "Remover domínios por arquivo"}
          </h2>

          {/* Toggle Adicionar / Remover */}
          <div className="flex w-full mb-4 rounded-md overflow-hidden border border-gray-300">
            <button
              type="button"
              onClick={() => setFileMode("inserir")}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                fileMode === "inserir"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              Adicionar
            </button>
            <button
              type="button"
              onClick={() => setFileMode("remover")}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                fileMode === "remover"
                  ? "bg-red-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              Remover
            </button>
          </div>

          {/* Input escondido */}
          <input
            type="file"
            accept=".pdf,.xlsx,.csv"
            ref={inputRef}
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                if (fileMode === "remover") {
                  const ok = window.confirm(
                    "Tem certeza que deseja REMOVER da lista todos os domínios extraídos deste arquivo?",
                  );
                  if (!ok) {
                    e.target.value = "";
                    return;
                  }
                }
                handleFile(e.target.files[0]);
                e.target.value = "";
              }
            }}
          />

          {/* Botão que abre o seletor */}
          <SendPdf
            onClick={() => inputRef.current?.click()}
            label={
              fileMode === "inserir"
                ? "Criar Nova Regra PowerDns"
                : "Remover Regras PowerDns"
            }
          />
        </div>

        {/* Envio de domínio único por Texto */}
        <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center w-full max-w-md">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            {dominioMode === "inserir"
              ? "Adicionar domínio único"
              : "Remover domínio único"}
          </h2>

          {/* Toggle Adicionar / Remover */}
          <div className="flex w-full mb-4 rounded-md overflow-hidden border border-gray-300">
            <button
              type="button"
              onClick={() => setDominioMode("inserir")}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                dominioMode === "inserir"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              Adicionar
            </button>
            <button
              type="button"
              onClick={() => setDominioMode("remover")}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                dominioMode === "remover"
                  ? "bg-red-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              Remover
            </button>
          </div>

          <form
            onSubmit={handleDomainSubmit}
            className="flex flex-col w-full gap-4"
          >
            <input
              type="text"
              placeholder="exemplo.com.br"
              className="p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={dominioText}
              onChange={(e) => setDominioText(e.target.value)}
            />
            <button
              type="submit"
              disabled={!dominioText.trim()}
              className={`text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                dominioMode === "inserir"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {dominioMode === "inserir" ? "Inserir Domínio" : "Remover Domínio"}
            </button>
          </form>
        </div>

        {/* Testar domínio (dig) */}
        <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center w-full max-w-md">
          <div className="flex w-full items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">
              Testar domínio
            </h2>
            {(user?.permission ?? 0) >= 5 && (
              <button
                type="button"
                onClick={() => setConfigAberta(true)}
                className="text-sm py-1 px-3 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                ⚙ Configurar
              </button>
            )}
          </div>
          <form
            onSubmit={handleTestarDominio}
            className="flex flex-col w-full gap-4"
          >
            <input
              type="text"
              placeholder="exemplo.com.br"
              className="p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={testeText}
              onChange={(e) => setTesteText(e.target.value)}
            />
            <button
              type="submit"
              disabled={!testeText.trim() || testando}
              className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testando ? "Testando..." : "Testar Domínio"}
            </button>
          </form>

          {resultadoTeste && (
            <div className="w-full mt-4">
              <p className="text-sm text-gray-700 mb-2">
                Status:{" "}
                <span
                  className={`font-bold ${
                    resultadoTeste.status === "NOERROR"
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {resultadoTeste.status}
                </span>
                <span className="text-gray-500">
                  {" "}
                  · rodado em {resultadoTeste.executado_em}
                </span>
              </p>
              <pre className="bg-gray-900 text-green-300 text-xs p-3 rounded overflow-x-auto whitespace-pre">
                {`$ ${resultadoTeste.comando}\n${resultadoTeste.saida}`}
              </pre>
            </div>
          )}
        </div>

        {/* Baixar lista de domínios cadastrados */}
        <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center w-full max-w-md">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            Baixar Lista de Domínios
          </h2>
          <button
            onClick={handleDownloadDominios}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors w-full"
          >
            Baixar Lista de Domínios (.txt)
          </button>
        </div>

        {/* Mensagem de Feedback */}
        {message && (
          <div
            className={`p-4 rounded-md shadow mt-4 text-center max-w-md w-full whitespace-pre-line ${
              messageType === "success"
                ? "bg-green-100 text-green-800"
                : messageType === "error"
                  ? "bg-red-100 text-red-800"
                  : "bg-blue-100 text-blue-800"
            }`}
          >
            {message}
          </div>
        )}
      </div>
      {configAberta && (
        <ConfigDig token={token} onClose={() => setConfigAberta(false)} />
      )}
    </>
  );
};
