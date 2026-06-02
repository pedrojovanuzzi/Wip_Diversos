import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { BarChart } from "@mui/x-charts/BarChart";
import { NavBar } from "../../components/navbar/NavBar";
import Select from "./components/Select";
import Toggle from "./components/Toggle";
import { useAuth } from "../../context/AuthContext";
import { FiLink2, FiCopy, FiCheck, FiMessageCircle } from "react-icons/fi";

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

const ChartCard: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
    <h3 className="text-sm font-semibold text-slate-700 mb-2">{title}</h3>
    <div className="flex justify-center">{children}</div>
  </div>
);

const FeedbackBarChart = ({
  data,
  label,
  isMobile,
}: {
  data: Note[];
  label: string;
  isMobile: boolean;
}) => {
  const chartData = (data || []).map((d) => ({
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
  const truthy = (v: any) =>
    v === 1 || v === "1" || v === true || v === "true" || v === "sim";
  const falsy = (v: any) =>
    v === 0 ||
    v === "0" ||
    v === false ||
    v === "false" ||
    v === "nao" ||
    v === "não";
  const simCount = data
    .filter((d) => truthy(d.note))
    .reduce((s, d) => s + Number(d.count || 0), 0);
  const naoCount = data
    .filter((d) => falsy(d.note))
    .reduce((s, d) => s + Number(d.count || 0), 0);

  return (
    <BarChart
      width={isMobile ? 300 : 500}
      height={300}
      series={[
        {
          data: [simCount, naoCount],
          label,
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
  if (!Array.isArray(data)) return null;
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
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const token = user?.token;

  const [noteData, setNoteData] = useState<{ [key: string]: any[] }>({
    internet: [],
    service: [],
    responseTime: [],
    recommend: [],
    solved: [],
  });
  const [technoteData, settechNoteData] = useState<{ technician: NoteTech[] }>({
    technician: [],
  });
  const [isMonthly, setMonthly] = useState(true);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  const fetchNotes = async (type: string) => {
    const period = isMonthly ? "month" : "year";
    const endpoint = `${process.env.REACT_APP_URL}/feedback/Note${type}/${period}`;
    try {
      const response = await axios.get(endpoint, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar notas:", error);
      return [];
    }
  };

  const fetchNotesTech = async (type: string): Promise<NoteTech[]> => {
    const period = isMonthly ? "month" : "year";
    const endpoint = `${process.env.REACT_APP_URL}/feedback/Note${type}/${period}`;
    try {
      const response = await axios.post(
        endpoint,
        { technician: selectedTechnician },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const parsedData: NoteTech[] = response.data.map((item: any) => ({
        note: item.note,
        count: Number(item.count),
        login: item.login || "",
      }));
      return parsedData;
    } catch (error: any) {
      console.error("Erro ao buscar dados do técnico:", error);
      return [];
    }
  };

  const createLink = async () => {
    if (!selectedTechnician) {
      alert("Selecione um técnico antes de gerar o link.");
      return;
    }
    setCreating(true);
    setCopied(false);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/feedback/create`,
        { technician: selectedTechnician },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (response.data?.link) setGeneratedLink(response.data.link);
    } catch (error) {
      console.error("Erro ao gerar o link:", error);
    } finally {
      setCreating(false);
    }
  };

  const copyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(
      `${process.env.REACT_APP_BASE_URL}${generatedLink}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const parseNoteData = (data: any[]): NoteYesOrNo[] =>
      data.map((item) => ({
        note: Array.isArray(item.note?.data) ? item.note.data[0] : item.note,
        count: Number(item.count),
      }));

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

        setNoteData({
          internet,
          service,
          responseTime,
          recommend: parseNoteData(recommend),
          solved: parseNoteData(solved),
        });

        const tech = await fetchNotesTech("Technician");
        settechNoteData({ technician: tech });
      } catch (error) {
        console.error("Erro ao buscar os dados:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonthly, selectedTechnician]);

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-xl p-2.5 bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200">
              <FiLink2 className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Pesquisa de Satisfação
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Gere links de feedback e acompanhe os indicadores.
              </p>
            </div>
          </div>

          <Link
            to="/feedback/Opnion"
            className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition"
          >
            <FiMessageCircle />
            Ver opiniões
          </Link>
        </div>

        {/* Card gerar link */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Gerar link de feedback
          </h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Selecione o técnico que esteve no atendimento e gere o link para
            enviar ao cliente.
          </p>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Técnico
              </label>
              <Select
                onChange={(tech: Tech) => setSelectedTechnician(tech.name)}
              />
            </div>
            <button
              onClick={createLink}
              disabled={creating || !selectedTechnician}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Gerando…" : "Gerar Link"}
            </button>
          </div>

          {generatedLink && (
            <div className="mt-5">
              <p className="text-xs font-medium text-slate-700 mb-1.5">
                Link gerado
              </p>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 break-all">
                  {`${process.env.REACT_APP_BASE_URL}${generatedLink}`}
                </div>
                <button
                  onClick={copyLink}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  {copied ? <FiCheck className="text-emerald-500" /> : <FiCopy />}
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 sm:hidden">
            <Link
              to="/feedback/Opnion"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <FiMessageCircle />
              Ver opiniões
            </Link>
          </div>
        </div>

        {/* Toggle período */}
        <div className="mt-8 mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">
            Indicadores
          </h2>
          <div className="flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1.5 shadow-sm">
            <span className="text-xs text-slate-500">Período:</span>
            <Toggle
              checked={!isMonthly}
              onChange={() => setMonthly((prev) => !prev)}
            />
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center text-slate-500">
            Carregando indicadores…
          </div>
        )}

        {!loading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ChartCard title="Notas — Internet">
              <FeedbackBarChart
                data={noteData.internet}
                label="Notas sobre a Internet"
                isMobile={isMobile}
              />
            </ChartCard>
            <ChartCard title="Notas — Atendimento">
              <FeedbackBarChart
                data={noteData.service}
                label="Notas sobre o Atendimento"
                isMobile={isMobile}
              />
            </ChartCard>
            <ChartCard title="Notas — Tempo de Resposta">
              <FeedbackBarChart
                data={noteData.responseTime}
                label="Notas sobre o Tempo de Resposta"
                isMobile={isMobile}
              />
            </ChartCard>
            <ChartCard title="Recomendariam a empresa">
              <YesOrNoChart
                data={noteData.recommend}
                label="Clientes que nos recomendam"
                isMobile={isMobile}
              />
            </ChartCard>
            <ChartCard title="Problemas resolvidos">
              <YesOrNoChart
                data={noteData.solved}
                label="Problemas que solucionamos"
                isMobile={isMobile}
              />
            </ChartCard>
            {technoteData.technician.length > 0 && (
              <ChartCard
                title={`Notas — Técnico ${selectedTechnician || ""}`.trim()}
              >
                <TechBarChart
                  data={technoteData.technician}
                  label={`Notas sobre o ${selectedTechnician}`}
                  isMobile={isMobile}
                />
              </ChartCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackLinkGenerator;
