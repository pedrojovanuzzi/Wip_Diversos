import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

export const PixDetalhe = () => {
  const { tipo } = useParams(); // ← lê /pix/:tipo
  const [user, setUser] = useState("");
  const [cpf, setCpf] = useState("");
  const [titulos, setTitulos] = useState("");
  const { user: authUser } = useAuth();
  const token = authUser?.token;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pixUrl, setPixUrl] = useState('');

  // Dicionário com os modos e textos diferentes
  const modos = {
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
      descricao:
        "Combine várias mensalidades ou várias contas em um único Pix.",
      url: `${process.env.REACT_APP_URL}/Pix/geradorTitulos`,
    },
  };

  // Caso não exista o tipo, evita erro
  const modo = modos[tipo as keyof typeof modos] || {
    titulo: "Tipo de Pix inválido",
    descricao: "Verifique a URL.",
    url: "",
  };

  const [inputName, setInputName] = useState(
    modo === modos.varias ? "nome_completo" : "pppoe"
  );

  async function gerarPix(e: React.FormEvent) {
    setLoading(true);
    if (modos.varias) {
      try {
        const response = await axios.post(
          modo.url,
          { nome_completo: user, cpf: cpf, titulos: titulos },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setPixUrl(response.data);
      } catch (error: any) {
        setError(error)
      }
    } else {
      try {
        const response = await axios.post(
          modo.url,
          { pppoe: user, cpf: cpf },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setPixUrl(response.data);
      } catch (error: any) {
        setError(error)
      }
      finally{
        setLoading(false);
      }
    }
  }

  return (
    <div className="p-5 bg-slate-800 min-h-screen text-gray-200">
      <NavBar />
      <form>
        <div className="bg-gray-100 text-gray-900 p-10 rounded-md">
          <h1 className="text-2xl font-bold">{modo.titulo}</h1>
          <p className="mt-2">{modo.descricao}</p>
          <div className=" flex flex-col mt-5 items-center gap-4">
            {inputName === "pppoe" && (
              <input
                className="p-2 rounded-sm ring-1"
                type="text"
                placeholder="PPPOE"
                onChange={(e) => setUser(e.target.value)}
              />
            )}
            {inputName === "nome_completo" && (
              <input
                className="p-2 rounded-sm ring-1"
                type="text"
                placeholder="Nome Completo"
                onChange={(e) => setUser(e.target.value)}
              />
            )}
            {inputName === "nome_completo" && (
              <input
                className="p-2 rounded-sm ring-1"
                type="text"
                placeholder="182790, 123456, 678902"
                onChange={(e) => setTitulos(e.target.value)}
              />
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
            {pixUrl && <p>Url do Pix: {pixUrl}</p>}
            {loading && <p>Carregando...</p>}
            {error && <p className="text-red-500">{error}</p>}
          </div>
        </div>
      </form>
    </div>
  );
};
