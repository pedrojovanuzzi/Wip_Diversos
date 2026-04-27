"use client";

import { useRef, useState } from "react";
import axios from "axios";
import NavBar from "@/components/NavBar";
import type { User } from "@/lib/auth";

function SendPdf({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative block rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600"
    >
      <svg fill="none" stroke="currentColor" viewBox="0 0 48 48" aria-hidden="true" className="mx-auto size-12 text-gray-400">
        <path d="M8 14v20c0 4.418 7.163 8 16 8 1.381 0 2.721-.087 4-.252M8 14c0 4.418 7.163 8 16 8s16-3.582 16-8M8 14c0-4.418 7.163-8 16-8s16 3.582 16 8m0 0v14m0-4c0 4.418-7.163 8-16 8S8 28.418 8 24m32 10v6m0 0v6m0-6h6m-6 0h-6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="mt-2 block text-sm font-semibold text-gray-900">{label}</span>
    </button>
  );
}

export default function PowerDnsClient({ user }: { user: User }) {
  const token = user.token;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [dominioText, setDominioText] = useState("");
  const [fileMode, setFileMode] = useState<"inserir" | "remover">("inserir");

  function setFeedback(type: "success" | "error", msg: string) {
    setMessage(msg);
    setMessageType(type);
  }

  async function handleFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    setMessage("");
    setMessageType("");
    const endpoint = fileMode === "inserir" ? "inserirPdf" : "removerPdf";
    try {
      const { data } = await axios.post(
        `${process.env.REACT_APP_URL}/PowerDns/${endpoint}`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }, timeout: 60000 },
      );
      setFeedback("success", data.message);
    } catch (err: any) {
      setFeedback("error", err.response?.data?.error || "Erro ao processar o arquivo.");
    }
  }

  async function handleDomainSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dominioText.trim()) return;
    setMessage("");
    setMessageType("");
    try {
      const { data } = await axios.post(
        `${process.env.REACT_APP_URL}/PowerDns/inserirDominio`,
        { dominio: dominioText },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 },
      );
      setFeedback("success", data.message);
      setDominioText("");
    } catch (err: any) {
      setFeedback("error", err.response?.data?.error || "Erro ao inserir domínio.");
    }
  }

  async function handleDownloadDominios() {
    setMessage("");
    setMessageType("");
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_URL}/PowerDns/obterDominios`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 },
      );
      const dominios: string[] = data.dominios;
      if (!dominios?.length) { setFeedback("error", "Nenhum domínio cadastrado."); return; }
      const blob = new Blob([dominios.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "dominios_powerdns.txt";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      setFeedback("success", "Download realizado com sucesso.");
    } catch (err: any) {
      setFeedback("error", err.response?.data?.error || "Erro ao baixar domínios.");
    }
  }

  return (
    <>
      <NavBar user={user} />
      <div className="bg-gray-200 min-h-screen flex flex-col justify-center items-center gap-8 p-4">
        {/* Envio por arquivo */}
        <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center w-full max-w-md">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            {fileMode === "inserir" ? "Adicionar domínios por arquivo" : "Remover domínios por arquivo"}
          </h2>
          <div className="flex w-full mb-4 rounded-md overflow-hidden border border-gray-300">
            <button type="button" onClick={() => setFileMode("inserir")} className={`flex-1 py-2 text-sm font-semibold transition-colors ${fileMode === "inserir" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>Adicionar</button>
            <button type="button" onClick={() => setFileMode("remover")} className={`flex-1 py-2 text-sm font-semibold transition-colors ${fileMode === "remover" ? "bg-red-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>Remover</button>
          </div>
          <input
            type="file" accept=".pdf,.xlsx,.csv" ref={inputRef} style={{ display: "none" }}
            onChange={(e) => {
              if (!e.target.files?.[0]) return;
              if (fileMode === "remover" && !window.confirm("Tem certeza que deseja REMOVER os domínios deste arquivo?")) { e.target.value = ""; return; }
              handleFile(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <SendPdf onClick={() => inputRef.current?.click()} label={fileMode === "inserir" ? "Criar Nova Regra PowerDns" : "Remover Regras PowerDns"} />
        </div>

        {/* Domínio único */}
        <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center w-full max-w-md">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Adicionar domínio único</h2>
          <form onSubmit={handleDomainSubmit} className="flex flex-col w-full gap-4">
            <input type="text" placeholder="exemplo.com.br" className="p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={dominioText} onChange={(e) => setDominioText(e.target.value)} />
            <button type="submit" disabled={!dominioText.trim()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Inserir Domínio</button>
          </form>
        </div>

        {/* Download */}
        <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center w-full max-w-md">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Baixar Lista de Domínios</h2>
          <button onClick={handleDownloadDominios} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors w-full">Baixar Lista de Domínios (.txt)</button>
        </div>

        {message && (
          <div className={`p-4 rounded-md shadow mt-4 text-center max-w-md w-full whitespace-pre-line ${messageType === "success" ? "bg-green-100 text-green-800" : messageType === "error" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}`}>
            {message}
          </div>
        )}
      </div>
    </>
  );
}
