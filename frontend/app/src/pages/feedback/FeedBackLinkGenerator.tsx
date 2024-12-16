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
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const { user } = useTypedSelector((state) => state.auth);
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

  const fetchNotes = async (type: string) => {
    const period = isMonthly ? "month" : "year";
    const endpoint = `${process.env.REACT_APP_URL}/feedback/Note${type}/${period}`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
      },
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
        body: JSON.stringify({ technician: selectedTechnician }),
      });

      if (response.ok) {
        const data = await response.json();

        // Converte o dado recebido no formato correto
        const parsedData = data.map((item: any) => ({
          note: item.note,
          count: Number(item.count), // Converte count para número
          name: item.login || "", // Usa o campo login como 'name'
        }));

        return parsedData;
      } else {
        console.error(
          "Erro na requisição:",
          response.status,
          await response.text()
        );
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
      const response = await fetch(
        `${process.env.REACT_APP_URL}/feedback/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({ technician: selectedTechnician }),
        }
      );

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
    const parseNoteData = (data: any[]): NoteYesOrNo[] => {
      return data.map((item) => ({
        note: Array.isArray(item.note.data) ? item.note.data[0] : item.note, // Converte o buffer para número
        count: Number(item.count), // Garante que 'count' seja um número
      }));
    };

    const fetchAllNotes = async () => {
      try {
        const [internet, service, responseTime, recommend, solved] =
          await Promise.all([
            fetchNotes("Internet"),
            fetchNotes("Service"),
            fetchNotes("ResponseTime"),
            fetchNotes("DoYouRecommend"),
            fetchNotes("DoYouProblemAsSolved"),
            fetchNotes("DoYouProblemAsSolved"),
          ]);

        // Processa apenas os dados de Yes/No (recommend e solved)
        const processedRecommend = parseNoteData(recommend);
        const processedSolved = parseNoteData(solved);

        // Define o estado com os dados processados
        setNoteData({
          internet,
          service,
          responseTime,
          recommend: processedRecommend,
          solved: processedSolved,
        });

        const tech = await fetchNotesTech("Technician");
        settechNoteData({ technician: tech });
      } catch (error) {
        console.error("Erro ao buscar os dados:", error);
      }
    };

    fetchAllNotes();
  });

  

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
          <div className="flex flex-col sm:flex-row flex-wrap gap-5 justify-center">
            <div className="flex sm:max-w-[30%]">
              <FeedbackBarChart
                data={noteData.internet}
                label="Notas sobre a Internet"
                isMobile={isMobile}
              />
            </div>
            <div className="flex sm:max-w-[30%]">
              <FeedbackBarChart
                data={noteData.service}
                label="Notas sobre o Atendimento"
                isMobile={isMobile}
              />
            </div>
            <div className="flex sm:max-w-[30%]">
              <FeedbackBarChart
                data={noteData.responseTime}
                label="Notas sobre o Tempo de Resposta"
                isMobile={isMobile}
              />
            </div>
            <div className="flex sm:max-w-[30%]">
              <YesOrNoChart
                data={noteData.recommend}
                label="Clientes que nós Recomendam"
                isMobile={isMobile}
              />
            </div>
            <div className="flex sm:max-w-[30%]">
              <YesOrNoChart
                data={noteData.solved}
                label="Clientes que solucionamos os problemas"
                isMobile={isMobile}
              />
            </div>
            <div className="flex sm:max-w-[30%]">
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
