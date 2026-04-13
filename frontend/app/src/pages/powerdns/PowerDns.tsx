import React, { useRef, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import SendPdf from "./components/SendPdf";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

export const PowerDns = () => {
  const { user } = useAuth();
  const token = user?.token;
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [dominioText, setDominioText] = useState("");
  const [fileMode, setFileMode] = useState<"inserir" | "remover">("inserir");
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    setMessage("");
    setMessageType("");

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/PowerDns/inserirDominio`,
        { dominio: dominioText },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        },
      );
      console.log("✅ Domínio inserido:", response.data);
      setMessage(response.data.message);
      setMessageType("success");
      setDominioText(""); // Limpa o campo após sucesso
    } catch (error: any) {
      console.error("❌ Erro:", error);
      setMessage(error.response?.data?.error || "Erro ao inserir domínio.");
      setMessageType("error");
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
            Adicionar domínio único
          </h2>
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
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Inserir Domínio
            </button>
          </form>
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
    </>
  );
};
