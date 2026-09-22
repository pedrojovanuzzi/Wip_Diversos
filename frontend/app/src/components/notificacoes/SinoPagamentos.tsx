import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { FaBell, FaQrcode, FaDesktop } from "react-icons/fa";
import { MdAutorenew } from "react-icons/md";
import { useAuth } from "../../context/AuthContext";

interface Pagamento {
  id: string;
  tipo: "normal" | "automatico" | "licenca";
  titulo: string;
  cliente: string;
  referencia: string;
  valor: number;
  pagoEm: string;
}

/** De quanto em quanto tempo o sino pergunta se entrou pagamento. */
const INTERVALO_MS = 45_000;

/** Guarda o que já foi visto, para o contador não zerar a cada página. */
const CHAVE_VISTOS = "pix_notificacoes_vistos";
const CHAVE_LISTA = "pix_notificacoes_lista";

/** Cada origem tem a sua cor: dá para reconhecer sem ler o texto. */
const ESTILOS = {
  automatico: {
    faixa: "border-l-4 border-indigo-500 bg-indigo-50",
    selo: "bg-indigo-100 text-indigo-700",
    icone: <MdAutorenew className="size-4" />,
  },
  normal: {
    faixa: "border-l-4 border-emerald-500 bg-emerald-50",
    selo: "bg-emerald-100 text-emerald-700",
    icone: <FaQrcode className="size-3.5" />,
  },
  licenca: {
    faixa: "border-l-4 border-amber-500 bg-amber-50",
    selo: "bg-amber-100 text-amber-800",
    icone: <FaDesktop className="size-3.5" />,
  },
};

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function quando(data: string) {
  const d = new Date(data);
  if (isNaN(d.getTime())) return "";
  const minutos = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  if (minutos < 60 * 24) return `há ${Math.floor(minutos / 60)} h`;
  return d.toLocaleDateString("pt-BR");
}

function lerLista(): Pagamento[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_LISTA) || "[]");
  } catch {
    return [];
  }
}

/**
 * Sino de pagamentos Pix, presente em todas as telas (vive na NavBar).
 *
 * Pergunta ao servidor de tempos em tempos quais pagamentos entraram desde a
 * última consulta e mostra cada um com a cor da sua origem: Pix Automático,
 * Pix comum ou mensalidade de licença.
 */
export const SinoPagamentos = () => {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>(lerLista);
  const [aberto, setAberto] = useState(false);
  const [naoVistos, setNaoVistos] = useState(0);
  const painel = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const token = user?.token;

  const buscar = useCallback(async () => {
    if (!token) return;
    try {
      // Desde a última consulta; na primeira vez, as últimas 24 horas.
      const desde =
        localStorage.getItem(CHAVE_VISTOS) ||
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const resposta = await axios.get(
        `${process.env.REACT_APP_URL}/Pix/notificacoesPagamentos`,
        {
          params: { desde },
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const novos: Pagamento[] = resposta.data ?? [];
      if (novos.length === 0) return;

      setPagamentos((anteriores) => {
        const conhecidos = new Set(anteriores.map((p) => p.id));
        const inéditos = novos.filter((p) => !conhecidos.has(p.id));
        if (inéditos.length === 0) return anteriores;

        setNaoVistos((n) => n + inéditos.length);
        const lista = [...inéditos, ...anteriores].slice(0, 50);
        localStorage.setItem(CHAVE_LISTA, JSON.stringify(lista));
        return lista;
      });
    } catch {
      // Sem conexão ou sessão expirada: tenta de novo no próximo ciclo.
    }
  }, [token]);

  useEffect(() => {
    buscar();
    const timer = setInterval(buscar, INTERVALO_MS);
    return () => clearInterval(timer);
  }, [buscar]);

  // Fecha ao clicar fora, senão o painel fica por cima do conteúdo.
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => {
      if (painel.current && !painel.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto]);

  const abrir = () => {
    setAberto((atual) => {
      if (!atual) {
        // Abrir conta como ler: zera o contador e marca o horário.
        setNaoVistos(0);
        localStorage.setItem(CHAVE_VISTOS, new Date().toISOString());
      }
      return !atual;
    });
  };

  const limpar = () => {
    setPagamentos([]);
    localStorage.removeItem(CHAVE_LISTA);
    localStorage.setItem(CHAVE_VISTOS, new Date().toISOString());
    setNaoVistos(0);
  };

  if (!token) return null;

  return (
    <div ref={painel} className="fixed right-4 top-4 z-50">
      <button
        onClick={abrir}
        title="Pagamentos recebidos"
        className="relative flex size-11 items-center justify-center rounded-full bg-stone-800 text-white shadow-lg transition hover:bg-stone-700"
      >
        <FaBell className="size-5" />
        {naoVistos > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
            {naoVistos > 99 ? "99+" : naoVistos}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-2 max-h-[70vh] w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl sm:w-96">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Pagamentos recebidos
            </h3>
            {pagamentos.length > 0 && (
              <button
                onClick={limpar}
                className="text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {pagamentos.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">
                Nenhum pagamento recebido por enquanto.
              </p>
            ) : (
              pagamentos.map((p) => {
                const estilo = ESTILOS[p.tipo] ?? ESTILOS.normal;
                return (
                  <div
                    key={p.id}
                    className={`px-4 py-3 ${estilo.faixa} border-b border-gray-100`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${estilo.selo}`}
                      >
                        {estilo.icone}
                        {p.titulo}
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {moeda(p.valor)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-gray-800">
                      {p.cliente || "-"}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-gray-500">
                        {p.referencia}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {quando(p.pagoEm)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
