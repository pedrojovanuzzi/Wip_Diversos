import React, { useRef, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import SendPdf from "./components/SendPdf";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

export const PowerDns = () => {
  const { user } = useAuth();
  const token = user?.token;
  const [message, setMessage] = useState("");
  const [dominioText, setDominioText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/PowerDns/inserirPdf`,
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
    } catch (error) {
      console.error("❌ Erro:", error);
      setMessage("Erro ao processar o arquivo.");
    }
  }

  async function handleDomainSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dominioText.trim()) return;

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
      setDominioText(""); // Limpa o campo após sucesso
    } catch (error) {
      console.error("❌ Erro:", error);
      setMessage("Erro ao inserir domínio.");
    }
  }

  return (
    <>
      <NavBar />
      <div className="bg-gray-200 min-h-screen flex flex-col justify-center items-center gap-8 p-4">
        {/* Envio por Lote (Arquivo) */}
        <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center w-full max-w-md">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            Adicionar domínios por arquivo
          </h2>
          {/* Input escondido */}
          <input
            type="file"
            accept=".pdf,.xlsx,.csv"
            ref={inputRef}
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          {/* Botão que abre o seletor */}
          <SendPdf onClick={() => inputRef.current?.click()} />
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

        {/* Mensagem de Feedback */}
        {message && (
          <div className="p-4 bg-blue-100 text-blue-800 rounded-md shadow mt-4 text-center max-w-md w-full whitespace-pre-line">
            {message}
          </div>
        )}
      </div>
    </>
  );
};
