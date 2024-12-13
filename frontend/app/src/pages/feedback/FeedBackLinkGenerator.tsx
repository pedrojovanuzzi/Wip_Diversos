import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { NavBar } from "../../components/navbar/NavBar";
import Select from "./components/Select";


interface Tech {
    id : number,
    name : string,
    online : boolean
}

const FeedbackLinkGenerator = () => {
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [usedLinks, setUsedLinks] = useState<Record<string, boolean>>({});
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");

  const createLink = (): void => {
    if (!selectedTechnician) {
      alert("Selecione um técnico antes de gerar o link.");
      return;
    }
    const uniqueUrl = `/feedback/${selectedTechnician}/${uuidv4()}`;
    setGeneratedLink(uniqueUrl);
  };

  const submitFeedback = (link: string): void => {
    if (usedLinks[link]) {
      alert("Este link já foi utilizado ou está indisponível.");
      return;
    }

    // Aqui você pode adicionar a lógica para o cliente enviar a nota, por exemplo:
    // sendFeedbackToServer(link, feedback);

    setUsedLinks({ ...usedLinks, [link]: true });
    alert("Feedback enviado com sucesso!");
  };

  return (
    <>
      <NavBar/>
      <div className="flex justify-center flex-col h-screen gap-5 font-semibold">
        <h1>Gerador de Link para Feedback</h1>

        <div>
          <Select onChange={(tech : Tech) => setSelectedTechnician(tech.name)} />
        </div>

        <button className="bg-slate-900 sm:w-1/12 self-center text-gray-300 rounded p-5 hover:bg-slate-700" onClick={createLink}>Gerar Link</button>

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
