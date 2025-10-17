import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

type ModoKey = "ultimo" | "todos" | "aberto" | "varias";

export const PixDetalhe = () => {
  const { tipo } = useParams<{ tipo: ModoKey }>();
  const [user, setUser] = useState("");
  const [cpf, setCpf] = useState("");
  const [titulos, setTitulos] = useState("");
  const { user: authUser } = useAuth();
  const token = authUser?.token;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pixUrl, setPixUrl] = useState("");
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [cliente, setCliente] = useState('');

  const modos: Record<ModoKey, { titulo: string; descricao: string; url: string }> = {
    ultimo: {
      titulo: "Pix do Último Vencimento",
      descricao:
        "Aqui você gera o Pix referente à última mensalidade vencida do cliente.",
      url: `${process.env.REACT_APP_URL}/Pix/gerador`,
    },
    todos: {
      titulo: "Pix de Todos os Vencimentos",
      descricao: "Gere um único Pix contendo todas as mensalidades vencidas.",
      url: `${process.env.REACT_APP_URL}/Pix/geradorAll`,
    },
    aberto: {
      titulo: "Pix Mensalidade em Aberto",
      descricao: "Gere o Pix da mensalidade que ainda está em aberto.",
      url: `${process.env.REACT_APP_URL}/Pix/geradorAberto`,
    },
    varias: {
      titulo: "Pix de Várias Contas",
      descricao: "Combine várias mensalidades ou várias contas em um único Pix.",
      url: `${process.env.REACT_APP_URL}/Pix/geradorTitulos`,
    },
  };

  const modo = (tipo && modos[tipo]) || {
    titulo: "Tipo de Pix inválido",
    descricao: "Verifique a URL.",
    url: "",
  };

  const isVarias = tipo === "varias";
  const inputName = isVarias ? "nome_completo" : "pppoe";

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

  async function gerarPix(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (isVarias) {
      try {
        const response = await axios.post(
          modo.url,
          { nome_completo: user, cpf: cpf, titulos: titulos },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setPixUrl(response.data.link);
        setCliente(response.data.pppoe);
        setDataVencimento(response.data.formattedDate);
        setValor(response.data.valor);
        console.log(response.data);
      } catch (error: any) {
        const msg = extractErrorMessage(error);
        setError(msg);
        console.log(msg);
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const response = await axios.post(
          modo.url,
          { pppoe: user, cpf: cpf },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setPixUrl(response.data.link);
        setPixUrl(response.data.link);
        setCliente(response.data.pppoe);
        setDataVencimento(response.data.formattedDate);
        setValor(response.data.valor);
        console.log(response.data);
      } catch (error: any) {
        const msg = extractErrorMessage(error);
        setError(msg);
        console.log(msg);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="sm:p-5 bg-slate-800 min-h-screen text-gray-200">
      <NavBar />
      <form>
        <div className="bg-gray-100 text-gray-900 p-10 rounded-md">
          <h1 className="text-2xl font-bold">{modo.titulo}</h1>
          <p className="mt-2">{modo.descricao}</p>
          <div className="flex flex-col mt-5 items-center gap-4">
            {inputName === "pppoe" && (
              <input
                className="p-2 rounded-sm ring-1"
                type="text"
                autoComplete="name"
                placeholder="PPPOE"
                onChange={(e) => setUser(e.target.value)}
              />
            )}
            {inputName === "nome_completo" && (
              <>
                <input
                  className="p-2 rounded-sm ring-1"
                  type="text"
                  placeholder="Nome Completo"
                  onChange={(e) => setUser(e.target.value)}
                />
                <input
                  className="p-2 rounded-sm ring-1"
                  type="text"
                  placeholder="182790, 123456, 678902"
                  onChange={(e) => setTitulos(e.target.value)}
                />
              </>
            )}
            <input
              className="p-2 rounded-sm ring-1"
              type="text"
              placeholder="CPF"
              onChange={(e) => setCpf(e.target.value)}
            />
            <button
              className="rounded-md ring-1 p-2 bg-slate-800 text-white w-full sm:w-60"
              onClick={gerarPix}
            >
              Gerar Pix
            </button>
            {pixUrl && (
  <div className="w-full sm:w-2/3 mt-6 p-5 bg-white rounded-lg shadow-md text-gray-800 space-y-3">
    <h2 className="text-xl font-bold text-center border-b pb-2 text-slate-800">
      Detalhes do Pix Gerado
    </h2>

    <div className="flex flex-col gap-1">
      <p className="text-sm text-gray-600">URL do Pix / Resposta:</p>
      <span
        className="font-mono text-blue-600 underline cursor-pointer break-all hover:text-blue-800 transition"
        onClick={() => {
          navigator.clipboard.writeText(pixUrl);
          alert("Link copiado para a área de transferência!");
        }}
        title="Clique para copiar"
      >
        {pixUrl}
      </span>
    </div>

    {valor && (
      <div>
        <p className="text-sm text-gray-600">Valor:</p>
        <p className="font-semibold text-green-600 text-lg">
          R$ {Number(valor).toFixed(2)}
        </p>
      </div>
    )}

    {dataVencimento && (
      <div>
        <p className="text-sm text-gray-600">Data de Vencimento:</p>
        <p className="font-medium">{dataVencimento}</p>
      </div>
    )}

    {cliente && (
      <div>
        <p className="text-sm text-gray-600">Cliente:</p>
        <p className="font-medium">{cliente}</p>
      </div>
    )}
  </div>
)}

            {loading && <p>Carregando...</p>}
            {error && <p className="text-red-500">{error}</p>}
          </div>
        </div>
      </form>
    </div>
  );
};
