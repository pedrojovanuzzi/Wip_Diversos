import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import Select from "./components/Select";
import { TypedUseSelectorHook , useSelector } from "react-redux";
import { RootState } from "../../types";


interface Tech {
    id : number,
    name : string,
    online : boolean
}

const FeedbackLinkGenerator = () => {
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const { user } = useTypedSelector((state) => state.auth);

  const createLink = async () => {
    if (!selectedTechnician) {
        alert("Selecione um técnico antes de gerar o link.");
        return;
    }

    const token = user.token; // Certifique-se de que `user.token` contém o valor correto.

    const response = await fetch(`${process.env.REACT_APP_URL}/feedback/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` // Adiciona o token no cabeçalho
        },
        body: JSON.stringify({ technician: selectedTechnician }),
    });

    if (response.ok) {
        const data = await response.json();
        setGeneratedLink(data.link);
    } else {
        const errorMessage = await response.text();
        alert(`Erro ao gerar o link: ${errorMessage}`);
    }
};




  return (
    <>
      <NavBar/>
      <div className="flex justify-center flex-col h-screen gap-5 font-semibold">
        <h1>Gerador de Link para Feedback</h1>

        <div>
          <Select onChange={(tech : Tech) => setSelectedTechnician(tech.name)} />
        </div>

        <button className="bg-slate-900 self-center text-gray-300 rounded p-5 hover:bg-slate-700" onClick={createLink}>Gerar Link</button>

        {generatedLink && (
          <div>
            <p>
              Compartilhe este link com os clientes: <a href={generatedLink}>{generatedLink}</a>
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default FeedbackLinkGenerator;
