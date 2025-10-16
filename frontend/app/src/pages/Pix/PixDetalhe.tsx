import React from "react";
import { useParams, Link } from "react-router-dom";
import { NavBar } from "../../components/navbar/NavBar";

export const PixDetalhe = () => {
  const { tipo } = useParams(); // ← lê /pix/:tipo

  // Dicionário com os modos e textos diferentes
  const modos = {
    ultimo: {
      titulo: "Pix do Último Vencimento",
      descricao: "Aqui você gera o Pix referente à última mensalidade vencida do cliente.",
    },
    todos: {
      titulo: "Pix de Todos os Vencimentos",
      descricao: "Gere um único Pix contendo todas as mensalidades vencidas.",
    },
    aberto: {
      titulo: "Pix Mensalidade em Aberto",
      descricao: "Gere o Pix da mensalidade que ainda está em aberto.",
    },
    varias: {
      titulo: "Pix de Várias Contas",
      descricao: "Combine várias mensalidades ou várias contas em um único Pix.",
    },
    automatico: {
      titulo: "Pix Automático",
      descricao: "Gerencie clientes e configure o Pix Automático.",
    },
  };

  // Caso não exista o tipo, evita erro
  const modo = modos[tipo as keyof typeof modos] || {
    titulo: "Tipo de Pix inválido",
    descricao: "Verifique a URL.",
  };

  return (
    <div className="p-5 bg-slate-800 sm:h-screen text-gray-200">
      <NavBar />
      <div className="bg-gray-100 text-gray-900 p-10 rounded-md">
        <h1 className="text-2xl font-bold">{modo.titulo}</h1>
        <p className="mt-2">{modo.descricao}</p>

        {/* botão voltar */}
        <Link to="/pix">
          <button className="mt-6 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600">
            ← Voltar
          </button>
        </Link>
      </div>
    </div>
  );
};
