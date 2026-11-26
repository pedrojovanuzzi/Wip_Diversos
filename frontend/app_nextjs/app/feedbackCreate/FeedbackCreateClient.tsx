"use client";

import { useEffect, useState, useTransition } from "react";
import axios from "axios";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart } from "@mui/x-charts/BarChart";
import NavBar from "@/components/NavBar";
import type { User } from "@/lib/auth";
import SeletorTecnico from "./components/SeletorTecnico";
import Toggle from "./components/Toggle";
import { FiLink2, FiCopy, FiCheck, FiMessageCircle } from "react-icons/fi";

/**
 * Origem: frontend/app/src/pages/feedback/FeedBackLinkGenerator.tsx
 * Técnicos e indicadores chegam do page.tsx (servidor). Trocar o período ou o
 * técnico muda a URL, e o servidor manda os indicadores novos.
 */

export interface Tecnico {
  id: number;
  name: string;
}

interface Nota {
  note: number;
  count: number;
}

interface NotaTecnico extends Nota {
  login: string;
}

export interface Indicadores {
  internet: Nota[];
  service: Nota[];
  responseTime: Nota[];
  recommend: Nota[];
  solved: Nota[];
  technician: NotaTecnico[];
}

const VAZIO: Indicadores = {
  internet: [],
  service: [],
  responseTime: [],
  recommend: [],
  solved: [],
  technician: [],
};

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
    <h3 className="text-sm font-semibold text-slate-700 mb-2">{title}</h3>
    <div className="flex justify-center">{children}</div>
  </div>
);

/** Barras de nota 0 a 10, do verde ao vermelho. */
const GraficoNotas = ({
  data,
  label,
  isMobile,
}: {
  data: Nota[];
  label: string;
  isMobile: boolean;
}) => (
  <BarChart
    width={isMobile ? 300 : 500}
    height={300}
    series={[{ data: data.map((d) => d.count), label, id: "count", color: "none" }]}
    xAxis={[
      {
        data: data.map((d) => d.note),
        scaleType: "band",
        colorMap: { type: "continuous", min: 10, max: 0, color: ["green", "red"] },
      },
    ]}
  />
);

const GraficoSimNao = ({
  data,
  label,
  isMobile,
}: {
  data: Nota[];
  label: string;
  isMobile: boolean;
}) => {
  const truthy = (v: any) => v === 1 || v === "1" || v === true || v === "true" || v === "sim";
  const falsy = (v: any) =>
    v === 0 || v === "0" || v === false || v === "false" || v === "nao" || v === "não";
  const somar = (ok: (v: any) => boolean) =>
    data.filter((d) => ok(d.note)).reduce((s, d) => s + Number(d.count || 0), 0);

  return (
    <BarChart
      width={isMobile ? 300 : 500}
      height={300}
      series={[{ data: [somar(truthy), somar(falsy)], label, id: "yes-no" }]}
      xAxis={[{ data: ["Sim", "Não"], scaleType: "band" }]}
    />
  );
};

export default function FeedbackCreateClient({
  user,
  tecnicos,
  tecnico,
  anual,
  indicadores,
}: {
  user: User;
  tecnicos: Tecnico[];
  tecnico: string;
  anual: boolean;
  indicadores: Indicadores | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [carregando, startTransition] = useTransition();

  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  // Começa como desktop nos dois lados (servidor não tem janela) e ajusta depois.
  const [isMobile, setIsMobile] = useState(false);

  const dados = indicadores ?? VAZIO;

  useEffect(() => {
    const ajustar = () => setIsMobile(window.innerWidth < 768);
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  /** Troca período/técnico na URL; o page.tsx busca os indicadores de novo. */
  function ir(novo: { tecnico?: string; anual?: boolean }) {
    const qs = new URLSearchParams();
    const t = novo.tecnico ?? tecnico;
    const a = novo.anual ?? anual;
    if (t) qs.set("tecnico", t);
    if (a) qs.set("periodo", "ano");
    startTransition(() => {
      router.push(qs.size ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  const createLink = async () => {
    if (!tecnico) {
      alert("Selecione um técnico antes de gerar o link.");
      return;
    }
    setCreating(true);
    setCopied(false);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/feedback/create`,
        { technician: tecnico },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
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
    navigator.clipboard.writeText(`${process.env.REACT_APP_BASE_URL}${generatedLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar user={user} />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Cabeçalho */}
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
            href="/feedback/Opnion"
            className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition"
          >
            <FiMessageCircle />
            Ver opiniões
          </Link>
        </div>

        {/* Gerar link */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-900">Gerar link de feedback</h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Selecione o técnico que esteve no atendimento e gere o link para enviar ao cliente.
          </p>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Técnico</label>
              <SeletorTecnico
                tecnicos={tecnicos}
                selecionado={tecnico}
                onChange={(nome) => {
                  setGeneratedLink(null);
                  ir({ tecnico: nome });
                }}
              />
            </div>
            <button
              onClick={createLink}
              disabled={creating || !tecnico}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Gerando…" : "Gerar Link"}
            </button>
          </div>

          {generatedLink && (
            <div className="mt-5">
              <p className="text-xs font-medium text-slate-700 mb-1.5">Link gerado</p>
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
              href="/feedback/Opnion"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <FiMessageCircle />
              Ver opiniões
            </Link>
          </div>
        </div>

        {/* Período */}
        <div className="mt-8 mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Indicadores</h2>
          <div className="flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1.5 shadow-sm">
            <span className="text-xs text-slate-500">Período:</span>
            <Toggle checked={anual} onChange={() => ir({ anual: !anual })} />
          </div>
        </div>

        {!indicadores && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Não foi possível carregar os indicadores.
          </p>
        )}

        <div
          className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition-opacity ${
            carregando ? "opacity-50" : ""
          }`}
        >
          <ChartCard title="Notas — Internet">
            <GraficoNotas data={dados.internet} label="Notas sobre a Internet" isMobile={isMobile} />
          </ChartCard>
          <ChartCard title="Notas — Atendimento">
            <GraficoNotas data={dados.service} label="Notas sobre o Atendimento" isMobile={isMobile} />
          </ChartCard>
          <ChartCard title="Notas — Tempo de Resposta">
            <GraficoNotas
              data={dados.responseTime}
              label="Notas sobre o Tempo de Resposta"
              isMobile={isMobile}
            />
          </ChartCard>
          <ChartCard title="Recomendariam a empresa">
            <GraficoSimNao data={dados.recommend} label="Clientes que nos recomendam" isMobile={isMobile} />
          </ChartCard>
          <ChartCard title="Problemas resolvidos">
            <GraficoSimNao data={dados.solved} label="Problemas que solucionamos" isMobile={isMobile} />
          </ChartCard>
          {dados.technician.length > 0 && (
            <ChartCard title={`Notas — Técnico ${tecnico}`.trim()}>
              <GraficoNotas data={dados.technician} label={`Notas sobre o ${tecnico}`} isMobile={isMobile} />
            </ChartCard>
          )}
        </div>
      </div>
    </div>
  );
}
