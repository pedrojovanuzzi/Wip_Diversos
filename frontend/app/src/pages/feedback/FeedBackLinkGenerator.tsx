import { useEffect, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import Select from "./components/Select";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../types";
import { BarChart } from "@mui/x-charts/BarChart";
import Toggle from "./components/Toggle";

interface Tech {
  id: number;
  name: string;
  online: boolean;
}

interface Note {
  note: number;
  count: number;
}

interface NoteTech {
  note: number;
  count: number;
  login: string;
}

const FeedbackBarChart = ({ data, label, isMobile } : { data: Note[], label: string, isMobile: boolean }) => {
  const chartData = data.map((d) => ({
    note: d.note,
    count: d.count,
  }));

  return (
    <BarChart
      width={isMobile ? 300 : 500}
      height={300}
      series={[
        {
          data: chartData.map((d) => d.count),
          label,
          id: "count",
          color: "none"
        },
      ]}
      xAxis={[
        {
          data: chartData.map((d) => d.note),
          scaleType: "band",
          colorMap: {
            type: "continuous",
            min: 10,
            max: 0,
            color: ["green", "red"],
          },
        },
      ]}
    />
  );
};


const TechBarChart = ({ data = [], label, isMobile }: { data: NoteTech[]; label: string; isMobile: boolean }) => {
  if (!Array.isArray(data)) {
    console.warn("Data passed to TechBarChart is not an array:", data);
    return null; // Retorna nada caso os dados estejam errados
  }

  const chartData = data.map((d) => ({
    note: d.note,
    count: d.count,
    name: d.login,
  }));

  return (
    <BarChart
      width={isMobile ? 300 : 500}
      height={300}
      series={[
        {
          data: chartData.map((d) => d.count),
          label,
          id: "count",
          color: "none"
        },
      ]}
      xAxis={[
        {
          data: chartData.map((d) => d.note),
          scaleType: "band",
          colorMap: {
            type: "continuous",
            min: 10,
            max: 0,
            color: ["green", "red"],
          },
        },
      ]}
    />
  );
};



//FAZER TECNICO COM POST

const FeedbackLinkGenerator = () => {
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const [selectedTechnicianGraph, setSelectedTechnicianGraph] = useState<string>("");
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const { user } = useTypedSelector((state) => state.auth);
  const [noteData, setNoteData] = useState<{ [key: string]: Note[] }>({
    internet: [],
    service: [],
    responseTime: [],
  });
  const [technoteData, settechNoteData] = useState<{ [key: string]: NoteTech[] }>({
    technician: [],
  });
  const [isMonthly, setMonthly] = useState(true);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  const fetchNotes = async (type: string) => {
    const period = isMonthly ? "month" : "year";
    const endpoint = `${process.env.REACT_APP_URL}/feedback/Note${type}/${period}`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    return response.json();
  };

  const fetchNotesTech = async (type: string): Promise<NoteTech[]> => {
    const period = isMonthly ? "month" : "year";
    const endpoint = `${process.env.REACT_APP_URL}/feedback/Note${type}/${period}`;
  
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ technician: selectedTechnicianGraph }),
      });
  
      if (response.ok) {
        const data = await response.json();
  
        // Converte o dado recebido no formato correto
        const parsedData = data.map((item: any) => ({
          note: item.note,
          count: Number(item.count), // Converte count para número
          name: item.login || "",    // Usa o campo login como 'name'
        }));
  
        return parsedData;
      } else {
        console.error("Erro na requisição:", response.status, await response.text());
        return []; // Retorna um array vazio no caso de erro
      }
    } catch (error) {
      console.error("Erro ao buscar dados do técnico:", error);
      return []; // Retorna um array vazio em caso de exceção
    }
  };
  
  
  

  const createLink = async () => {
    if (!selectedTechnician) {
      alert("Selecione um técnico antes de gerar o link.");
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_URL}/feedback/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ technician: selectedTechnician }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedLink(data.link);
      } 

    } catch (error) {
      console.error("Erro ao gerar o link:", error);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchAllNotes = async () => {
      try {
        const [internet, service, responseTime] = await Promise.all([
          fetchNotes("Internet"),
          fetchNotes("Service"),
          fetchNotes("ResponseTime"),
        ]);
  
        setNoteData({ internet, service, responseTime });
  
        const tech = await fetchNotesTech("Technician");
        settechNoteData({ technician: tech });
      } catch (error) {
        console.error("Erro ao buscar os dados:", error);
      }
    };
  
    fetchAllNotes();
  }, [isMonthly, selectedTechnicianGraph]);
  
  useEffect(() => {
    console.log("Estado atualizado:", technoteData);
  }, [technoteData]);
  
  

  return (
    <>
      <NavBar />
      <div className="flex justify-center flex-col mt-20 gap-10 sm:gap-5 font-semibold">
        <h1>Gerador de Link para Feedback</h1>

        <div>
          <Select onChange={(tech: Tech) => setSelectedTechnician(tech.name)} />
        </div>

        <button
          className="bg-slate-900 self-center text-gray-300 rounded p-5 hover:bg-slate-700"
          onClick={createLink}
        >
          Gerar Link
        </button>

        {generatedLink && (
          <div>
            <p>
              Compartilhe este link com os clientes:{" "}
              <a className="text-sky-600 m-5" href={generatedLink}>
                {generatedLink}
              </a>
            </p>
          </div>
        )}

        <div className="flex flex-col items-center gap-10 mt-1 sm:mt-10">
          <Toggle checked={!isMonthly} onChange={() => setMonthly((prev) => !prev)} />
          <div className="flex flex-col sm:flex-row gap-5">
            <FeedbackBarChart data={noteData.internet} label="Notas sobre a Internet" isMobile={isMobile} />
            <FeedbackBarChart data={noteData.service} label="Notas sobre o Atendimento" isMobile={isMobile} />
            <FeedbackBarChart data={noteData.responseTime} label="Notas sobre o Tempo de Resposta" isMobile={isMobile} />
          </div>
        </div>

        <div className="flex flex-col gap-10 mt-1 sm:mt-10">
        <Select onChange={(tech: Tech) => setSelectedTechnicianGraph(tech.name)} />
          <div className="flex flex-col w-full items-center gap-5">
            <TechBarChart data={technoteData.technician} label="Notas sobre o Técnico" isMobile={isMobile} />
          </div>
        </div>

      </div>
    </>
  );
};

export default FeedbackLinkGenerator;