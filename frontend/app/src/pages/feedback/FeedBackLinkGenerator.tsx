import { useEffect, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import Select from "./components/Select";
import { BarChart } from "@mui/x-charts/BarChart";
import Toggle from "./components/Toggle";
 import axios from "axios";
import { useAuth } from "../../context/AuthContext";

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

interface NoteYesOrNo {
  note: number;
  count: number;
}

const FeedbackBarChart = ({
  data,
  label,
  isMobile,
}: {
  data: Note[];
  label: string;
  isMobile: boolean;
}) => {
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
          data: chartData.map((d) => d.count) || [0, 0],
          label,
          id: "count",
          color: "none",
        },
      ]}
      xAxis={[
        {
          data: chartData.map((d) => d.note) || ["Notas"],
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

const YesOrNoChart = ({
  data = [],
  label,
  isMobile,
}: {
  data: NoteYesOrNo[];
  label: string;
  isMobile: boolean;
}) => {
  const simCount = data.find((d) => d.note === 1)?.count || 0;
  const naoCount = data.find((d) => d.note === 0)?.count || 0;

  return (
    <BarChart
      width={isMobile ? 300 : 500}
      height={300}
      series={[
        {
          data: [simCount, naoCount],
          label: label,
          id: "yes-no",
        },
      ]}
      xAxis={[
        {
          data: ["Sim", "Não"],
          scaleType: "band",
        },
      ]}
    />
  );
};

const TechBarChart = ({
  data = [],
  label,
  isMobile,
}: {
  data: NoteTech[];
  label: string;
  isMobile: boolean;
}) => {
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
          data: chartData.map((d) => d.count) || [0, 0],
          label,
          id: "count",
          color: "none",
        },
      ]}
      xAxis={[
        {
          data: chartData.map((d) => d.note) || ["Notas"],
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

const FeedbackLinkGenerator = () => {
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const token = user?.token;
  const [noteData, setNoteData] = useState<{ [key: string]: Note[] }>({
    internet: [],
    service: [],
    responseTime: [],
  });
  const [technoteData, settechNoteData] = useState<{
    [key: string]: NoteTech[];
  }>({
    technician: [],
  });
  const [isMonthly, setMonthly] = useState(true);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);


// Função para buscar notas gerais
const fetchNotes = async (type: string) => {
  // Define se o período é "month" ou "year"
  const period = isMonthly ? "month" : "year";

  // Monta o endpoint
  const endpoint = `${process.env.REACT_APP_URL}/feedback/Note${type}/${period}`;

  try {
    // Faz a requisição GET usando axios
    const response = await axios.get(endpoint, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // passa o token no header
      },
    });

    // O axios já converte automaticamente para JSON em response.data
    console.log(response.data);

    return response.data;
  } catch (error) {
    console.error("Erro ao buscar notas:", error);
    return []; // Retorna array vazio em caso de erro
  }
};

// Função para buscar notas de um técnico específico
const fetchNotesTech = async (type: string): Promise<NoteTech[]> => {
  const period = isMonthly ? "month" : "year";
  const endpoint = `${process.env.REACT_APP_URL}/feedback/Note${type}/${period}`;

  try {
    // Faz a requisição POST usando axios
    const response = await axios.post(
      endpoint,
      { technician: selectedTechnician }, // corpo da requisição
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log(response.data);

    // Converte o dado recebido para o formato correto
    const parsedData: NoteTech[] = response.data.map((item: any) => ({
      note: item.note,
      count: Number(item.count), // Converte count para número
      name: item.login || "",    // Usa o campo login como 'name'
    }));

    return parsedData;
  } catch (error: any) {
    console.error("Erro ao buscar dados do técnico:", error);
    return [];
  }
};

// Função para gerar link de feedback
const createLink = async () => {
  if (!selectedTechnician) {
    alert("Selecione um técnico antes de gerar o link.");
    return;
  }

  try {
    // Faz a requisição POST usando axios
    const response = await axios.post(
      `${process.env.REACT_APP_URL}/feedback/create`,
      { technician: selectedTechnician }, // corpo
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data?.link) {
      setGeneratedLink(response.data.link); // pega o link do backend
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
    const parseNoteData = (data: any[]): NoteYesOrNo[] => {
      return data.map((item) => ({
        note: Array.isArray(item.note.data) ? item.note.data[0] : item.note,
        count: Number(item.count),
      }));
    };
  
    const fetchAllNotes = async () => {
      try {
        setLoading(true);
        const [internet, service, responseTime, recommend, solved] =
          await Promise.all([
            fetchNotes("Internet"),
            fetchNotes("Service"),
            fetchNotes("ResponseTime"),
            fetchNotes("DoYouRecommend"),
            fetchNotes("DoYouProblemAsSolved"),
          ]);
  
        const processedRecommend = parseNoteData(recommend);
        const processedSolved = parseNoteData(solved);
  
        setNoteData({
          internet,
          service,
          responseTime,
          recommend: processedRecommend,
          solved: processedSolved,
        });
  
        const tech = await fetchNotesTech("Technician");
        settechNoteData({ technician: tech });
        setLoading(false);
      } catch (error) {
        console.error("Erro ao buscar os dados:", error);
      }
    };
  
    fetchAllNotes();
  }, [isMonthly, selectedTechnician]);
  

  

  return (
    <>
      <NavBar />
      <div className="flex justify-center flex-col mt-20 gap-10 sm:gap-5 font-semibold">
        <h1>Gerador de Link para Feedback</h1>

        <div>
          <Select onChange={(tech: Tech) => setSelectedTechnician(tech.name)} />
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-10">
          <button
            className="bg-slate-900 self-center  text-gray-300 rounded p-5 hover:bg-slate-700"
            onClick={createLink}
          >
            Gerar Link
          </button>
          <a
            href="/feedback/Opnion"
            className="bg-slate-400 p-5 rounded transition-all hover:bg-slate-300"
          >
            Opinião
          </a>
        </div>

        {generatedLink && (
          <div>
            <p>
              Compartilhe este link com os clientes:{" "}
              <button
                className="text-sky-600 m-5 underline"
                onClick={() => navigator.clipboard.writeText(`${process.env.REACT_APP_BASE_URL}` + generatedLink)}
              >
                Copiar Link
              </button>
            </p>
          </div>
        ) }

        <div className="flex flex-col items-center gap-10 mt-1 sm:mt-10">
          <Toggle
            checked={!isMonthly}
            onChange={() => setMonthly((prev) => !prev)}
          />
          {loading &&
          <><h1>Carregando ...</h1></>
          }
          <div className="flex flex-col sm:flex-row flex-wrap gap-20 justify-center">
            <div className="flex sm:max-w-[30%] bg-gray-200">
              <FeedbackBarChart
                data={noteData.internet}
                label="Notas sobre a Internet"
                isMobile={isMobile}
              />
            </div>
            <div className="flex sm:max-w-[30%] bg-gray-200">
              <FeedbackBarChart
                data={noteData.service}
                label="Notas sobre o Atendimento"
                isMobile={isMobile}
              />
            </div>
            <div className="flex sm:max-w-[30%] bg-gray-200">
              <FeedbackBarChart
                data={noteData.responseTime}
                label="Notas sobre o Tempo de Resposta"
                isMobile={isMobile}
              />
            </div>
            <div className="flex sm:max-w-[30%] bg-gray-200">
              <YesOrNoChart
                data={noteData.recommend}
                label="Clientes que nós Recomendam"
                isMobile={isMobile}
              />
            </div>
            <div className="flex sm:max-w-[30%] bg-gray-200">
              <YesOrNoChart
                data={noteData.solved}
                label="Clientes que solucionamos os problemas"
                isMobile={isMobile}
              />
            </div>
            <div className="flex sm:max-w-[30%] bg-gray-200">
              {technoteData.technician.length > 0 && (
                <TechBarChart
                  data={technoteData.technician}
                  label={`Notas sobre o ${selectedTechnician}`}
                  isMobile={isMobile}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FeedbackLinkGenerator;
