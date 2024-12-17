import React, { useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import Stacked from "./Components/Stacked";
import Filter from "./Components/Filter";

export const Nfe = () => {
  const [dadosNFe, setDadosNFe] = useState({});

  const emitirNFe = async () => {
    try {
      const resposta = await axios.get(
        `${process.env.REACT_APP_URL}/Nfe/`,
        dadosNFe
      );
      console.log("NF-e emitida:", resposta.data);
      setDadosNFe(resposta.data);
    } catch (erro) {
      console.error("Erro ao emitir NF-e:", erro);
    }
  };

  return (
    <div>
      <NavBar />
      <Stacked />
      <Filter />
      <main className="flex justify-center mt-20">
        <button
          className="bg-slate-500 text-gray-200 p-5 m-5 rounded hover:bg-slate-400 transition-all"
          onClick={emitirNFe}
        >
          Emitir NF-e
        </button>
      </main>
    </div>
  );
};
